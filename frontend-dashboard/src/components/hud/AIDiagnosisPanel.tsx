import { useEffect, useRef } from 'react';
import { useAIDiagnosis } from '../../hooks/useAIDiagnosis';
import type { ParticleNode } from '../../types';

interface AIDiagnosisPanelProps {
  node: ParticleNode | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AIDiagnosisPanel({ node, isOpen, onClose }: AIDiagnosisPanelProps) {
  const {
    isLoading,
    isStreaming,
    currentText,
    progress,
    result,
    error,
    startDiagnosis,
    cancelDiagnosis,
    hasCompleted,
  } = useAIDiagnosis();

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && node) {
      startDiagnosis(
        node.address,
        node.riskScore,
        node.riskLevel,
        node.riskTags,
        node.txCount,
        node.volume,
      );
    }
  }, [isOpen, node, startDiagnosis]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [currentText, isStreaming]);

  if (!isOpen) return null;

  const displayText = currentText || (isLoading ? '' : '');
  const cursorVisible = isStreaming;

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'text-risk-high';
      case 'medium':
        return 'text-risk-medium';
      default:
        return 'text-risk-low';
    }
  };

  const getRiskLevelBg = (level: string) => {
    switch (level) {
      case 'high':
        return 'from-risk-high/20 to-risk-high/5';
      case 'medium':
        return 'from-risk-medium/20 to-risk-medium/5';
      default:
        return 'from-risk-low/20 to-risk-low/5';
    }
  };

  const getRiskLevelLabel = (level: string) => {
    switch (level) {
      case 'high':
        return '高风险';
      case 'medium':
        return '中风险';
      default:
        return '低风险';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl max-h-[80vh] pointer-events-auto">
        <div
          className={`
            relative bg-gradient-to-br ${getRiskLevelBg(node?.riskLevel || 'low')}
            backdrop-blur-xl border border-white/10 rounded-2xl
            shadow-2xl shadow-black/50 overflow-hidden
            transform transition-all duration-300
            ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
          `}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
          <div className="absolute top-0 left-0 w-1/4 h-px bg-cyan-400/80" />

          <div className="flex items-center justify-between p-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    ${getRiskLevelBg(node?.riskLevel || 'low')}
                    border border-white/20
                  `}
                >
                  <span className="text-xl">
                    {isStreaming ? '🤖' : hasCompleted ? '✨' : '🔮'}
                  </span>
                </div>
                {isStreaming && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full animate-ping" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">AI 智能诊断</h2>
                <p className="text-xs text-white/50 font-mono">
                  {node?.address.slice(0, 8)}...{node?.address.slice(-6)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isStreaming && (
                <div className="flex items-center gap-2 text-xs text-cyan-400">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                  生成中 {Math.round(progress * 100)}%
                </div>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${getRiskLevelColor(node?.riskLevel || 'low')}`}>
                  {getRiskLevelLabel(node?.riskLevel || 'low')}
                </span>
                <span className="text-xs text-white/40">
                  风险评分 {Math.round((node?.riskScore || 0) * 100)}
                </span>
              </div>
              <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    node?.riskLevel === 'high'
                      ? 'bg-gradient-to-r from-red-500 to-red-400'
                      : node?.riskLevel === 'medium'
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-400'
                      : 'bg-gradient-to-r from-green-500 to-emerald-400'
                  }`}
                  style={{ width: `${(node?.riskScore || 0) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(node?.riskTags || []).slice(0, 6).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs rounded-full bg-white/8 text-white/60 border border-white/10"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div
            ref={contentRef}
            className="p-5 max-h-72 overflow-y-auto custom-scrollbar"
          >
            {error ? (
              <div className="text-center py-8">
                <span className="text-4xl">😵</span>
                <p className="mt-3 text-red-400 text-sm">{error}</p>
                <button
                  onClick={() => {
                    if (node) {
                      startDiagnosis(
                        node.address,
                        node.riskScore,
                        node.riskLevel,
                        node.riskTags,
                        node.txCount,
                        node.volume,
                      );
                    }
                  }}
                  className="mt-4 px-4 py-2 text-xs bg-white/10 hover:bg-white/15 text-white/80 rounded-lg transition-colors"
                >
                  重新生成
                </button>
              </div>
            ) : isStreaming || displayText ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs">🤖</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
                      {displayText}
                      {cursorVisible && (
                        <span className="inline-block w-2 h-4 bg-cyan-400 ml-0.5 animate-blink align-middle" />
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="inline-block w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                <p className="mt-3 text-white/50 text-sm">正在启动 AI 分析引擎...</p>
              </div>
            )}
          </div>

          {hasCompleted && result && (
            <>
              <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              <div className="p-5 space-y-4">
                {result.warnings.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                      ⚠️ 风险警示
                    </h4>
                    <div className="space-y-1.5">
                      {result.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-yellow-200/80">
                          {w}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {result.suggestions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                      💡 风控建议
                    </h4>
                    <ul className="space-y-1.5">
                      {result.suggestions.map((s, i) => (
                        <li key={i} className="text-xs text-white/70 flex items-start gap-2">
                          <span className="text-cyan-400 flex-shrink-0">▸</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/40">AI 置信度</span>
                    <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full"
                        style={{ width: `${result.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-cyan-400">
                      {Math.round(result.confidence * 100)}%
                    </span>
                  </div>
                  <span className="text-[10px] text-white/30">
                    基于 AI 模型分析生成 · 仅供参考
                  </span>
                </div>
              </div>
            </>
          )}

          {isStreaming && (
            <div className="px-5 pb-4">
              <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 transition-all duration-200"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
