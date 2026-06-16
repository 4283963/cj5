import asyncio
import logging
import random
import signal
import sys
import time
from datetime import datetime
from typing import Set, Dict, Any, List

from config import Config
from clickhouse_client import ClickHouseClient
from risk_scoring_model import RiskScoringModel
from solana_collector import MockSolanaCollector

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("crypto_sentinel")


class CryptoSentinelPipeline:
    def __init__(self):
        self.running = False
        self.ch_client = ClickHouseClient()
        self.risk_model = RiskScoringModel()
        self.collector = MockSolanaCollector()
        self.addresses_to_analyze: Set[str] = set()
        self._address_tx_cache: Dict[str, List[Dict[str, Any]]] = {}
        self._stats: Dict[str, Any] = {
            "blocks_processed": 0,
            "total_txs": 0,
            "large_txs": 0,
            "risky_addresses": 0,
            "start_time": None,
        }

    async def start(self):
        self.running = True
        self._stats["start_time"] = time.time()
        logger.info("=" * 60)
        logger.info("🚀 Crypto Sentinel Pipeline Starting")
        logger.info(f"   Large TX threshold: {Config.LARGE_TRANSACTION_THRESHOLD:,} lamports")
        logger.info(f"   Risk model threshold: {Config.RISK_MODEL_THRESHOLD}")
        logger.info(f"   Poll interval: {Config.POLL_INTERVAL}s")
        logger.info("=" * 60)

        loop = asyncio.get_running_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            try:
                loop.add_signal_handler(sig, self._handle_shutdown)
            except NotImplementedError:
                pass

        try:
            await self._run_pipeline()
        except Exception as e:
            logger.error(f"Pipeline crashed: {e}", exc_info=True)
            self.running = False

    def _handle_shutdown(self):
        logger.info("\n🛑 Shutdown signal received. Stopping gracefully...")
        self.running = False

    async def _run_pipeline(self):
        iteration = 0
        while self.running:
            iteration += 1
            try:
                await self._process_iteration(iteration)
            except Exception as e:
                logger.error(f"Error in iteration {iteration}: {e}", exc_info=True)
            for _ in range(Config.POLL_INTERVAL * 10):
                if not self.running:
                    break
                await asyncio.sleep(0.1)
        self._print_final_stats()

    async def _process_iteration(self, iteration: int):
        poll_start = time.time()

        result = await self.collector.poll_blocks()

        large_txs = result["large_transactions"]
        addr_records = result["address_transactions"]
        addresses = result["unique_addresses"]

        self._stats["blocks_processed"] += 1
        self._stats["total_txs"] += len(addr_records) // 2
        self._stats["large_txs"] += len(large_txs)

        if large_txs:
            self.ch_client.insert_large_transactions(large_txs)

        if addr_records:
            self.ch_client.insert_address_transactions(addr_records)
            self._cache_tx_records(addr_records)

        for addr in addresses:
            self.addresses_to_analyze.add(addr)

        risk_results: List[Dict[str, Any]] = []
        addresses_to_process = list(self.addresses_to_analyze)
        random.shuffle(addresses_to_process)

        analyze_count = min(len(addresses_to_process), 50)
        for i in range(analyze_count):
            addr = addresses_to_process[i]
            assessment = await self._analyze_single_address(addr)
            if assessment and (
                assessment.risk_level in ("high", "medium")
                or assessment.risk_score >= Config.RISK_MODEL_THRESHOLD - 0.1
            ):
                stats = self.ch_client.get_address_stats(addr) or {}
                risk_results.append(
                    {
                        "address": addr,
                        "risk_score": assessment.risk_score,
                        "risk_level": assessment.risk_level,
                        "risk_tags": assessment.risk_tags,
                        "total_transactions": stats.get("tx_count", 0),
                        "total_volume": stats.get("total_volume", 0),
                    }
                )

        high_count = sum(1 for r in risk_results if r["risk_level"] == "high")
        medium_count = sum(1 for r in risk_results if r["risk_level"] == "medium")
        self._stats["risky_addresses"] += len(risk_results)

        if risk_results:
            self.ch_client.upsert_risk_addresses(risk_results)

        elapsed = time.time() - poll_start

        if iteration % 5 == 0:
            self._print_progress(iteration, elapsed, high_count, medium_count, len(large_txs))

    def _cache_tx_records(self, addr_records: List[Dict[str, Any]]):
        for rec in addr_records:
            addr = rec["address"]
            if addr not in self._address_tx_cache:
                self._address_tx_cache[addr] = []
            self._address_tx_cache[addr].append(rec)
            if len(self._address_tx_cache[addr]) > 200:
                self._address_tx_cache[addr] = self._address_tx_cache[addr][-200:]

    async def _analyze_single_address(self, address: str):
        try:
            if address in self.addresses_to_analyze:
                self.addresses_to_analyze.discard(address)

            tx_history = self._address_tx_cache.get(address, []).copy()

            if len(tx_history) < 5:
                db_stats = self.ch_client.get_address_stats(address)
                if db_stats and db_stats.get("tx_count", 0) < 3:
                    return None

            address_stats = self.ch_client.get_address_stats(address) or {
                "tx_count": len(tx_history),
                "total_volume": sum(t["amount"] for t in tx_history),
                "first_seen": None,
                "last_seen": None,
            }

            counterparties = self.ch_client.get_recent_counterparties(address, limit=100)
            if not counterparties and tx_history:
                counterparties = list(set(t["counterparty"] for t in tx_history))
                counterparties = counterparties[:100]

            assessment = self.risk_model.assess_address(
                address=address,
                tx_history=tx_history,
                address_stats=address_stats,
                counterparties=counterparties,
            )

            if assessment.risk_level != "low":
                logger.debug(
                    f"Address {address[:12]}... score={assessment.risk_score:.3f} "
                    f"level={assessment.risk_level} tags={assessment.risk_tags}"
                )

            return assessment

        except Exception as e:
            logger.debug(f"Error analyzing address {address}: {e}")
            return None

    def _print_progress(
        self, iteration: int, elapsed: float,
        high: int, medium: int, large_txs: int,
    ):
        uptime = time.time() - (self._stats["start_time"] or time.time())
        uptime_str = self._format_duration(uptime)

        logger.info(
            f"[Iter {iteration:4d}]⏱{elapsed:.2f}s | "
            f"TXs: {self._stats['total_txs']:,} (大: {large_txs}) | "
            f"🔴高风险: {high} 🟡中风险: {medium} | "
            f"已处理: {self._stats['risky_addresses']:,} | "
            f"运行: {uptime_str}"
        )

    def _print_final_stats(self):
        uptime = time.time() - (self._stats["start_time"] or time.time())
        logger.info("\n" + "=" * 60)
        logger.info("📊 Crypto Sentinel Pipeline Final Stats")
        logger.info("=" * 60)
        logger.info(f"   Runtime: {self._format_duration(uptime)}")
        logger.info(f"   Blocks processed: {self._stats['blocks_processed']:,}")
        logger.info(f"   Total txs: {self._stats['total_txs']:,}")
        logger.info(f"   Large txs: {self._stats['large_txs']:,}")
        logger.info(f"   Risky addresses flagged: {self._stats['risky_addresses']:,}")
        logger.info("=" * 60)

    @staticmethod
    def _format_duration(seconds: float) -> str:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        if hours > 0:
            return f"{hours}h{minutes:02d}m"
        elif minutes > 0:
            return f"{minutes}m{secs:02d}s"
        return f"{secs}s"


def main():
    pipeline = CryptoSentinelPipeline()
    try:
        asyncio.run(pipeline.start())
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
