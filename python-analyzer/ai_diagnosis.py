import random
import re
from typing import Dict, Any, List, Optional
from dataclasses import dataclass


@dataclass
class AIDiagnosisResult:
    address: str
    risk_score: float
    risk_level: str
    risk_tags: List[str]
    diagnosis: str
    confidence: float
    warnings: List[str]
    suggestions: List[str]


class AIDiagnosisEngine:
    def __init__(self):
        self._risk_templates = {
            "high": [
                "这个地址风险极高，建议立即采取防范措施。",
                "该地址表现出强烈的可疑特征，存在重大安全风险。",
                "经过综合分析，该地址属于高风险范畴，需重点关注。",
            ],
            "medium": [
                "该地址存在一定风险，建议持续关注其动态。",
                "综合评估显示，这个地址有中度风险特征。",
                "该地址的交易行为存在一些值得警惕的信号。",
            ],
            "low": [
                "该地址整体风险较低，但仍需保持基本警惕。",
                "从现有数据来看，这个地址相对安全。",
                "该地址未发现明显风险特征，属于正常水平。",
            ],
        }

        self._tag_explanations = {
            "mixer_interaction": "与混币器有直接资金往来，资金来源不明",
            "blacklist_associated": "与已知黑名单地址存在关联",
            "suspicious_gathering": "存在明显的资金归集行为模式",
            "concentration_hub": "是资金集中枢纽，汇聚大量来源资金",
            "high_activity_cluster": "交易活跃度异常偏高，疑似自动化操作",
            "rapid_fund_accumulation": "资金快速积累，可能在为大额转账做准备",
            "only_receives_no_sends": "只进不出，疑似归集钱包",
            "bot_like_patterns": "交易时间间隔高度规律，疑似机器人",
            "volume_spike": "交易量突然暴增，存在异常波动",
            "high_risk_neighbors": "其交易对手方中有多个高风险地址",
            "new_address_high_volume": "新建地址却有巨量交易，可疑",
            "irregular_large_txs": "频繁出现不规则大额交易",
        }

        self._suggestions_pool = [
            "建议对此地址设置实时监控告警",
            "可以考虑将该地址加入风险观察名单",
            "建议深入追溯其资金来源和去向",
            "可对该地址相关的交易设置风控限额",
            "建议定期复核该地址的风险评级",
            "可联合多个数据源交叉验证风险程度",
        ]

        self._warnings_pool = [
            "⚠️ 注意：与该地址交易可能面临合规风险",
            "⚠️ 该地址资金流向较为复杂，需谨慎评估",
            "⚠️ 存在多层资金跳转，增加了追溯难度",
            "⚠️ 风险评分可能随交易行为动态变化",
        ]

    def generate_diagnosis(
        self,
        address: str,
        risk_score: float,
        risk_level: str,
        risk_tags: List[str],
        tx_count: int = 0,
        total_volume: float = 0,
        unique_counterparties: int = 0,
    ) -> AIDiagnosisResult:
        level = risk_level if risk_level in self._risk_templates else "medium"

        intro = random.choice(self._risk_templates[level])

        tag_details = self._format_tag_details(risk_tags)

        volume_desc = self._format_volume_description(total_volume, tx_count)

        behavior_analysis = self._generate_behavior_analysis(
            risk_tags, tx_count, total_volume, unique_counterparties
        )

        conclusion = self._generate_conclusion(risk_score, risk_level)

        full_diagnosis = f"{intro}{tag_details}{volume_desc}{behavior_analysis}{conclusion}"

        full_diagnosis = self._polish_text(full_diagnosis)

        warnings = self._select_warnings(risk_level, risk_tags)
        suggestions = self._select_suggestions(risk_level, risk_tags)

        confidence = self._calculate_confidence(tx_count, total_volume, len(risk_tags))

        return AIDiagnosisResult(
            address=address,
            risk_score=round(risk_score, 4),
            risk_level=risk_level,
            risk_tags=risk_tags,
            diagnosis=full_diagnosis,
            confidence=round(confidence, 4),
            warnings=warnings,
            suggestions=suggestions,
        )

    def generate_streaming_diagnosis(
        self,
        address: str,
        risk_score: float,
        risk_level: str,
        risk_tags: List[str],
        tx_count: int = 0,
        total_volume: float = 0,
        unique_counterparties: int = 0,
        chunk_size: int = 3,
    ):
        result = self.generate_diagnosis(
            address, risk_score, risk_level, risk_tags, tx_count, total_volume, unique_counterparties
        )

        text = result.diagnosis
        for i in range(0, len(text), chunk_size):
            chunk = text[i:i + chunk_size]
            yield {
                "type": "text",
                "content": chunk,
                "progress": min(1.0, (i + len(chunk)) / len(text)),
            }

        yield {
            "type": "complete",
            "content": "",
            "progress": 1.0,
            "metadata": {
                "risk_score": result.risk_score,
                "risk_level": result.risk_level,
                "risk_tags": result.risk_tags,
                "warnings": result.warnings,
                "suggestions": result.suggestions,
                "confidence": result.confidence,
            },
        }

    def _format_tag_details(self, tags: List[str]) -> str:
        if not tags:
            return "目前未发现明确的风险标签。"

        explanations = []
        for tag in tags[:5]:
            exp = self._tag_explanations.get(tag, f"风险标签：{tag}")
            explanations.append(f"• {exp}")

        if len(tags) > 5:
            explanations.append(f"• 另有 {len(tags) - 5} 项次级风险特征")

        return "主要风险特征包括：" + "".join(explanations)

    def _format_volume_description(self, volume: float, tx_count: int) -> str:
        if volume <= 0 and tx_count <= 0:
            return ""

        volume_desc = ""
        if volume >= 1e12:
            vol = volume / 1e12
            volume_desc = f"累计交易额约 {vol:.1f} 万亿"
        elif volume >= 1e9:
            vol = volume / 1e9
            volume_desc = f"累计交易额约 {vol:.1f} 亿"
        elif volume >= 1e6:
            vol = volume / 1e6
            volume_desc = f"累计交易额约 {vol:.1f} 百万"
        else:
            vol = volume / 1e3
            volume_desc = f"累计交易额约 {vol:.0f} 千"

        if tx_count > 0:
            volume_desc += f"，涉及交易 {tx_count} 笔"

        return f"从交易规模来看，该地址{volume_desc}。"

    def _generate_behavior_analysis(
        self, tags: List[str], tx_count: int, volume: float, counterparties: int
    ) -> str:
        analyses = []

        if "bot_like_patterns" in tags or "high_activity_cluster" in tags:
            analyses.append("交易频次和时间分布呈现出较强的规律性，疑似自动化程序在操作。")

        if "suspicious_gathering" in tags or "concentration_hub" in tags:
            analyses.append("资金流向呈现明显的集中趋势，有一定概率是资金归集钱包。")

        if "mixer_interaction" in tags:
            analyses.append("与混币服务有过接触，意味着部分资金的来源可能难以追溯。")

        if "only_receives_no_sends" in tags:
            analyses.append("该地址目前只收不发，资金去向尚不明确，需要持续观察。")

        if "rapid_fund_accumulation" in tags:
            analyses.append("近期资金积累速度明显加快，可能预示着即将有大额动作。")

        if counterparties > 0:
            if counterparties > 50:
                analyses.append(f"交易对手方数量较多（{counterparties}个），资金网络较为复杂。")
            elif counterparties > 10:
                analyses.append(f"有 {counterparties} 个交易对手方，属于正常社交范围。")

        if not analyses:
            if tx_count > 0:
                analyses.append("交易行为整体较为平稳，未观察到明显异常模式。")
            else:
                analyses.append("由于历史数据有限，行为模式分析准确度可能有所下降。")

        return "行为模式分析：" + "".join(analyses)

    def _generate_conclusion(self, score: float, level: str) -> str:
        if level == "high":
            if score >= 0.95:
                return "综上所述，这个地址的风险等级为【极高】，强烈建议避免与其发生任何交易。"
            elif score >= 0.85:
                return "综上所述，这个地址属于【高风险】级别，建议采取严格的风控措施。"
            else:
                return "综上所述，这个地址被评定为【高风险】，需要重点关注和监控。"
        elif level == "medium":
            if score >= 0.7:
                return "综上所述，该地址为【中高风险】，建议提高警惕并设置告警。"
            else:
                return "综上所述，该地址属于【中等风险】，保持常规监控即可。"
        else:
            if score <= 0.2:
                return "综上所述，该地址风险较低，【基本安全】，可正常交易。"
            else:
                return "综上所述，该地址风险偏低，属于【低风险】范畴，无需过度担忧。"

    def _polish_text(self, text: str) -> str:
        text = text.replace("。。", "。")
        text = text.replace("，，", "，")
        text = text.replace("：。", "：")

        text = re.sub(r"([。！？])\1+", r"\1", text)

        sentences = re.split(r"(?<=[。！？])", text)
        sentences = [s.strip() for s in sentences if s.strip()]

        if len(sentences) > 8:
            sentences = sentences[:8]

        return "".join(sentences)

    def _select_warnings(self, level: str, tags: List[str]) -> List[str]:
        warnings = []
        num_warnings = 2 if level == "high" else 1 if level == "medium" else 0

        if "mixer_interaction" in tags:
            warnings.append("⚠️ 混币器关联：资金来源可能无法溯源，请审慎评估")
        if "blacklist_associated" in tags:
            warnings.append("⚠️ 黑名单关联：与已知风险地址存在资金往来")
        if "suspicious_gathering" in tags:
            warnings.append("⚠️ 归集行为：疑似资金归集钱包，存在跑路风险")

        remaining = num_warnings - len(warnings)
        if remaining > 0:
            pool = [w for w in self._warnings_pool if w not in warnings]
            warnings.extend(random.sample(pool, min(remaining, len(pool))))

        return warnings[:3]

    def _select_suggestions(self, level: str, tags: List[str]) -> List[str]:
        suggestions = []
        num_suggestions = 3 if level == "high" else 2 if level == "medium" else 1

        if "mixer_interaction" in tags or "blacklist_associated" in tags:
            suggestions.append("建议对此地址设置实时监控和交易告警")

        if "suspicious_gathering" in tags or "concentration_hub" in tags:
            suggestions.append("建议深入追溯资金链路，识别最终受益方")

        if "bot_like_patterns" in tags:
            suggestions.append("可对该地址设置API调用频率限制，防止恶意刷量")

        remaining = num_suggestions - len(suggestions)
        if remaining > 0:
            pool = [s for s in self._suggestions_pool if s not in suggestions]
            suggestions.extend(random.sample(pool, min(remaining, len(pool))))

        return suggestions[:3]

    def _calculate_confidence(self, tx_count: int, volume: float, tag_count: int) -> float:
        score = 0.5

        if tx_count >= 100:
            score += 0.25
        elif tx_count >= 30:
            score += 0.15
        elif tx_count >= 10:
            score += 0.08
        elif tx_count > 0:
            score += 0.03

        if volume >= 1e10:
            score += 0.15
        elif volume >= 1e8:
            score += 0.1
        elif volume >= 1e6:
            score += 0.05

        if tag_count >= 5:
            score += 0.1
        elif tag_count >= 3:
            score += 0.05

        return min(0.98, max(0.3, score))
