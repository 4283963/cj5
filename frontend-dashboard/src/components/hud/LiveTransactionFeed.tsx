import { useAppStore } from '../../store/appStore';
import { formatAddress, formatSol } from '../../utils/visualization';

const txTypeIcons: Record<string, string> = {
  transfer: '💸',
  dex_swap: '🔄',
  stake_delegate: '📊',
  contract_call: '📜',
  nft_trade: '🎨',
};

export function LiveTransactionFeed() {
  const { liveTransactions } = useAppStore();

  return (
    <div className="absolute bottom-4 left-4 w-96 z-10">
      <div className="glass-panel rounded-lg p-4 hud-corner max-h-64 overflow-hidden">
        <h3 className="text-lg font-bold text-neon-green mb-3 flex items-center gap-2">
          <span className="animate-pulse">●</span>
          实时大额交易流水
        </h3>
        <div className="space-y-2 overflow-y-auto max-h-48 pr-2">
          {liveTransactions.slice(0, 15).map((tx, idx) => (
            <div
              key={`${tx.tx_hash}-${idx}`}
              className="bg-black/40 rounded p-2 text-xs border-l-2"
              style={{
                borderColor: tx.amount > 1e11 ? '#ff3366' : tx.amount > 1e10 ? '#ffcc00' : '#00ff88',
                animationDelay: `${idx * 50}ms`,
              }}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-gray-400">
                  {txTypeIcons[tx.tx_type] || '📦'} {tx.tx_type}
                </span>
                <span className={`font-bold ${
                  tx.amount > 1e11 ? 'text-neon-red' :
                  tx.amount > 1e10 ? 'text-neon-yellow' : 'text-neon-green'
                }`}>
                  {formatSol(tx.amount)}
                </span>
              </div>
              <div className="font-mono text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">从:</span>
                  <span className="text-neon-blue">{formatAddress(tx.from_address, 5, 5)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">到:</span>
                  <span className="text-neon-purple">{formatAddress(tx.to_address, 5, 5)}</span>
                </div>
              </div>
              <div className="text-gray-600 mt-1">
                {new Date(tx.block_time).toLocaleTimeString()}
                {' · '}
                #{tx.block_number.toLocaleString()}
              </div>
            </div>
          ))}
          {liveTransactions.length === 0 && (
            <div className="text-gray-500 text-center py-4">
              等待交易数据...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
