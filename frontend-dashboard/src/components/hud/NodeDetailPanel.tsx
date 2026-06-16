import { useAppStore } from '../../store/appStore';
import { formatAddress, formatSol, volumeToSize } from '../../utils/visualization';

export function NodeDetailPanel() {
  const { selectedNode, setSelectedNode } = useAppStore();

  if (!selectedNode) return null;

  const riskColors = {
    high: 'text-neon-red border-neon-red',
    medium: 'text-neon-yellow border-neon-yellow',
    low: 'text-neon-green border-neon-green',
  };

  const riskLabels = {
    high: '高风险',
    medium: '中风险',
    low: '低风险',
  };

  const tagColors: Record<string, string> = {
    mixer_interaction: 'bg-red-500/30 text-red-300 border-red-500/50',
    suspicious_gathering: 'bg-orange-500/30 text-orange-300 border-orange-500/50',
    bot_like_pattern: 'bg-purple-500/30 text-purple-300 border-purple-500/50',
    high_activity_cluster: 'bg-yellow-500/30 text-yellow-300 border-yellow-500/50',
    rapid_funding_cluster: 'bg-red-500/30 text-red-300 border-red-500/50',
    concentration_hub: 'bg-orange-500/30 text-orange-300 border-orange-500/50',
    distribution_hub: 'bg-blue-500/30 text-blue-300 border-blue-500/50',
    automated_transfers: 'bg-purple-500/30 text-purple-300 border-purple-500/50',
    irregular_large_txs: 'bg-red-500/30 text-red-300 border-red-500/50',
    blacklist_associated: 'bg-red-600/30 text-red-200 border-red-600/50',
    high_risk_neighborhood: 'bg-red-500/30 text-red-300 border-red-500/50',
    known_mixer: 'bg-red-700/40 text-red-100 border-red-700/60',
    known_exchange: 'bg-green-500/20 text-green-300 border-green-500/40',
  };

  return (
    <div className="absolute top-24 right-4 w-80 z-20">
      <div className="glass-panel rounded-lg p-4 hud-corner">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-bold text-neon-blue">节点详情</h3>
          <button
            onClick={() => setSelectedNode(null)}
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-xs text-gray-400 mb-1">钱包地址</div>
            <div className="font-mono text-sm text-white break-all bg-black/30 p-2 rounded">
              {selectedNode.address}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/30 p-3 rounded">
              <div className="text-xs text-gray-400">风险评分</div>
              <div className={`text-xl font-bold ${riskColors[selectedNode.riskLevel].split(' ')[0]}`}>
                {(selectedNode.riskScore * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-black/30 p-3 rounded">
              <div className="text-xs text-gray-400">风险等级</div>
              <div className={`text-xl font-bold ${riskColors[selectedNode.riskLevel].split(' ')[0]} risk-pulse`}>
                {riskLabels[selectedNode.riskLevel]}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/30 p-3 rounded">
              <div className="text-xs text-gray-400">交易总额</div>
              <div className="text-lg font-bold text-neon-green">
                {formatSol(selectedNode.volume)}
              </div>
            </div>
            <div className="bg-black/30 p-3 rounded">
              <div className="text-xs text-gray-400">交易次数</div>
              <div className="text-lg font-bold text-neon-blue">
                {selectedNode.txCount.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="bg-black/30 p-3 rounded">
            <div className="text-xs text-gray-400 mb-2">风险标签</div>
            <div className="flex flex-wrap gap-2">
              {selectedNode.riskTags.map((tag, idx) => (
                <span
                  key={idx}
                  className={`px-2 py-1 rounded text-xs border ${tagColors[tag] || 'bg-gray-500/30 text-gray-300 border-gray-500/50'}`}
                >
                  {tag}
                </span>
              ))}
              {selectedNode.riskTags.length === 0 && (
                <span className="text-gray-500 text-xs">无标签</span>
              )}
            </div>
          </div>

          <div className="bg-black/30 p-3 rounded">
            <div className="text-xs text-gray-400 mb-2">可视化参数</div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">节点大小</span>
                <span className="text-neon-blue">{volumeToSize(selectedNode.volume, 1).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">空间位置</span>
                <span className="text-neon-purple">
                  ({selectedNode.position.x.toFixed(1)}, {selectedNode.position.y.toFixed(1)}, {selectedNode.position.z.toFixed(1)})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">最后更新</span>
                <span className="text-neon-green">
                  {new Date(selectedNode.lastUpdated).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="flex-1 py-2 px-4 bg-neon-blue/20 hover:bg-neon-blue/30 text-neon-blue rounded text-sm border border-neon-blue/50 transition-all">
              链上浏览
            </button>
            <button className="flex-1 py-2 px-4 bg-neon-red/20 hover:bg-neon-red/30 text-neon-red rounded text-sm border border-neon-red/50 transition-all">
              加入监控
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
