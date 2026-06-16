import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as http from 'http';

export interface DiagnosisResult {
  address: string;
  risk_score: number;
  risk_level: string;
  risk_tags: string[];
  diagnosis: string;
  confidence: number;
  warnings: string[];
  suggestions: string[];
}

export interface StreamChunk {
  type: string;
  content: string;
  progress: number;
  metadata?: {
    risk_score: number;
    risk_level: string;
    risk_tags: string[];
    warnings: string[];
    suggestions: string[];
    confidence: number;
  };
}

@Injectable()
export class AIDiagnosisService {
  private readonly logger = new Logger(AIDiagnosisService.name);
  private aiServiceUrl: string;
  private aiServicePort: number;
  private useMock: boolean;

  constructor(private configService: ConfigService) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL', 'localhost');
    this.aiServicePort = this.configService.get<number>('AI_SERVICE_PORT', 5001);
    this.useMock = this.configService.get<boolean>('AI_USE_MOCK', true);
  }

  async getDiagnosis(
    address: string,
    riskScore: number,
    riskLevel: string,
    riskTags: string[],
    txCount: number = 0,
    totalVolume: number = 0,
    uniqueCounterparties: number = 0,
  ): Promise<DiagnosisResult> {
    if (this.useMock) {
      return this.generateMockDiagnosis(address, riskScore, riskLevel, riskTags, txCount, totalVolume, uniqueCounterparties);
    }

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        address,
        risk_score: riskScore,
        risk_level: riskLevel,
        risk_tags: riskTags,
        tx_count: txCount,
        total_volume: totalVolume,
        unique_counterparties: uniqueCounterparties,
        stream: false,
      });

      const options = {
        hostname: this.aiServiceUrl,
        port: this.aiServicePort,
        path: '/api/diagnose',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 10000,
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (e) {
            reject(new Error('Failed to parse AI diagnosis response'));
          }
        });
      });

      req.on('error', (e) => {
        this.logger.error(`AI service error: ${e.message}`);
        resolve(this.generateMockDiagnosis(address, riskScore, riskLevel, riskTags, txCount, totalVolume, uniqueCounterparties));
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(this.generateMockDiagnosis(address, riskScore, riskLevel, riskTags, txCount, totalVolume, uniqueCounterparties));
      });

      req.write(postData);
      req.end();
    });
  }

  async streamDiagnosis(
    address: string,
    riskScore: number,
    riskLevel: string,
    riskTags: string[],
    onChunk: (chunk: StreamChunk) => void,
    onComplete: (result: DiagnosisResult) => void,
    onError: (error: Error) => void,
    txCount: number = 0,
    totalVolume: number = 0,
    uniqueCounterparties: number = 0,
  ): Promise<void> {
    if (this.useMock) {
      this.streamMockDiagnosis(
        address,
        riskScore,
        riskLevel,
        riskTags,
        txCount,
        totalVolume,
        uniqueCounterparties,
        onChunk,
        onComplete,
      );
      return;
    }

    const postData = JSON.stringify({
      address,
      risk_score: riskScore,
      risk_level: riskLevel,
      risk_tags: riskTags,
      tx_count: txCount,
      total_volume: totalVolume,
      unique_counterparties: uniqueCounterparties,
      stream: true,
    });

    const options = {
      hostname: this.aiServiceUrl,
      port: this.aiServicePort,
      path: '/api/diagnose/stream',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        Accept: 'text/event-stream',
      },
      timeout: 30000,
    };

    const req = http.request(options, (res) => {
      let buffer = '';
      let fullDiagnosis = '';
      let finalResult: DiagnosisResult | null = null;

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            try {
              const parsed = JSON.parse(dataStr) as StreamChunk;
              if (parsed.type === 'text') {
                fullDiagnosis += parsed.content;
                onChunk(parsed);
              } else if (parsed.type === 'complete') {
                finalResult = {
                  address,
                  risk_score: parsed.metadata?.risk_score || riskScore,
                  risk_level: parsed.metadata?.risk_level || riskLevel,
                  risk_tags: parsed.metadata?.risk_tags || riskTags,
                  diagnosis: fullDiagnosis,
                  confidence: parsed.metadata?.confidence || 0.7,
                  warnings: parsed.metadata?.warnings || [],
                  suggestions: parsed.metadata?.suggestions || [],
                };
              }
            } catch (e) {
              this.logger.warn(`Failed to parse SSE data: ${dataStr}`);
            }
          }
        }
      });

      res.on('end', () => {
        if (finalResult) {
          onComplete(finalResult);
        } else {
          onComplete(
            this.generateMockDiagnosis(address, riskScore, riskLevel, riskTags, txCount, totalVolume, uniqueCounterparties),
          );
        }
      });

      res.on('error', (e) => {
        this.logger.error(`Stream error: ${e.message}`);
        onError(e as Error);
      });
    });

    req.on('error', (e) => {
      this.logger.error(`AI service stream error: ${e.message}`);
      this.streamMockDiagnosis(
        address,
        riskScore,
        riskLevel,
        riskTags,
        txCount,
        totalVolume,
        uniqueCounterparties,
        onChunk,
        onComplete,
      );
    });

    req.on('timeout', () => {
      req.destroy();
      onError(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  }

  private streamMockDiagnosis(
    address: string,
    riskScore: number,
    riskLevel: string,
    riskTags: string[],
    txCount: number,
    totalVolume: number,
    uniqueCounterparties: number,
    onChunk: (chunk: StreamChunk) => void,
    onComplete: (result: DiagnosisResult) => void,
  ): void {
    const fullResult = this.generateMockDiagnosis(
      address,
      riskScore,
      riskLevel,
      riskTags,
      txCount,
      totalVolume,
      uniqueCounterparties,
    );

    const fullText = fullResult.diagnosis;
    let position = 0;

    const interval = setInterval(() => {
      const chunkSize = Math.floor(Math.random() * 4) + 2;
      const end = Math.min(position + chunkSize, fullText.length);
      const content = fullText.slice(position, end);
      position = end;

      onChunk({
        type: 'text',
        content,
        progress: position / fullText.length,
      });

      if (position >= fullText.length) {
        clearInterval(interval);
        setTimeout(() => {
          onChunk({
            type: 'complete',
            content: '',
            progress: 1.0,
            metadata: {
              risk_score: fullResult.risk_score,
              risk_level: fullResult.risk_level,
              risk_tags: fullResult.risk_tags,
              warnings: fullResult.warnings,
              suggestions: fullResult.suggestions,
              confidence: fullResult.confidence,
            },
          });
          onComplete(fullResult);
        }, 100);
      }
    }, 25);
  }

  private generateMockDiagnosis(
    address: string,
    riskScore: number,
    riskLevel: string,
    riskTags: string[],
    txCount: number,
    totalVolume: number,
    uniqueCounterparties: number,
  ): DiagnosisResult {
    const levelDescriptions = {
      high: '这个地址风险极高，建议立即采取防范措施。',
      medium: '该地址存在一定风险，建议持续关注其动态。',
      low: '该地址整体风险较低，但仍需保持基本警惕。',
    };

    const tagExplanations: Record<string, string> = {
      mixer_interaction: '• 与混币器有直接资金往来，资金来源不明',
      blacklist_associated: '• 与已知黑名单地址存在关联',
      suspicious_gathering: '• 存在明显的资金归集行为模式',
      concentration_hub: '• 是资金集中枢纽，汇聚大量来源资金',
      high_activity_cluster: '• 交易活跃度异常偏高，疑似自动化操作',
      rapid_fund_accumulation: '• 资金快速积累，可能在为大额转账做准备',
      only_receives_no_sends: '• 只进不出，疑似归集钱包',
      bot_like_patterns: '• 交易时间间隔高度规律，疑似机器人',
      volume_spike: '• 交易量突然暴增，存在异常波动',
      high_risk_neighbors: '• 其交易对手方中有多个高风险地址',
      new_address_high_volume: '• 新建地址却有巨量交易，可疑',
      irregular_large_txs: '• 频繁出现不规则大额交易',
    };

    let diagnosis = levelDescriptions[riskLevel as keyof typeof levelDescriptions] || levelDescriptions.medium;

    const tagDescriptions = riskTags
      .slice(0, 4)
      .map((tag) => tagExplanations[tag] || `• 风险标签：${tag}`);

    if (tagDescriptions.length > 0) {
      diagnosis += '主要风险特征包括：' + tagDescriptions.join('');
    }

    if (totalVolume > 0) {
      let volumeDesc = '';
      if (totalVolume >= 1e12) {
        volumeDesc = `累计交易额约 ${(totalVolume / 1e12).toFixed(1)} 万亿`;
      } else if (totalVolume >= 1e9) {
        volumeDesc = `累计交易额约 ${(totalVolume / 1e9).toFixed(1)} 亿`;
      } else if (totalVolume >= 1e6) {
        volumeDesc = `累计交易额约 ${(totalVolume / 1e6).toFixed(1)} 百万`;
      } else {
        volumeDesc = `累计交易额约 ${(totalVolume / 1e3).toFixed(0)} 千`;
      }
      if (txCount > 0) {
        volumeDesc += `，涉及交易 ${txCount} 笔`;
      }
      diagnosis += `从交易规模来看，该地址${volumeDesc}。`;
    }

    if (uniqueCounterparties > 0) {
      if (uniqueCounterparties > 50) {
        diagnosis += `交易对手方数量较多（${uniqueCounterparties}个），资金网络较为复杂。`;
      } else {
        diagnosis += `有 ${uniqueCounterparties} 个交易对手方。`;
      }
    }

    if (riskLevel === 'high') {
      diagnosis += '综上所述，这个地址属于【高风险】级别，建议采取严格的风控措施。';
    } else if (riskLevel === 'medium') {
      diagnosis += '综上所述，该地址为【中等风险】，建议保持关注并设置告警。';
    } else {
      diagnosis += '综上所述，该地址风险偏低，属于【低风险】范畴。';
    }

    const warnings: string[] = [];
    if (riskTags.includes('mixer_interaction')) {
      warnings.push('⚠️ 混币器关联：资金来源可能无法溯源，请审慎评估');
    }
    if (riskTags.includes('suspicious_gathering')) {
      warnings.push('⚠️ 归集行为：疑似资金归集钱包，存在跑路风险');
    }
    if (warnings.length === 0 && riskLevel === 'high') {
      warnings.push('⚠️ 注意：与该地址交易可能面临合规风险');
    }

    const suggestions: string[] = [
      '建议对此地址设置实时监控和交易告警',
      '可对该地址设置风控限额，防范未知风险',
      '建议定期复核该地址的风险评级',
    ];

    const confidence = Math.min(0.95, 0.5 + Math.min(txCount, 100) * 0.003 + riskTags.length * 0.03);

    return {
      address,
      risk_score: riskScore,
      risk_level: riskLevel,
      risk_tags: riskTags,
      diagnosis,
      confidence: Math.round(confidence * 10000) / 10000,
      warnings,
      suggestions,
    };
  }
}
