import logging
import math
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class RiskAssessment:
    risk_score: float
    risk_level: str
    risk_tags: List[str]


class RiskScoringModel:
    HIGH_RISK_THRESHOLD = 0.8
    MEDIUM_RISK_THRESHOLD = 0.5

    def __init__(self):
        self._known_mixer_addresses = {
            "7YwGF8sAAd4rJZ3fF5sL4kE9h2j8pW6qX5vN1cB3mKzL": "tornado_cash",
            "Hf3dXfg5TjY2kL9mN8pQ7wR4sE6tA1dF2gH3jK5lM9n": "wormhole_mixer",
        }
        self._known_exchange_addresses = {
            "5tzFkiKscXHK5ZXCGbXZxdw7gEfv3AZ1srpVCp2reRZB": "binance",
            "AC5RDfQFmDS1deWZos21rjJuvEDkLNaZST2Fufs4uWB1": "coinbase",
            "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM": "okx",
        }
        self._risk_cache: Dict[str, RiskAssessment] = {}

    def assess_address(
        self,
        address: str,
        tx_history: List[Dict[str, Any]],
        address_stats: Dict[str, Any],
        counterparties: List[str],
    ) -> RiskAssessment:
        if address in self._risk_cache:
            cached = self._risk_cache[address]
            return cached

        scores: List[Tuple[float, List[str]]] = []

        scores.append(self._analyze_transaction_patterns(tx_history, address_stats))
        scores.append(self._check_blacklist_associations(address, counterparties))
        scores.append(self._analyze_volume_anomalies(address_stats))
        scores.append(self._detect_gathering_behavior(tx_history, address_stats))
        scores.append(self._analyze_counterparty_network(counterparties))

        final_score = self._aggregate_scores(scores)
        risk_level = self._determine_risk_level(final_score)
        all_tags = self._merge_tags(scores)

        if risk_level == "high" or risk_level == "medium":
            if not any(t in all_tags for t in ["mixer_interaction", "blacklist_associated"]):
                if final_score >= 0.7:
                    all_tags.append("suspicious_gathering")
                if address_stats.get("tx_count", 0) > 100 and len(counterparties) > 20:
                    all_tags.append("high_activity_cluster")

        assessment = RiskAssessment(
            risk_score=round(final_score, 4),
            risk_level=risk_level,
            risk_tags=sorted(list(set(all_tags))),
        )

        self._risk_cache[address] = assessment
        return assessment

    def _aggregate_scores(self, scores: List[Tuple[float, List[str]]]) -> float:
        if not scores:
            return 0.0
        weights = [0.30, 0.25, 0.20, 0.15, 0.10]
        total = 0.0
        for i, (score, _) in enumerate(scores):
            weight = weights[i] if i < len(weights) else 0.05
            total += score * weight
        return min(1.0, total)

    def _merge_tags(self, scores: List[Tuple[float, List[str]]]) -> List[str]:
        tags: List[str] = []
        for _, tag_list in scores:
            tags.extend(tag_list)
        return tags

    def _analyze_transaction_patterns(
        self,
        tx_history: List[Dict[str, Any]],
        address_stats: Dict[str, Any],
    ) -> Tuple[float, List[str]]:
        score = 0.0
        tags: List[str] = []

        if not tx_history:
            return score, tags

        total_txs = len(tx_history)
        amounts = [tx["amount"] for tx in tx_history]
        mean_amount = sum(amounts) / len(amounts) if amounts else 0

        if total_txs >= 10:
            time_diffs = []
            for i in range(1, len(tx_history)):
                t1 = tx_history[i - 1].get("block_time")
                t2 = tx_history[i].get("block_time")
                if hasattr(t1, "timestamp") and hasattr(t2, "timestamp"):
                    diff = abs(t2.timestamp() - t1.timestamp())
                    time_diffs.append(diff)

            if time_diffs:
                avg_interval = sum(time_diffs) / len(time_diffs)
                if avg_interval < 30:
                    score += 0.25
                    tags.append("bot_like_pattern")
                std_interval = (
                    sum((x - avg_interval) ** 2 for x in time_diffs) / len(time_diffs)
                ) ** 0.5
                if std_interval < avg_interval * 0.1:
                    score += 0.15
                    tags.append("automated_transfers")

        if mean_amount > 0:
            large_tx_ratio = sum(
                1 for a in amounts if a > mean_amount * 10
            ) / len(amounts)
            if large_tx_ratio > 0.2:
                score += 0.15
                tags.append("irregular_large_txs")

        if len(amounts) >= 5:
            precision_match = sum(
                1 for a in amounts if a % 1000000000 == 0
            ) / len(amounts)
            if precision_match > 0.6:
                score += 0.10
                tags.append("round_number_txs")

        return min(1.0, score), tags

    def _check_blacklist_associations(
        self, address: str, counterparties: List[str]
    ) -> Tuple[float, List[str]]:
        score = 0.0
        tags: List[str] = []

        if address in self._known_mixer_addresses:
            score = 1.0
            tags.append("known_mixer")
            return score, tags

        if address in self._known_exchange_addresses:
            score = 0.05
            tags.append("known_exchange")
            return score, tags

        mixer_contacts = 0
        for cp in counterparties:
            if cp in self._known_mixer_addresses:
                mixer_contacts += 1

        if mixer_contacts >= 3:
            score += 0.6
            tags.append("mixer_interaction")
        elif mixer_contacts >= 1:
            score += 0.3
            tags.append("mixer_touched")

        return min(1.0, score), tags

    def _analyze_volume_anomalies(
        self, address_stats: Dict[str, Any]
    ) -> Tuple[float, List[str]]:
        score = 0.0
        tags: List[str] = []

        total_volume = address_stats.get("total_volume", 0)
        tx_count = address_stats.get("tx_count", 0)

        if tx_count == 0:
            return score, tags

        avg_volume = total_volume / tx_count

        if total_volume > 1e12:
            score += 0.2
            tags.append("extreme_volume")
        elif total_volume > 1e11:
            score += 0.1

        if avg_volume > 5e10:
            score += 0.2
            tags.append("high_avg_tx_value")
        elif avg_volume > 1e10:
            score += 0.1

        return min(1.0, score), tags

    def _detect_gathering_behavior(
        self,
        tx_history: List[Dict[str, Any]],
        address_stats: Dict[str, Any],
    ) -> Tuple[float, List[str]]:
        score = 0.0
        tags: List[str] = []

        if not tx_history:
            return score, tags

        incoming: Dict[str, int] = {}
        outgoing: Dict[str, int] = {}
        incoming_amounts: Dict[str, int] = {}
        outgoing_amounts: Dict[str, int] = {}

        for tx in tx_history:
            role = tx.get("role", "")
            counterparty = tx.get("counterparty", "")
            amount = tx.get("amount", 0)

            if role == "receiver":
                incoming[counterparty] = incoming.get(counterparty, 0) + 1
                incoming_amounts[counterparty] = incoming_amounts.get(counterparty, 0) + amount
            elif role == "sender":
                outgoing[counterparty] = outgoing.get(counterparty, 0) + 1
                outgoing_amounts[counterparty] = outgoing_amounts.get(counterparty, 0) + amount

        unique_senders = len(incoming)
        unique_receivers = len(outgoing)

        first_seen = address_stats.get("first_seen")
        last_seen = address_stats.get("last_seen")
        age_days = 0
        if first_seen and last_seen and hasattr(first_seen, "timestamp"):
            age_days = (last_seen.timestamp() - first_seen.timestamp()) / 86400

        if unique_senders > 20 and age_days < 7:
            score += 0.35
            tags.append("rapid_funding_cluster")
        elif unique_senders > 50:
            score += 0.25
            tags.append("crowd_funding_pattern")

        if len(incoming) > 0 and len(outgoing) > 0:
            total_in = sum(incoming_amounts.values())
            total_out = sum(outgoing_amounts.values())
            if total_in > 0 and 0.9 < total_out / total_in < 1.1:
                if len(outgoing) == 1 and len(incoming) > 5:
                    score += 0.30
                    tags.append("concentration_hub")
                elif len(incoming) == 1 and len(outgoing) > 5:
                    score += 0.20
                    tags.append("distribution_hub")

        if len(outgoing) == 0 and len(incoming) >= 3:
            score += 0.2
            tags.append("only_receiving_suspect")

        return min(1.0, score), tags

    def _analyze_counterparty_network(
        self, counterparties: List[str]
    ) -> Tuple[float, List[str]]:
        score = 0.0
        tags: List[str] = []

        if len(counterparties) < 5:
            return score, tags

        known_exposure = 0
        for cp in counterparties:
            if cp in self._risk_cache:
                if self._risk_cache[cp].risk_level == "high":
                    known_exposure += 2
                elif self._risk_cache[cp].risk_level == "medium":
                    known_exposure += 1

        exposure_ratio = known_exposure / len(counterparties)
        if exposure_ratio > 0.3:
            score += 0.4
            tags.append("high_risk_neighborhood")
        elif exposure_ratio > 0.15:
            score += 0.2
            tags.append("risky_associates")

        return min(1.0, score), tags

    def _determine_risk_level(self, score: float) -> str:
        if score >= self.HIGH_RISK_THRESHOLD:
            return "high"
        elif score >= self.MEDIUM_RISK_THRESHOLD:
            return "medium"
        else:
            return "low"

    def invalidate_cache(self, address: str = None) -> None:
        if address:
            self._risk_cache.pop(address, None)
        else:
            self._risk_cache.clear()
