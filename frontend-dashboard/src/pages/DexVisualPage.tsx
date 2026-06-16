import { useEffect, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene3D } from '../components/3d/Scene3D';
import { StatsHUD } from '../components/hud/StatsHUD';
import { NodeDetailPanel } from '../components/hud/NodeDetailPanel';
import { LiveTransactionFeed } from '../components/hud/LiveTransactionFeed';
import { ControlPanel } from '../components/hud/ControlPanel';
import { ThroughputMiniChart } from '../components/hud/ThroughputMiniChart';
import { AIDiagnosisPanel } from '../components/hud/AIDiagnosisPanel';
import { useCryptoStream } from '../hooks/useCryptoStream';
import { useAppStore } from '../store/appStore';
import type { ParticleNode } from '../types';

export function DexVisualPage() {
  useCryptoStream();
  const { showConnections, isConnected, selectedNode } = useAppStore();
  const [showLoading, setShowLoading] = useState(true);
  const [diagnosisNode, setDiagnosisNode] = useState<ParticleNode | null>(null);
  const [showDiagnosis, setShowDiagnosis] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleNodeDoubleClick = useCallback((node: ParticleNode) => {
    setDiagnosisNode(node);
    setShowDiagnosis(true);
  }, []);

  useEffect(() => {
    if (selectedNode) {
      setDiagnosisNode(selectedNode);
      setShowDiagnosis(true);
    }
  }, [selectedNode]);

  const handleCloseDiagnosis = useCallback(() => {
    setShowDiagnosis(false);
    setTimeout(() => setDiagnosisNode(null), 300);
  }, []);

  useEffect(() => {
    const handleAIDiagnoseRequest = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        setDiagnosisNode(customEvent.detail);
        setShowDiagnosis(true);
      }
    };

    window.addEventListener('ai-diagnose-request', handleAIDiagnoseRequest);
    return () => {
      window.removeEventListener('ai-diagnose-request', handleAIDiagnoseRequest);
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-cyber-darker overflow-hidden">
      <div className="absolute inset-0 pointer-events-none scanline-effect z-50 opacity-30" />

      <Canvas
        camera={{ position: [0, 5, 35], fov: 60 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#050510']} />
        <Scene3D showConnections={showConnections} />
      </Canvas>

      <StatsHUD />
      <ThroughputMiniChart />
      <NodeDetailPanel />
      <LiveTransactionFeed />
      <ControlPanel />

      <AIDiagnosisPanel
        node={diagnosisNode}
        isOpen={showDiagnosis}
        onClose={handleCloseDiagnosis}
      />

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 pointer-events-none">
        <div className="glass-panel rounded-lg px-6 py-2 text-center hud-corner">
          <div className="text-xs text-gray-400">
            Solana 链上实时监控 · 加密货币态势感知系统
          </div>
          <div className="text-[10px] text-gray-500 mt-1">
            Powered by AI Risk Analysis · Three.js Visualization · ClickHouse Analytics
          </div>
        </div>
      </div>

      {showLoading && (
        <div className="absolute inset-0 bg-cyber-darker/95 flex flex-col items-center justify-center z-[100] transition-opacity duration-500">
          <div className="relative">
            <div className="w-24 h-24 border-4 border-neon-blue/30 rounded-full animate-spin border-t-neon-blue" />
            <div className="absolute inset-2 border-4 border-neon-green/30 rounded-full animate-spin border-b-neon-green" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            <div className="absolute inset-4 border-4 border-neon-purple/30 rounded-full animate-spin border-r-neon-purple" style={{ animationDuration: '2s' }} />
          </div>
          <div className="mt-8 text-2xl font-bold text-neon-blue neon-text">
            CRYPTO SENTINEL
          </div>
          <div className="mt-2 text-sm text-gray-400">
            {isConnected ? '初始化 3D 可视化引擎...' : '连接数据源中...'}
          </div>
          <div className="mt-6 w-64 h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-neon-blue via-neon-green to-neon-purple animate-pulse"
              style={{ width: isConnected ? '85%' : '45%' }}
            />
          </div>
        </div>
      )}

      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 overflow-hidden w-full max-w-3xl pointer-events-none">
        <div className="marquee whitespace-nowrap text-xs text-neon-green/70 font-mono">
          ⚠️ 系统检测到高风险归集地址 · 实时监控 Solana 链上大额交易 · AI 风险评分模型运行中 ·
          当前识别风险地址数: {useAppStore.getState().aggregatedStats.total_risky_addresses} ·
          高风险: {useAppStore.getState().aggregatedStats.high_risk_count} ·
          中风险: {useAppStore.getState().aggregatedStats.medium_risk_count} ·
          24h 交易额: {Math.round(useAppStore.getState().aggregatedStats.total_volume_24h / 1e9)} SOL ·
        </div>
      </div>
    </div>
  );
}
