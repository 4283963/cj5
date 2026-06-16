import { useAppStore } from '../../store/appStore';
import { formatVolume } from '../../utils/visualization';

export function ThroughputMiniChart() {
  const { throughputHistory } = useAppStore();

  const maxVolume = Math.max(...throughputHistory.map((t) => t.total_volume), 1);
  const maxTxCount = Math.max(...throughputHistory.map((t) => t.tx_count), 1);

  return (
    <div className="absolute top-24 left-4 w-72 z-10">
      <div className="glass-panel rounded-lg p-4 hud-corner">
        <h3 className="text-sm font-bold text-neon-blue mb-3 flex items-center gap-2">
          📈 交易吞吐量
          {throughputHistory.length > 0 && (
            <span className="text-xs text-gray-400 ml-auto">
              {throughputHistory.length} 分钟
            </span>
          )}
        </h3>

        {throughputHistory.length > 0 ? (
          <>
            <div className="relative h-20 mb-3">
              <svg width="100%" height="100%" className="absolute inset-0">
                <defs>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00ccff" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#00ccff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polyline
                  fill="url(#volumeGradient)"
                  stroke="none"
                  points={throughputHistory
                    .map((t, i) => {
                      const x = (i / (throughputHistory.length - 1 || 1)) * 100;
                      const y = 100 - (t.total_volume / maxVolume) * 90;
                      return `${x},${y}`;
                    })
                    .join(' ') + ` 100,100 0,100`}
                />
                <polyline
                  fill="none"
                  stroke="#00ccff"
                  strokeWidth="1.5"
                  points={throughputHistory
                    .map((t, i) => {
                      const x = (i / (throughputHistory.length - 1 || 1)) * 100;
                      const y = 100 - (t.total_volume / maxVolume) * 90;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />
              </svg>
              <div className="absolute top-1 right-2 text-xs text-neon-blue">
                {formatVolume(throughputHistory[throughputHistory.length - 1]?.total_volume || 0)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-black/30 p-2 rounded">
                <div className="text-gray-400">TPS</div>
                <div className="text-neon-green font-bold">
                  ~{Math.round((throughputHistory[throughputHistory.length - 1]?.tx_count || 0) / 60)}
                </div>
              </div>
              <div className="bg-black/30 p-2 rounded">
                <div className="text-gray-400">活跃地址</div>
                <div className="text-neon-purple font-bold">
                  {throughputHistory[throughputHistory.length - 1]?.unique_senders || 0}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="h-24 flex items-center justify-center text-gray-500 text-sm">
            等待吞吐量数据...
          </div>
        )}
      </div>
    </div>
  );
}
