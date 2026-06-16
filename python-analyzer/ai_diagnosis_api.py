import asyncio
import logging
import random
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import uvicorn

from ai_diagnosis import AIDiagnosisEngine
from risk_scoring_model import RiskScoringModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Crypto Sentinel AI Diagnosis API",
    description="AI-powered risk diagnosis for Solana addresses",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

diagnosis_engine = AIDiagnosisEngine()
risk_model = RiskScoringModel()


class DiagnosisRequest(BaseModel):
    address: str
    risk_score: float = Field(default=0.5, ge=0, le=1)
    risk_level: str = Field(default="medium")
    risk_tags: List[str] = Field(default_factory=list)
    tx_count: int = Field(default=0, ge=0)
    total_volume: float = Field(default=0.0, ge=0)
    unique_counterparties: int = Field(default=0, ge=0)
    stream: bool = Field(default=True)


class DiagnosisResponse(BaseModel):
    address: str
    risk_score: float
    risk_level: str
    risk_tags: List[str]
    diagnosis: str
    confidence: float
    warnings: List[str]
    suggestions: List[str]


class StreamChunk(BaseModel):
    type: str
    content: str
    progress: float
    metadata: Dict[str, Any] = Field(default_factory=dict)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ai-diagnosis"}


@app.post("/api/diagnose", response_model=DiagnosisResponse)
async def diagnose_address(request: DiagnosisRequest):
    try:
        result = diagnosis_engine.generate_diagnosis(
            address=request.address,
            risk_score=request.risk_score,
            risk_level=request.risk_level,
            risk_tags=request.risk_tags,
            tx_count=request.tx_count,
            total_volume=request.total_volume,
            unique_counterparties=request.unique_counterparties,
        )

        return DiagnosisResponse(
            address=result.address,
            risk_score=result.risk_score,
            risk_level=result.risk_level,
            risk_tags=result.risk_tags,
            diagnosis=result.diagnosis,
            confidence=result.confidence,
            warnings=result.warnings,
            suggestions=result.suggestions,
        )
    except Exception as e:
        logger.error(f"Diagnosis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/diagnose/stream")
async def diagnose_address_stream(request: DiagnosisRequest):
    try:
        async def generate():
            for chunk in diagnosis_engine.generate_streaming_diagnosis(
                address=request.address,
                risk_score=request.risk_score,
                risk_level=request.risk_level,
                risk_tags=request.risk_tags,
                tx_count=request.tx_count,
                total_volume=request.total_volume,
                unique_counterparties=request.unique_counterparties,
                chunk_size=random.randint(2, 5),
            ):
                await asyncio.sleep(random.uniform(0.01, 0.04))
                import json
                yield f"data: {json.dumps(chunk)}\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except Exception as e:
        logger.error(f"Stream diagnosis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/diagnose/{address}")
async def get_diagnosis_by_address(
    address: str,
    stream: bool = True,
):
    mock_data = _generate_mock_address_data(address)

    request = DiagnosisRequest(
        address=address,
        risk_score=mock_data["risk_score"],
        risk_level=mock_data["risk_level"],
        risk_tags=mock_data["risk_tags"],
        tx_count=mock_data["tx_count"],
        total_volume=mock_data["total_volume"],
        unique_counterparties=mock_data["unique_counterparties"],
        stream=stream,
    )

    if stream:
        return await diagnose_address_stream(request)
    else:
        return await diagnose_address(request)


def _generate_mock_address_data(address: str) -> Dict[str, Any]:
    seed = sum(ord(c) for c in address)
    random.seed(seed)

    risk_score = random.uniform(0.15, 0.98)
    if risk_score >= 0.8:
        risk_level = "high"
    elif risk_score >= 0.5:
        risk_level = "medium"
    else:
        risk_level = "low"

    all_tags = [
        "mixer_interaction",
        "blacklist_associated",
        "suspicious_gathering",
        "concentration_hub",
        "high_activity_cluster",
        "rapid_fund_accumulation",
        "only_receives_no_sends",
        "bot_like_patterns",
        "volume_spike",
        "high_risk_neighbors",
        "new_address_high_volume",
        "irregular_large_txs",
    ]

    num_tags = random.randint(1, 6)
    risk_tags = random.sample(all_tags, min(num_tags, len(all_tags)))

    tx_count = random.randint(5, 500)
    total_volume = random.uniform(1e6, 5e11)
    unique_counterparties = random.randint(2, 80)

    random.seed()

    return {
        "risk_score": round(risk_score, 4),
        "risk_level": risk_level,
        "risk_tags": risk_tags,
        "tx_count": tx_count,
        "total_volume": total_volume,
        "unique_counterparties": unique_counterparties,
    }


if __name__ == "__main__":
    logger.info("Starting AI Diagnosis Service on port 5001")
    uvicorn.run(app, host="0.0.0.0", port=5001, log_level="info")
