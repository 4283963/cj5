export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskAddress {
  address: string;
  risk_score: number;
  risk_level: RiskLevel;
  risk_tags: string[];
  total_transactions: number;
  total_volume: number;
  first_seen: string;
  last_seen: string;
}

export interface ThroughputPoint {
  window_start: string;
  tx_count: number;
  total_volume: number;
  unique_senders: number;
  unique_receivers: number;
}

export interface LiveTransaction {
  tx_hash: string;
  block_number: number;
  block_time: string;
  from_address: string;
  to_address: string;
  amount: number;
  token_mint: string;
  tx_type: string;
  is_internal: boolean;
  from_risk?: RiskAddress;
  to_risk?: RiskAddress;
}

export interface AggregatedStats {
  total_risky_addresses: number;
  high_risk_count: number;
  medium_risk_count: number;
  total_volume_24h: number;
  total_txs_24h: number;
}

export interface RealtimeUpdate {
  timestamp: number;
  risky_nodes: RiskAddress[];
  throughput: ThroughputPoint | null;
  live_transactions: LiveTransaction[];
  aggregated: AggregatedStats;
}

export interface InitialSnapshot {
  timestamp: number;
  risky_nodes: RiskAddress[];
  throughput_history: ThroughputPoint[];
  live_transactions: LiveTransaction[];
  aggregated: AggregatedStats;
}

export interface ParticleNode {
  id: string;
  address: string;
  position: { x: number; y: number; z: number };
  basePosition: { x: number; y: number; z: number };
  targetSize: number;
  currentSize: number;
  riskScore: number;
  riskLevel: RiskLevel;
  riskTags: string[];
  volume: number;
  txCount: number;
  color: { r: number; g: number; b: number };
  targetColor: { r: number; g: number; b: number };
  pulsePhase: number;
  rotationSpeed: number;
  velocity: { x: number; y: number; z: number };
  connections: string[];
  createdAt: number;
  lastUpdated: number;
}
