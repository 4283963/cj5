import { Controller, Get, Param, Query } from '@nestjs/common';
import { ClickHouseService, RiskAddress, ThroughputPoint, LiveTransaction } from '../clickhouse/clickhouse.service';

@Controller('api')
export class CryptoController {
  constructor(private readonly clickHouseService: ClickHouseService) {}

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
}
