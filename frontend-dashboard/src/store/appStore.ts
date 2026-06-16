import { create } from 'zustand';
import type {
  RiskAddress,
  ThroughputPoint,
  LiveTransaction,
  AggregatedStats,
  ParticleNode,
} from '../types';

interface AppState {
  isConnected: boolean;
  lastUpdateTime: number | null;
  riskyNodes: RiskAddress[];
  throughputHistory: ThroughputPoint[];
  liveTransactions: LiveTransaction[];
  aggregatedStats: AggregatedStats;
  particleNodes: Map<string, ParticleNode>;
  selectedNode: ParticleNode | null;
  hoveredNode: ParticleNode | null;
  isPaused: boolean;
  cameraMode: 'orbit' | 'free' | 'topdown';
  showConnections: boolean;
  showLabels: boolean;
  filterRiskLevel: ('high' | 'medium' | 'low')[];
  nodeSizeScale: number;
  particleCount: number;

  setConnected: (connected: boolean) => void;
  setRiskyNodes: (nodes: RiskAddress[]) => void;
  addThroughputPoint: (point: ThroughputPoint) => void;
  setThroughputHistory: (history: ThroughputPoint[]) => void;
  addLiveTransaction: (tx: LiveTransaction) => void;
  setLiveTransactions: (txs: LiveTransaction[]) => void;
  setAggregatedStats: (stats: AggregatedStats) => void;
  setParticleNodes: (nodes: Map<string, ParticleNode>) => void;
  updateParticleNode: (id: string, updates: Partial<ParticleNode>) => void;
  setSelectedNode: (node: ParticleNode | null) => void;
  setHoveredNode: (node: ParticleNode | null) => void;
  togglePause: () => void;
  setCameraMode: (mode: 'orbit' | 'free' | 'topdown') => void;
  toggleConnections: () => void;
  toggleLabels: () => void;
  toggleRiskFilter: (level: 'high' | 'medium' | 'low') => void;
  setNodeSizeScale: (scale: number) => void;
  setLastUpdateTime: (time: number) => void;
  reconnect: () => void;
  disconnect: () => void;
}

const initialStats: AggregatedStats = {
  total_risky_addresses: 0,
  high_risk_count: 0,
  medium_risk_count: 0,
  total_volume_24h: 0,
  total_txs_24h: 0,
};

export const useAppStore = create<AppState>((set) => ({
  isConnected: false,
  lastUpdateTime: null,
  riskyNodes: [],
  throughputHistory: [],
  liveTransactions: [],
  aggregatedStats: initialStats,
  particleNodes: new Map(),
  selectedNode: null,
  hoveredNode: null,
  isPaused: false,
  cameraMode: 'orbit',
  showConnections: true,
  showLabels: true,
  filterRiskLevel: ['high', 'medium'],
  nodeSizeScale: 1,
  particleCount: 0,

  setConnected: (connected) => set({ isConnected: connected }),
  setRiskyNodes: (nodes) => set({ riskyNodes: nodes }),
  addThroughputPoint: (point) =>
    set((state) => ({
      throughputHistory: [...state.throughputHistory.slice(-120), point],
    })),
  setThroughputHistory: (history) => set({ throughputHistory: history }),
  addLiveTransaction: (tx) =>
    set((state) => ({
      liveTransactions: [tx, ...state.liveTransactions.slice(0, 99)],
    })),
  setLiveTransactions: (txs) => set({ liveTransactions: txs.slice(0, 100) }),
  setAggregatedStats: (stats) => set({ aggregatedStats: stats }),
  setParticleNodes: (nodes) => set({ particleNodes: nodes, particleCount: nodes.size }),
  updateParticleNode: (id, updates) =>
    set((state) => {
      const newNodes = new Map(state.particleNodes);
      const existing = newNodes.get(id);
      if (existing) {
        newNodes.set(id, { ...existing, ...updates, lastUpdated: Date.now() });
      }
      return { particleNodes: newNodes };
    }),
  setSelectedNode: (node) => set({ selectedNode: node }),
  setHoveredNode: (node) => set({ hoveredNode: node }),
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  toggleConnections: () => set((state) => ({ showConnections: !state.showConnections })),
  toggleLabels: () => set((state) => ({ showLabels: !state.showLabels })),
  toggleRiskFilter: (level) =>
    set((state) => {
      const current = state.filterRiskLevel;
      if (current.includes(level)) {
        return { filterRiskLevel: current.filter((l) => l !== level) };
      } else {
        return { filterRiskLevel: [...current, level] };
      }
    }),
  setNodeSizeScale: (scale) => set({ nodeSizeScale: Math.max(0.3, Math.min(3, scale)) }),
  setLastUpdateTime: (time) => set({ lastUpdateTime: time }),
  reconnect: () => {
    console.log('🔄 Reconnecting WebSocket from store');
    window.dispatchEvent(new CustomEvent('crypto-stream-reconnect'));
  },
  disconnect: () => {
    console.log('🔌 Disconnecting WebSocket from store');
    window.dispatchEvent(new CustomEvent('crypto-stream-disconnect'));
  },
}));
