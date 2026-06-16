import { Controller, Get, Param, Query, Res, Sse } from '@nestjs/common';
import { Response } from 'express';
import { ClickHouseService, RiskAddress, ThroughputPoint, LiveTransaction } from '../clickhouse/clickhouse.service';
import { AIDiagnosisService, StreamChunk } from '../services/ai-diagnosis.service';

@Controller('api')
export class CryptoController {
  constructor(
    private readonly clickHouseService: ClickHouseService,
    private readonly aiDiagnosisService: AIDiagnosisService,
  ) {}

  @Get('stats')
  async getStats() {
    const stats = await this.clickHouseService.getAggregatedStats();
    return {
      success: true,
      data: {
        ...stats,
        generated_at: new Date().toISOString(),
      },
    };
  }

  @Get('risk-addresses')
  async getRiskAddresses(
    @Query('min_score') minScore?: string,
    @Query('level') level?: string,
    @Query('limit') limit?: string,
  ) {
    const minRiskScore = minScore ? parseFloat(minScore) : 0.5;
    const pageLimit = limit ? parseInt(limit, 10) : 200;
    let addresses = await this.clickHouseService.getRiskAddresses(minRiskScore, pageLimit);
    if (level) {
      addresses = addresses.filter((a) => a.risk_level === level);
    }
    return {
      success: true,
      count: addresses.length,
      data: addresses,
    };
  }

  @Get('risk-addresses/high')
  async getHighRiskAddresses(@Query('limit') limit?: string) {
    const pageLimit = limit ? parseInt(limit, 10) : 100;
    const data = await this.clickHouseService.getHighRiskAddresses(pageLimit);
    return { success: true, count: data.length, data };
  }

  @Get('address/:address/risk')
  async getAddressRisk(@Param('address') address: string) {
    const data = await this.clickHouseService.getAddressRisk(address);
    return {
      success: true,
      data: data || { message: 'Address not found in risk registry', address },
    };
  }

  @Get('throughput')
  async getThroughput(@Query('minutes') minutes?: string) {
    const mins = minutes ? parseInt(minutes, 10) : 60;
    const data = await this.clickHouseService.getThroughputHistory(mins);
    return { success: true, count: data.length, data };
  }

  @Get('transactions/large')
  async getLargeTransactions(@Query('limit') limit?: string) {
    const pageLimit = limit ? parseInt(limit, 10) : 50;
    const data = await this.clickHouseService.getRecentLargeTransactions(pageLimit);
    return { success: true, count: data.length, data };
  }

  @Get('address/:address/diagnose')
  async getAddressDiagnosis(
    @Param('address') address: string,
    @Query('stream') stream?: string,
  ) {
    const riskData = await this.clickHouseService.getAddressRisk(address);

    const riskScore = riskData?.risk_score ?? 0.5;
    const riskLevel = riskData?.risk_level ?? 'medium';
    const riskTags = riskData?.risk_tags ?? [];
    const txCount = riskData?.total_transactions ?? 0;
    const totalVolume = riskData?.total_volume ?? 0;

    if (stream === 'true' || stream === '1') {
      return { message: 'Use SSE endpoint for streaming: /api/address/:address/diagnose/stream' };
    }

    const diagnosis = await this.aiDiagnosisService.getDiagnosis(
      address,
      riskScore,
      riskLevel,
      riskTags,
      txCount,
      totalVolume,
      Math.floor(txCount * 0.3),
    );

    return {
      success: true,
      data: diagnosis,
    };
  }

  @Sse('address/:address/diagnose/stream')
  async streamAddressDiagnosis(
    @Param('address') address: string,
    @Res() res: Response,
  ) {
    const riskData = await this.clickHouseService.getAddressRisk(address);

    const riskScore = riskData?.risk_score ?? 0.5;
    const riskLevel = riskData?.risk_level ?? 'medium';
    const riskTags = riskData?.risk_tags ?? [];
    const txCount = riskData?.total_transactions ?? 0;
    const totalVolume = riskData?.total_volume ?? 0;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    this.aiDiagnosisService.streamDiagnosis(
      address,
      riskScore,
      riskLevel,
      riskTags,
      (chunk: StreamChunk) => {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      },
      (_result) => {
        res.end();
      },
      (error) => {
        res.write(`data: ${JSON.stringify({ type: 'error', content: error.message, progress: 1 })}\n\n`);
        res.end();
      },
      txCount,
      totalVolume,
      Math.floor(txCount * 0.3),
    );

    return res;
  }
}
