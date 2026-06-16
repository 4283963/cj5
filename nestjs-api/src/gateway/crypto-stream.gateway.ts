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

@WebSocketGateway({
  namespace: '/crypto-stream',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 5000,
})
export class CryptoStreamGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(CryptoStreamGateway.name);
  private broadcastInterval: NodeJS.Timeout;
  private intervalMs: number;
  private connectedClients = 0;
  private lastRiskyNodes: RiskAddress[] = [];
  private lastTxIndex = 0;

  constructor(
    private clickHouseService: ClickHouseService,
    private configService: ConfigService,
  ) {
    this.intervalMs = this.configService.get<number>('BROADCAST_INTERVAL', 1500);
  }

  afterInit(server: Server) {
    this.logger.log(`WebSocket Gateway initialized on namespace /crypto-stream`);
    this.startBroadcasting();
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.connectedClients++;
    this.logger.log(
      `Client connected: ${client.id} | Total: ${this.connectedClients}`,
    );
    client.emit('connected', {
      message: 'Welcome to Crypto Sentinel Stream',
      timestamp: Date.now(),
      server_time: new Date().toISOString(),
    });
    this.sendInitialSnapshot(client);
  }

  handleDisconnect(client: Socket) {
    this.connectedClients--;
    this.logger.log(
      `Client disconnected: ${client.id} | Total: ${this.connectedClients}`,
    );
  }

  @SubscribeMessage('request_snapshot')
  async handleRequestSnapshot(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    this.logger.debug(`Snapshot requested by ${client.id}`);
    await this.sendInitialSnapshot(client);
  }

  @SubscribeMessage('subscribe_address')
  handleSubscribeAddress(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { address: string },
  ) {
    if (payload?.address) {
      client.join(`addr:${payload.address}`);
      this.logger.log(`${client.id} subscribed to address ${payload.address}`);
      client.emit('subscribed', { address: payload.address });
    }
  }

  private startBroadcasting() {
    this.logger.log(`Starting broadcast loop at ${this.intervalMs}ms interval`);
    this.broadcastInterval = setInterval(async () => {
      if (this.connectedClients === 0) return;
      try {
        await this.broadcastRealtimeData();
      } catch (e) {
        this.logger.error(`Broadcast error: ${e}`);
      }
    }, this.intervalMs);
  }

  private async broadcastRealtimeData() {
    const [riskyAddresses, throughputHistory, liveTxs, aggregated] = await Promise.all([
      this.clickHouseService.getHighRiskAddresses(60),
      this.clickHouseService.getThroughputHistory(2),
      this.clickHouseService.getRecentLargeTransactions(15),
      this.clickHouseService.getAggregatedStats(),
    ]);

    const mutatedNodes = this.mutateRiskNodes(riskyAddresses);
    const latestThroughput = throughputHistory.length > 0
      ? this.mutateThroughput(throughputHistory[throughputHistory.length - 1])
      : this.generateLiveThroughputPoint();

    const freshTxs = this.pickFreshTransactions(liveTxs);

    const payload: BroadcastPayload = {
      timestamp: Date.now(),
      risky_nodes: mutatedNodes,
      throughput: latestThroughput,
      live_transactions: freshTxs,
      aggregated,
    };

    this.server.emit('realtime_update', payload);
    this.logger.verbose(
      `Broadcasted to ${this.connectedClients} clients: ${mutatedNodes.length} nodes, ${freshTxs.length} txs`,
    );
  }

  private mutateRiskNodes(nodes: RiskAddress[]): RiskAddress[] {
    if (!nodes || nodes.length === 0) return [];
    return nodes.map((node) => {
      const jitter = (Math.random() - 0.5) * 0.06;
      const newScore = Math.min(1, Math.max(0, node.risk_score + jitter));
      return {
        ...node,
        risk_score: Math.round(newScore * 10000) / 10000,
        total_volume: node.total_volume + Math.floor(Math.random() * 1e9),
        total_transactions: node.total_transactions + (Math.random() > 0.7 ? 1 : 0),
        last_seen: new Date().toISOString(),
      };
    });
  }

  private mutateThroughput(tp: ThroughputPoint): ThroughputPoint {
    const jitterFactor = 0.85 + Math.random() * 0.3;
    return {
      window_start: new Date().toISOString().replace('T', ' ').substring(0, 19),
      tx_count: Math.floor(tp.tx_count * jitterFactor),
      total_volume: Math.floor(tp.total_volume * jitterFactor),
      unique_senders: Math.floor(tp.unique_senders * (0.9 + Math.random() * 0.2)),
      unique_receivers: Math.floor(tp.unique_receivers * (0.9 + Math.random() * 0.2)),
    };
  }

  private generateLiveThroughputPoint(): ThroughputPoint {
    return {
      window_start: new Date().toISOString().replace('T', ' ').substring(0, 19),
      tx_count: Math.floor(Math.random() * 500) + 150,
      total_volume: Math.floor(Math.random() * 5e11) + 1e11,
      unique_senders: Math.floor(Math.random() * 150) + 50,
      unique_receivers: Math.floor(Math.random() * 150) + 50,
    };
  }

  private pickFreshTransactions(txs: LiveTransaction[]): LiveTransaction[] {
    if (!txs || txs.length === 0) return [];
    const batchSize = Math.min(5 + Math.floor(Math.random() * 4), txs.length);
    this.lastTxIndex = (this.lastTxIndex + 1) % Math.max(1, txs.length - batchSize);
    const batch = txs.slice(this.lastTxIndex, this.lastTxIndex + batchSize);
    return batch.map((tx) => ({
      ...tx,
      block_time: new Date().toISOString().replace('T', ' ').substring(0, 19),
      amount: tx.amount + Math.floor(Math.random() * 1e8),
    }));
  }

  private async sendInitialSnapshot(client: Socket) {
    try {
      const [riskyAddresses, throughputHistory, liveTxs, aggregated] = await Promise.all([
        this.clickHouseService.getHighRiskAddresses(80),
        this.clickHouseService.getThroughputHistory(60),
        this.clickHouseService.getRecentLargeTransactions(30),
        this.clickHouseService.getAggregatedStats(),
      ]);

      client.emit('initial_snapshot', {
        timestamp: Date.now(),
        risky_nodes: riskyAddresses,
        throughput_history: throughputHistory,
        live_transactions: liveTxs,
        aggregated,
      });

      this.lastRiskyNodes = riskyAddresses;
      this.logger.debug(`Sent snapshot to ${client.id}`);
    } catch (e) {
      this.logger.error(`Snapshot error: ${e}`);
      client.emit('error', { message: 'Failed to load initial data' });
    }
  }
}
