import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { ClickHouseService, RiskAddress, ThroughputPoint, LiveTransaction } from '../clickhouse/clickhouse.service';

interface BroadcastPayload {
  timestamp: number;
  risky_nodes: RiskAddress[];
  throughput: ThroughputPoint | null;
  live_transactions: LiveTransaction[];
  aggregated: {
    total_risky_addresses: number;
    high_risk_count: number;
    medium_risk_count: number;
    total_volume_24h: number;
    total_txs_24h: number;
  };
}

class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  constructor(maxTokens: number, refillPerSecond: number) {
    this.maxTokens = maxTokens;
    this.refillRate = refillPerSecond;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  tryConsume(tokensNeeded: number = 1): boolean {
    this.refill();
    if (this.tokens >= tokensNeeded) {
      this.tokens -= tokensNeeded;
      return true;
    }
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const newTokens = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }

  getTokenCount(): number {
    this.refill();
    return this.tokens;
  }
}

@WebSocketGateway({
  namespace: '/crypto-stream',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 15000,
  pingTimeout: 8000,
  maxHttpBufferSize: 5e6,
})
export class CryptoStreamGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(CryptoStreamGateway.name);
  private broadcastInterval: NodeJS.Timeout;
  private intervalMs: number;
  private connectedClients = 0;

  private readonly globalBucket: TokenBucket;
  private readonly clientBuckets = new Map<string, TokenBucket>();
  private readonly messageSizeLimits = {
    maxNodes: 60,
    maxTransactions: 8,
    maxThroughputHistory: 60,
  };

  private readonly adaptiveThrottle = {
    currentInterval: 1500,
    minInterval: 800,
    maxInterval: 4000,
    loadFactor: 1.0,
    lastLoadCheck: 0,
  };

  private lastSentHashes = {
    nodes: new Set<string>(),
    transactions: new Set<string>(),
  };

  private previousPayload: BroadcastPayload | null = null;

  constructor(
    private clickHouseService: ClickHouseService,
    private configService: ConfigService,
  ) {
    this.intervalMs = this.configService.get<number>('BROADCAST_INTERVAL', 1500);
    this.globalBucket = new TokenBucket(100, 30);
  }

  afterInit(server: Server) {
    this.logger.log(`WebSocket Gateway initialized on namespace /crypto-stream`);
    this.logger.log(`Token bucket: 100 tokens, 30/sec refill`);
    this.logger.log(`Message limits: nodes=${this.messageSizeLimits.maxNodes}, txs=${this.messageSizeLimits.maxTransactions}`);
    this.startBroadcasting();
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.connectedClients++;
    this.clientBuckets.set(client.id, new TokenBucket(20, 5));

    this.logger.log(
      `Client connected: ${client.id} | Total: ${this.connectedClients}`,
    );

    client.emit('connected', {
      message: 'Welcome to Crypto Sentinel Stream',
      timestamp: Date.now(),
      server_time: new Date().toISOString(),
      limits: this.messageSizeLimits,
    });

    this.sendInitialSnapshot(client);
  }

  handleDisconnect(client: Socket) {
    this.connectedClients--;
    this.clientBuckets.delete(client.id);
    this.logger.log(
      `Client disconnected: ${client.id} | Total: ${this.connectedClients}`,
    );
  }

  @SubscribeMessage('request_snapshot')
  async handleRequestSnapshot(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const bucket = this.clientBuckets.get(client.id);
    if (bucket && !bucket.tryConsume(3)) {
      client.emit('rate_limited', {
        message: 'Rate limit exceeded for snapshot requests',
        retry_after: 1000,
      });
      return;
    }

    this.logger.debug(`Snapshot requested by ${client.id}`);
    await this.sendInitialSnapshot(client);
  }

  @SubscribeMessage('subscribe_address')
  handleSubscribeAddress(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { address: string },
  ) {
    const bucket = this.clientBuckets.get(client.id);
    if (bucket && !bucket.tryConsume(1)) return;

    if (payload?.address) {
      client.join(`addr:${payload.address}`);
      this.logger.log(`${client.id} subscribed to address ${payload.address}`);
      client.emit('subscribed', { address: payload.address });
    }
  }

  private startBroadcasting() {
    this.logger.log(`Starting adaptive broadcast loop at ${this.intervalMs}ms base interval`);
    this.broadcastInterval = setInterval(async () => {
      if (this.connectedClients === 0) return;

      this.checkSystemLoad();

      const waitUntil = this.adaptiveThrottle.currentInterval;
      const now = Date.now();
      if (now - this.adaptiveThrottle.lastLoadCheck < waitUntil) return;
      this.adaptiveThrottle.lastLoadCheck = now;

      if (!this.globalBucket.tryConsume(1)) {
        this.logger.warn('Global token bucket exhausted, skipping broadcast');
        return;
      }

      try {
        await this.broadcastRealtimeData();
      } catch (e) {
        this.logger.error(`Broadcast error: ${e}`);
      }
    }, 200);
  }

  private checkSystemLoad(): void {
    const connected = this.connectedClients;
    const globalTokens = this.globalBucket.getTokenCount();

    if (connected > 20 || globalTokens < 20) {
      this.adaptiveThrottle.loadFactor = Math.min(2.0, this.adaptiveThrottle.loadFactor + 0.1);
    } else if (connected < 5 && globalTokens > 80) {
      this.adaptiveThrottle.loadFactor = Math.max(0.5, this.adaptiveThrottle.loadFactor - 0.05);
    }

    this.adaptiveThrottle.currentInterval = Math.max(
      this.adaptiveThrottle.minInterval,
      Math.min(
        this.adaptiveThrottle.maxInterval,
        this.intervalMs * this.adaptiveThrottle.loadFactor,
      ),
    );
  }

  private async broadcastRealtimeData() {
    const [riskyAddresses, throughputHistory, liveTxs, aggregated] = await Promise.all([
      this.clickHouseService.getHighRiskAddresses(this.messageSizeLimits.maxNodes),
      this.clickHouseService.getThroughputHistory(2),
      this.clickHouseService.getRecentLargeTransactions(this.messageSizeLimits.maxTransactions * 3),
      this.clickHouseService.getAggregatedStats(),
    ]);

    const mutatedNodes = this.mutateRiskNodes(riskyAddresses);
    const latestThroughput = throughputHistory.length > 0
      ? this.mutateThroughput(throughputHistory[throughputHistory.length - 1])
      : this.generateLiveThroughputPoint();

    const freshTxs = this.pickFreshTransactions(liveTxs).slice(0, this.messageSizeLimits.maxTransactions);

    const payload: BroadcastPayload = {
      timestamp: Date.now(),
      risky_nodes: mutatedNodes,
      throughput: latestThroughput,
      live_transactions: freshTxs,
      aggregated,
    };

    const deltaPayload = this.computeDelta(payload);
    this.server.emit('realtime_update', deltaPayload || payload);

    this.previousPayload = payload;

    this.logger.verbose(
      `Broadcasted to ${this.connectedClients} clients: ` +
      `${mutatedNodes.length} nodes, ${freshTxs.length} txs, ` +
      `load=${this.adaptiveThrottle.loadFactor.toFixed(2)}x, ` +
      `interval=${this.adaptiveThrottle.currentInterval}ms`,
    );
  }

  private computeDelta(current: BroadcastPayload): BroadcastPayload | null {
    if (!this.previousPayload) return null;

    const changedNodes = current.risky_nodes.filter((node) => {
      const prev = this.previousPayload.risky_nodes.find(
        (p) => p.address === node.address,
      );
      if (!prev) return true;
      return (
        Math.abs(node.risk_score - prev.risk_score) > 0.01 ||
        node.risk_level !== prev.risk_level ||
        Math.abs(node.total_volume - prev.total_volume) > 1e9 ||
        node.total_transactions !== prev.total_transactions
      );
    });

    if (changedNodes.length < current.risky_nodes.length * 0.3) {
      return {
        ...current,
        risky_nodes: changedNodes,
      };
    }

    return null;
  }

  private mutateRiskNodes(nodes: RiskAddress[]): RiskAddress[] {
    if (!nodes || nodes.length === 0) return [];
    return nodes.map((node) => {
      const jitter = (Math.random() - 0.5) * 0.04;
      const newScore = Math.min(1, Math.max(0, node.risk_score + jitter));
      return {
        ...node,
        risk_score: Math.round(newScore * 10000) / 10000,
        total_volume: node.total_volume + Math.floor(Math.random() * 5e8),
        total_transactions: node.total_transactions + (Math.random() > 0.85 ? 1 : 0),
        last_seen: new Date().toISOString(),
      };
    });
  }

  private mutateThroughput(tp: ThroughputPoint): ThroughputPoint {
    const jitterFactor = 0.9 + Math.random() * 0.2;
    return {
      window_start: new Date().toISOString().replace('T', ' ').substring(0, 19),
      tx_count: Math.floor(tp.tx_count * jitterFactor),
      total_volume: Math.floor(tp.total_volume * jitterFactor),
      unique_senders: Math.floor(tp.unique_senders * (0.95 + Math.random() * 0.1)),
      unique_receivers: Math.floor(tp.unique_receivers * (0.95 + Math.random() * 0.1)),
    };
  }

  private generateLiveThroughputPoint(): ThroughputPoint {
    return {
      window_start: new Date().toISOString().replace('T', ' ').substring(0, 19),
      tx_count: Math.floor(Math.random() * 400) + 100,
      total_volume: Math.floor(Math.random() * 3e11) + 5e10,
      unique_senders: Math.floor(Math.random() * 120) + 40,
      unique_receivers: Math.floor(Math.random() * 120) + 40,
    };
  }

  private pickFreshTransactions(txs: LiveTransaction[]): LiveTransaction[] {
    if (!txs || txs.length === 0) return [];

    const fresh: LiveTransaction[] = [];
    for (const tx of txs) {
      if (!this.lastSentHashes.transactions.has(tx.tx_hash)) {
        fresh.push({
          ...tx,
          block_time: new Date().toISOString().replace('T', ' ').substring(0, 19),
          amount: tx.amount + Math.floor(Math.random() * 1e8),
        });
        this.lastSentHashes.transactions.add(tx.tx_hash);
      }
      if (fresh.length >= this.messageSizeLimits.maxTransactions) break;
    }

    if (this.lastSentHashes.transactions.size > 500) {
      const arr = Array.from(this.lastSentHashes.transactions);
      this.lastSentHashes.transactions = new Set(arr.slice(-250));
    }

    if (fresh.length === 0) {
      return txs.slice(0, this.messageSizeLimits.maxTransactions).map((tx) => ({
        ...tx,
        block_time: new Date().toISOString().replace('T', ' ').substring(0, 19),
      }));
    }

    return fresh;
  }

  private async sendInitialSnapshot(client: Socket) {
    const bucket = this.clientBuckets.get(client.id);
    if (bucket && !bucket.tryConsume(5)) {
      client.emit('rate_limited', { message: 'Too many requests' });
      return;
    }

    try {
      const [riskyAddresses, throughputHistory, liveTxs, aggregated] = await Promise.all([
        this.clickHouseService.getHighRiskAddresses(this.messageSizeLimits.maxNodes),
        this.clickHouseService.getThroughputHistory(this.messageSizeLimits.maxThroughputHistory),
        this.clickHouseService.getRecentLargeTransactions(this.messageSizeLimits.maxTransactions * 3),
        this.clickHouseService.getAggregatedStats(),
      ]);

      client.emit('initial_snapshot', {
        timestamp: Date.now(),
        risky_nodes: riskyAddresses,
        throughput_history: throughputHistory,
        live_transactions: liveTxs.slice(0, this.messageSizeLimits.maxTransactions * 4),
        aggregated,
        limits: this.messageSizeLimits,
      });

      this.logger.debug(`Sent snapshot to ${client.id}: ${riskyAddresses.length} nodes`);
    } catch (e) {
      this.logger.error(`Snapshot error: ${e}`);
      client.emit('error', { message: 'Failed to load initial data' });
    }
  }
}
