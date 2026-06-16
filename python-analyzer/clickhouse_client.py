import logging
from typing import List, Dict, Any, Optional
import clickhouse_connect
from clickhouse_connect.driver.client import Client
from config import Config

logger = logging.getLogger(__name__)


class ClickHouseClient:
    def __init__(self):
        self.client: Optional[Client] = None
        self._connect()
        self._init_database()
        self._init_tables()

    def _connect(self) -> None:
        try:
            self.client = clickhouse_connect.get_client(
                host=Config.CLICKHOUSE_HOST,
                port=Config.CLICKHOUSE_PORT,
                username=Config.CLICKHOUSE_USER,
                password=Config.CLICKHOUSE_PASSWORD,
            )
            logger.info("Connected to ClickHouse successfully")
        except Exception as e:
            logger.error(f"Failed to connect to ClickHouse: {e}")
            raise

    def _init_database(self) -> None:
        self.client.command(
            f"CREATE DATABASE IF NOT EXISTS {Config.CLICKHOUSE_DATABASE}"
        )
        self.client.command(f"USE {Config.CLICKHOUSE_DATABASE}")

    def _init_tables(self) -> None:
        self.client.command("""
            CREATE TABLE IF NOT EXISTS risk_addresses (
                address String,
                risk_score Float64,
                risk_level String,
                risk_tags Array(String),
                total_transactions UInt64 DEFAULT 0,
                total_volume UInt64 DEFAULT 0,
                first_seen DateTime DEFAULT now(),
                last_seen DateTime DEFAULT now(),
                created_at DateTime DEFAULT now(),
                updated_at DateTime DEFAULT now()
            ) ENGINE = ReplacingMergeTree(updated_at)
            PRIMARY KEY (address)
            ORDER BY (address)
        """)

        self.client.command("""
            CREATE TABLE IF NOT EXISTS large_transactions (
                tx_hash String,
                block_number UInt64,
                block_time DateTime,
                from_address String,
                to_address String,
                amount UInt64,
                token_mint String DEFAULT '',
                tx_type String,
                is_internal Bool DEFAULT false,
                created_at DateTime DEFAULT now()
            ) ENGINE = MergeTree()
            PRIMARY KEY (block_number, tx_hash)
            ORDER BY (block_number, tx_hash, created_at)
            PARTITION BY toYYYYMM(block_time)
        """)

        self.client.command("""
            CREATE TABLE IF NOT EXISTS address_transactions (
                address String,
                tx_hash String,
                block_number UInt64,
                block_time DateTime,
                role String,
                amount UInt64,
                counterparty String,
                created_at DateTime DEFAULT now()
            ) ENGINE = MergeTree()
            PRIMARY KEY (address, block_number)
            ORDER BY (address, block_number, tx_hash)
            PARTITION BY toYYYYMM(block_time)
        """)

        self.client.command("""
            CREATE MATERIALIZED VIEW IF NOT EXISTS tx_throughput_mv
            ENGINE = SummingMergeTree()
            PARTITION BY toYYYYMM(window_start)
            ORDER BY (window_start)
            AS SELECT
                toStartOfMinute(block_time) AS window_start,
                count() AS tx_count,
                sum(amount) AS total_volume,
                uniq(from_address) AS unique_senders,
                uniq(to_address) AS unique_receivers
            FROM large_transactions
            GROUP BY window_start
        """)

    def insert_large_transactions(self, transactions: List[Dict[str, Any]]) -> None:
        if not transactions:
            return
        try:
            data = [
                (
                    tx["tx_hash"],
                    tx["block_number"],
                    tx["block_time"],
                    tx["from_address"],
                    tx["to_address"],
                    tx["amount"],
                    tx.get("token_mint", ""),
                    tx["tx_type"],
                    tx.get("is_internal", False),
                )
                for tx in transactions
            ]
            self.client.insert(
                "large_transactions",
                data,
                column_names=[
                    "tx_hash",
                    "block_number",
                    "block_time",
                    "from_address",
                    "to_address",
                    "amount",
                    "token_mint",
                    "tx_type",
                    "is_internal",
                ],
            )
            logger.info(f"Inserted {len(transactions)} large transactions")
        except Exception as e:
            logger.error(f"Failed to insert large transactions: {e}")

    def insert_address_transactions(self, records: List[Dict[str, Any]]) -> None:
        if not records:
            return
        try:
            data = [
                (
                    r["address"],
                    r["tx_hash"],
                    r["block_number"],
                    r["block_time"],
                    r["role"],
                    r["amount"],
                    r["counterparty"],
                )
                for r in records
            ]
            self.client.insert(
                "address_transactions",
                data,
                column_names=[
                    "address",
                    "tx_hash",
                    "block_number",
                    "block_time",
                    "role",
                    "amount",
                    "counterparty",
                ],
            )
        except Exception as e:
            logger.error(f"Failed to insert address transactions: {e}")

    def upsert_risk_addresses(self, risk_data: List[Dict[str, Any]]) -> None:
        if not risk_data:
            return
        try:
            for addr_data in risk_data:
                query = f"""
                    INSERT INTO risk_addresses (
                        address, risk_score, risk_level, risk_tags,
                        total_transactions, total_volume, updated_at
                    ) VALUES
                """
                tags_str = "[" + ",".join([f"'{t}'" for t in addr_data["risk_tags"]]) + "]"
                query += f"""
                    ('{addr_data['address']}', {addr_data['risk_score']},
                    '{addr_data['risk_level']}', {tags_str},
                    {addr_data.get('total_transactions', 0)},
                    {addr_data.get('total_volume', 0)}, now())
                """
                self.client.command(query)
            logger.info(f"Upserted {len(risk_data)} risk addresses")
        except Exception as e:
            logger.error(f"Failed to upsert risk addresses: {e}")

    def get_address_stats(self, address: str) -> Optional[Dict[str, Any]]:
        try:
            result = self.client.query(f"""
                SELECT
                    count() as tx_count,
                    sum(amount) as total_volume,
                    min(block_time) as first_seen,
                    max(block_time) as last_seen
                FROM address_transactions
                WHERE address = '{address}'
            """)
            rows = result.result_rows
            if rows:
                row = rows[0]
                return {
                    "tx_count": row[0] or 0,
                    "total_volume": row[1] or 0,
                    "first_seen": row[2],
                    "last_seen": row[3],
                }
        except Exception as e:
            logger.error(f"Failed to get address stats for {address}: {e}")
        return None

    def get_recent_counterparties(self, address: str, limit: int = 50) -> List[str]:
        try:
            result = self.client.query(f"""
                SELECT DISTINCT counterparty
                FROM address_transactions
                WHERE address = '{address}'
                ORDER BY block_time DESC
                LIMIT {limit}
            """)
            return [row[0] for row in result.result_rows]
        except Exception as e:
            logger.error(f"Failed to get counterparties: {e}")
            return []
