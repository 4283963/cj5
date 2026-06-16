import { useState, useCallback, useRef, useEffect } from 'react';

export interface AIDiagnosisResult {
  address: string;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high';
  risk_tags: string[];
  diagnosis: string;
  confidence: number;
  warnings: string[];
  suggestions: string[];
}

export interface StreamChunk {
  type: 'text' | 'complete' | 'error';
  content: string;
  progress: number;
  metadata?: {
    risk_score: number;
    risk_level: string;
    risk_tags: string[];
    warnings: string[];
    suggestions: string[];
    confidence: number;
  };
}

interface UseAIDiagnosisReturn {
  isLoading: boolean;
  isStreaming: boolean;
  currentText: string;
  progress: number;
  result: AIDiagnosisResult | null;
  error: string | null;
  startDiagnosis: (address: string, riskScore: number, riskLevel: string, riskTags: string[], txCount: number, totalVolume: number) => void;
  cancelDiagnosis: () => void;
  hasCompleted: boolean;
}

export function useAIDiagnosis(): UseAIDiagnosisReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AIDiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasCompleted, setHasCompleted] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const textRef = useRef('');

  useEffect(() => {
    textRef.current = currentText;
  }, [currentText]);

  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
    setIsLoading(false);
  }, []);

  const cancelDiagnosis = useCallback(() => {
    cleanup();
    setError('Diagnosis cancelled');
  }, [cleanup]);

  const startDiagnosis = useCallback(
    async (
      address: string,
      riskScore: number,
      riskLevel: string,
      riskTags: string[],
      txCount: number,
      totalVolume: number,
    ) => {
      cleanup();
      setIsLoading(true);
      setIsStreaming(true);
      setCurrentText('');
      setProgress(0);
      setResult(null);
      setError(null);
      setHasCompleted(false);

      const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:3001';
      const streamUrl = `${apiBase}/api/address/${encodeURIComponent(address)}/diagnose/stream`;

      try {
        const eventSource = new EventSource(streamUrl, { withCredentials: false });
        eventSourceRef.current = eventSource;

        let fullText = '';
        let finalResult: AIDiagnosisResult | null = null;

        eventSource.onmessage = (event) => {
          try {
            const chunk: StreamChunk = JSON.parse(event.data);

            if (chunk.type === 'text') {
              fullText += chunk.content;
              setCurrentText(fullText);
              setProgress(chunk.progress);
            } else if (chunk.type === 'complete') {
              finalResult = {
                address,
                risk_score: chunk.metadata?.risk_score ?? riskScore,
                risk_level: (chunk.metadata?.risk_level as 'low' | 'medium' | 'high') ?? riskLevel as 'low' | 'medium' | 'high',
                risk_tags: chunk.metadata?.risk_tags ?? riskTags,
                diagnosis: fullText,
                confidence: chunk.metadata?.confidence ?? 0.7,
                warnings: chunk.metadata?.warnings ?? [],
                suggestions: chunk.metadata?.suggestions ?? [],
              };
              setResult(finalResult);
              setHasCompleted(true);
              setProgress(1);
              setIsStreaming(false);
              setIsLoading(false);
              eventSource.close();
              eventSourceRef.current = null;
            } else if (chunk.type === 'error') {
              setError(chunk.content || 'AI diagnosis failed');
              setIsStreaming(false);
              setIsLoading(false);
              eventSource.close();
              eventSourceRef.current = null;
            }
          } catch (e) {
            console.warn('Failed to parse SSE chunk:', e);
          }
        };

        eventSource.onerror = () => {
          if (!hasCompleted) {
            setError('Connection error during AI diagnosis');
          }
          setIsStreaming(false);
          setIsLoading(false);
          eventSource.close();
          eventSourceRef.current = null;
        };

        setTimeout(() => {
          if (isStreaming && !eventSourceRef.current) {
            setError('AI diagnosis timeout');
            setIsStreaming(false);
            setIsLoading(false);
          }
        }, 15000);
      } catch (e: any) {
        setError(e.message || 'Failed to start AI diagnosis');
        setIsStreaming(false);
        setIsLoading(false);
      }
    },
    [cleanup, hasCompleted, isStreaming],
  );

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isLoading,
    isStreaming,
    currentText,
    progress,
    result,
    error,
    startDiagnosis,
    cancelDiagnosis,
    hasCompleted,
  };
}
