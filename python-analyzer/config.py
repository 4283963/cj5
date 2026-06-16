import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SOLANA_RPC_URL: str = os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
    CLICKHOUSE_HOST: str = os.getenv("CLICKHOUSE_HOST", "localhost")
    CLICKHOUSE_PORT: int = int(os.getenv("CLICKHOUSE_PORT", "8123"))
    CLICKHOUSE_USER: str = os.getenv("CLICKHOUSE_USER", "default")
    CLICKHOUSE_PASSWORD: str = os.getenv("CLICKHOUSE_PASSWORD", "")
    CLICKHOUSE_DATABASE: str = os.getenv("CLICKHOUSE_DATABASE", "crypto_sentinel")
    LARGE_TRANSACTION_THRESHOLD: int = int(
        os.getenv("LARGE_TRANSACTION_THRESHOLD", "10000000000")
    )
    RISK_MODEL_THRESHOLD: float = float(os.getenv("RISK_MODEL_THRESHOLD", "0.7"))
    POLL_INTERVAL: int = int(os.getenv("POLL_INTERVAL", "2"))
