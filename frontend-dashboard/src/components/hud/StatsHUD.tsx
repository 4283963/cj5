import { useAppStore } from '../../store/appStore';
import { formatVolume, formatSol } from '../../utils/visualization';

export function StatsHUD() {
  const { aggregatedStats, isConnected, lastUpdateTime, isPaused } = useAppStore();

  const formatTime = (ts: number | null) => {
    if (!ts) return '--:--:--';
    return new Date(ts).toLocaleTimeString();
  };

  const stats = [
    {
      label: '风险地址总数',
      value: aggregatedStats.total_risky_addresses.toLocaleString(),
      color: 'text-neon-blue',
      glow: '#00ccff',
    },
    {
      label: '🔴 高风险',
      value: aggregatedStats.high_risk_count.toLocaleString(),
      color: 'text-neon-red',
      glow: '#ff3366',
    },
    {
      label: '🟡 中风险',
      value: aggregatedStats.medium_risk_count.toLocaleString(),
      color: 'text-neon-yellow',
      glow: '#ffcc00',
    },
    {
      label: '24h 交易额',
      value: formatSol(aggregatedStats.total_volume_24h),
      color: 'text-neon-green',
      glow: '#00ff88',
    },
    {
      label: '24h 交易数',
      value: aggregatedStats.total_txs_24h.toLocaleString(),
      color: 'text-neon-purple',
      glow: '#cc66ff',
    },
  ];

  return (
    <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none z-10">
      <div className="flex justify-between items-start">
        <div className="glass-panel rounded-lg p-4 hud-corner pointer-events-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-neon-green animate-pulse' : 'bg-neon-red'}`} />
            <h1 className="text-xl font-bold text-neon-blue neon-text">
              CRYPTO SENTINEL
            </h1>
            <span className="text-xs text-gray-400">
              v1.0.0 | Solana Chain
            </span>
          </div>
          <div className="text-xs text-gray-400 flex gap-4">
            <span>状态: {isConnected ? (
              <span className="text-neon-green">● 已连接</span>
            ) : (
              <span className="text-neon-red">● 未连接</span>
            )}</span>
            {isPaused && <span className="text-neon-yellow">⏸ 已暂停</span>}
            <span>更新: {formatTime(lastUpdateTime)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="glass-panel rounded-lg p-3 text-center hud-corner pointer-events-auto min-w-[120px]"
              style={{ boxShadow: `0 0 15px ${stat.glow}20` }}
            >
              <div className={`text-2xl font-bold ${stat.color} neon-text`}>
                {stat.value}
              </div>
              <div className="text-xs text-gray-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
