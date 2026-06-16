import asyncio
import logging
import time
import hashlib
import random
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass

from config import Config

logger = logging.getLogger(__name__)


@dataclass
class TransactionRecord:
    tx_hash: str
    block_number: int
    block_time: datetime
    from_address: str
    to_address: str
    amount: int
    token_mint: str
    tx_type: str
    is_internal: bool = False


class MockSolanaCollector:
    def __init__(self):
        self._last_block = 0
        self._known_addresses: Set[str] = set()
        self._address_tx_count: Dict[str, int] = {}
        self._generated_txs: Set[str] = set()
        self._seed_addresses = self._generate_seed_addresses(200)

    def _generate_seed_addresses(self, count: int) -> List[str]:
        addresses = []
        seeds = [
            "mixer_node_", "exchange_hot_", "whale_wallet_",
            "gathering_hub_", "normal_user_", "nft_trader_",
            "defi_farmer_", "dex_lp_", "arbitrage_bot_", "sniper_bot_",
        ]
        for i in range(count):
            seed = seeds[i % len(seeds)] + str(i)
            addr = hashlib.sha256(seed.encode()).hexdigest()[:32]
            addr = "Sol" + addr[:-3] + "X" + str(i % 10)
            addresses.append(addr)
            self._known_addresses.add(addr)
        return addresses

    def _generate_tx_hash(self, block: int, idx: int) -> str:
        raw = f"tx_{block}_{idx}_{time.time_ns()}"
        return hashlib.sha256(raw.encode()).hexdigest()[:64]

    def _pick_address(self, prefer_risky: bool = False) -> str:
        all_addrs = list(self._known_addresses)
        if prefer_risky and len(all_addrs) > 100:
            risky_range = all_addrs[:40]
            return random.choice(risky_range)
        if random.random() < 0.3 and len(all_addrs) > 50:
            return random.choice(all_addrs[:20])
        return random.choice(all_addrs)

    def _generate_mock_block(self, block_number: int) -> List[TransactionRecord]:
        txs: List[TransactionRecord] = []
        block_time = datetime.now(timezone.utc)
        tx_count = random.randint(30, 80)

        for idx in range(tx_count):
            tx_hash = self._generate_tx_hash(block_number, idx)
            if tx_hash in self._generated_txs:
                continue
            self._generated_txs.add(tx_hash)

            prefer_risky = idx < 10
            from_addr = self._pick_address(prefer_risky=prefer_risky)
            to_addr = self._pick_address(prefer_risky=prefer_risky and idx % 2 == 0)

            while to_addr == from_addr:
                to_addr = self._pick_address(prefer_risky=random.random() < 0.4)

            base_amount = random.randint(1_000_000, 500_000_000)

            if idx < 15:
                base_amount = random.randint(
                    Config.LARGE_TRANSACTION_THRESHOLD // 2,
                    Config.LARGE_TRANSACTION_THRESHOLD * 50,
                )

            if idx % 7 == 0 and block_number % 5 == 0:
                base_amount = random.randint(
                    Config.LARGE_TRANSACTION_THRESHOLD * 10,
                    Config.LARGE_TRANSACTION_THRESHOLD * 80,
                )

            tx_type = "transfer"
            is_internal = False

            if idx % 11 == 0:
                tx_type = "dex_swap"
            elif idx % 17 == 0:
                tx_type = "stake_delegate"
            elif idx % 23 == 0:
                tx_type = "contract_call"
                is_internal = True
            elif idx % 29 == 0:
                tx_type = "nft_trade"

            token_mint = ""
            if tx_type in ("dex_swap", "nft_trade"):
                token_mint = hashlib.sha256(f"token_{idx}".encode()).hexdigest()[:44]

            tx = TransactionRecord(
                tx_hash=tx_hash,
                block_number=block_number,
                block_time=block_time,
                from_address=from_addr,
                to_address=to_addr,
                amount=base_amount,
                token_mint=token_mint,
                tx_type=tx_type,
                is_internal=is_internal,
            )
            txs.append(tx)

            self._address_tx_count[from_addr] = self._address_tx_count.get(from_addr, 0) + 1
            self._address_tx_count[to_addr] = self._address_tx_count.get(to_addr, 0) + 1

        self._last_block = block_number
        return txs

    def filter_large_transactions(
        self, transactions: List[TransactionRecord]
    ) -> List[TransactionRecord]:
        return [
            tx
            for tx in transactions
            if tx.amount >= Config.LARGE_TRANSACTION_THRESHOLD
        ]

    def tx_to_dict(self, tx: TransactionRecord) -> Dict[str, Any]:
        return {
            "tx_hash": tx.tx_hash,
            "block_number": tx.block_number,
            "block_time": tx.block_time.strftime("%Y-%m-%d %H:%M:%S"),
            "from_address": tx.from_address,
            "to_address": tx.to_address,
            "amount": tx.amount,
            "token_mint": tx.token_mint,
            "tx_type": tx.tx_type,
            "is_internal": tx.is_internal,
        }

    def build_address_records(
        self, transactions: List[TransactionRecord]
    ) -> List[Dict[str, Any]]:
        records: List[Dict[str, Any]] = []
        for tx in transactions:
            block_time_str = tx.block_time.strftime("%Y-%m-%d %H:%M:%S")
            records.append(
                {
                    "address": tx.from_address,
                    "tx_hash": tx.tx_hash,
                    "block_number": tx.block_number,
                    "block_time": block_time_str,
                    "role": "sender",
                    "amount": tx.amount,
                    "counterparty": tx.to_address,
                }
            )
            records.append(
                {
                    "address": tx.to_address,
                    "tx_hash": tx.tx_hash,
                    "block_number": tx.block_number,
                    "block_time": block_time_str,
                    "role": "receiver",
                    "amount": tx.amount,
                    "counterparty": tx.from_address,
                }
            )
        return records

    async def poll_blocks(self, start_block: Optional[int] = None) -> List[Dict[str, Any]]:
        if start_block is None:
            start_block = self._last_block + 1 if self._last_block > 0 else random.randint(
                200_000_000, 210_000_000
            )

        all_large: List[TransactionRecord] = []
        all_records: List[TransactionRecord] = []
        blocks_to_poll = random.randint(1, 3)

        for offset in range(blocks_to_poll):
            block_num = start_block + offset
            block_txs = self._generate_mock_block(block_num)
            large = self.filter_large_transactions(block_txs)
            all_large.extend(large)
            all_records.extend(block_txs)
            logger.info(
                f"Block {block_num}: generated {len(block_txs)} txs, "
                f"{len(large)} large (>= {Config.LARGE_TRANSACTION_THRESHOLD:,} lamports)"
            )

        large_dicts = [self.tx_to_dict(tx) for tx in all_large]
        address_records = self.build_address_records(all_records)

        return {
            "large_transactions": large_dicts,
            "address_transactions": address_records,
            "unique_addresses": list(
                set(
                    [tx.from_address for tx in all_records]
                    + [tx.to_address for tx in all_records]
                )
            ),
            "last_block": self._last_block,
        }
