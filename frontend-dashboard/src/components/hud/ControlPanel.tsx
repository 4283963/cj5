import { useAppStore } from '../../store/appStore';

export function ControlPanel() {
  const {
    isPaused,
    togglePause,
    showConnections,
    toggleConnections,
    showLabels,
    toggleLabels,
    filterRiskLevel,
    toggleRiskFilter,
    nodeSizeScale,
    setNodeSizeScale,
    isConnected,
    reconnect,
  } = useAppStore();

  const riskLevelConfig = [
    { level: 'high' as const, label: '高风险', color: '#ff3366', activeColor: 'bg-neon-red/30 text-neon-red border-neon-red' },
    { level: 'medium' as const, label: '中风险', color: '#ffcc00', activeColor: 'bg-neon-yellow/30 text-neon-yellow border-neon-yellow' },
    { level: 'low' as const, label: '低风险', color: '#00ff88', activeColor: 'bg-neon-green/30 text-neon-green border-neon-green' },
  ];

  return (
    <div className="absolute bottom-4 right-4 w-72 z-10">
      <div className="glass-panel rounded-lg p-4 hud-corner">
        <h3 className="text-lg font-bold text-neon-purple mb-4">控制面板</h3>

        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={togglePause}
              className={`flex-1 py-2 px-3 rounded text-sm font-medium border transition-all ${
                isPaused
                  ? 'bg-neon-green/20 text-neon-green border-neon-green'
                  : 'bg-neon-yellow/20 text-neon-yellow border-neon-yellow'
              }`}
            >
              {isPaused ? '▶ 继续' : '⏸ 暂停'}
            </button>
            <button
              onClick={reconnect}
              disabled={!isConnected}
              className="py-2 px-3 rounded text-sm font-medium border border-neon-blue text-neon-blue hover:bg-neon-blue/20 transition-all"
            >
              🔄 重连
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-gray-400">风险等级过滤</div>
            <div className="flex gap-2">
              {riskLevelConfig.map(({ level, label, activeColor }) => (
                <button
                  key={level}
                  onClick={() => toggleRiskFilter(level)}
                  className={`flex-1 py-1.5 px-2 rounded text-xs border transition-all ${
                    filterRiskLevel.includes(level)
                      ? activeColor
                      : 'bg-gray-800/50 text-gray-500 border-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">节点大小缩放</span>
              <span className="text-xs text-neon-blue">{nodeSizeScale.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.3"
              max="3"
              step="0.1"
              value={nodeSizeScale}
              onChange={(e) => setNodeSizeScale(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-neon-blue"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs text-gray-400">显示选项</div>
            <div className="flex gap-2">
              <button
                onClick={toggleConnections}
                className={`flex-1 py-1.5 px-2 rounded text-xs border transition-all ${
                  showConnections
                    ? 'bg-neon-blue/20 text-neon-blue border-neon-blue'
                    : 'bg-gray-800/50 text-gray-500 border-gray-700'
                }`}
              >
                🔗 连接线
              </button>
              <button
                onClick={toggleLabels}
                className={`flex-1 py-1.5 px-2 rounded text-xs border transition-all ${
                  showLabels
                    ? 'bg-neon-purple/20 text-neon-purple border-neon-purple'
                    : 'bg-gray-800/50 text-gray-500 border-gray-700'
                }`}
              >
                🏷 标签
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-700">
            <div className="text-xs text-gray-500 mb-2">操作提示</div>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>🖱 左键拖动: 旋转视角</li>
              <li>🖱 滚轮: 缩放视图</li>
              <li>🖱 右键拖动: 平移</li>
              <li>👆 点击节点: 查看详情</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
