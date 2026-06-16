import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '../store/appStore';
import type { RealtimeUpdate, InitialSnapshot } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/crypto-stream';

const SOCKET_MIN_RECONNECT_DELAY = 1500;
const SOCKET_MAX_RECONNECT_DELAY = 12000;
const SOCKET_MAX_RECONNECT_ATTEMPTS = 15;

const UPDATE_THROTTLE_MS = 120;
const MAX_TRANSACTION_QUEUE = 150;
const FLUSH_INTERVAL_MS = 100;

export function useCryptoStream() {
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttempts = useRef(0);

  const updateBufferRef = useRef<{
    riskyNodes: RealtimeUpdate['risky_nodes'];
    throughput: RealtimeUpdate['throughput'];
    transactions: RealtimeUpdate['live_transactions'];
    aggregated: RealtimeUpdate['aggregated'] | null;
    latestTimestamp: number;
  }>({
    riskyNodes: [],
    throughput: null,
    transactions: [],
    aggregated: null,
    latestTimestamp: 0,
  });

  const flushTimerRef = useRef<number | null>(null);
  const lastFlushRef = useRef(0);

  const {
    setConnected,
    setRiskyNodes,
    addThroughputPoint,
    setThroughputHistory,
    setLiveTransactions,
    setAggregatedStats,
    setLastUpdateTime,
    addLiveTransaction,
  } = useAppStore();

  const flushBufferedUpdates = useCallback(() => {
    const buffer = updateBufferRef.current;
    const now = Date.now();

    if (now - lastFlushRef.current < UPDATE_THROTTLE_MS) return;
    lastFlushRef.current = now;

    if (buffer.riskyNodes.length > 0) {
      setRiskyNodes(buffer.riskyNodes);
      buffer.riskyNodes = [];
    }

    if (buffer.throughput) {
      addThroughputPoint(buffer.throughput);
      buffer.throughput = null;
    }

    if (buffer.transactions.length > 0) {
      const txs = buffer.transactions.splice(0, Math.min(buffer.transactions.length, 10));
      txs.forEach((tx) => addLiveTransaction(tx));
    }

    if (buffer.aggregated) {
      setAggregatedStats(buffer.aggregated);
      buffer.aggregated = null;
    }

    if (buffer.latestTimestamp > 0) {
      setLastUpdateTime(buffer.latestTimestamp);
    }
  }, [setRiskyNodes, addThroughputPoint, setLiveTransactions, setAggregatedStats, setLastUpdateTime, addLiveTransaction]);

  const ensureFlushTimer = useCallback(() => {
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = window.setInterval(() => {
      flushBufferedUpdates();
    }, FLUSH_INTERVAL_MS);
  }, [flushBufferedUpdates]);

  const queueUpdate = useCallback(
    (update: RealtimeUpdate) => {
      const buffer = updateBufferRef.current;

      if (update.risky_nodes && update.risky_nodes.length > 0) {
        buffer.riskyNodes = update.risky_nodes;
      }

      if (update.throughput) {
        buffer.throughput = update.throughput;
      }

      if (update.live_transactions && update.live_transactions.length > 0) {
        buffer.transactions = [...buffer.transactions, ...update.live_transactions]
          .slice(-MAX_TRANSACTION_QUEUE);
      }

      if (update.aggregated) {
        buffer.aggregated = update.aggregated;
      }

      buffer.latestTimestamp = Math.max(buffer.latestTimestamp, update.timestamp);

      ensureFlushTimer();
    },
    [ensureFlushTimer],
  );

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    console.log(`🔌 Connecting to WebSocket: ${WS_URL}`);

    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: SOCKET_MIN_RECONNECT_DELAY,
      reconnectionDelayMax: SOCKET_MAX_RECONNECT_DELAY,
      reconnectionAttempts: SOCKET_MAX_RECONNECT_ATTEMPTS,
      timeout: 15000,
      forceNew: false,
      upgrade: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setConnected(true);
      reconnectAttempts.current = 0;
      socket.emit('request_snapshot');
      ensureFlushTimer();
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      reconnectAttempts.current++;
      const attemptsLeft = SOCKET_MAX_RECONNECT_ATTEMPTS - reconnectAttempts.current;
      console.warn(
        `⚠️  WebSocket connection error (attempt ${reconnectAttempts.current}/${SOCKET_MAX_RECONNECT_ATTEMPTS}, ${attemptsLeft} left): ${error.message}`,
      );
      if (attemptsLeft <= 0) {
        console.error('❌ Max reconnection attempts reached. Stopping.');
        socket.disconnect();
      }
    });

    socket.on('connected', (data) => {
      console.log('🎯 Server handshake:', data.message);
    });

    socket.on('initial_snapshot', (data: InitialSnapshot) => {
      console.log(`📸 Initial snapshot: ${data.risky_nodes.length} nodes, ${data.throughput_history.length} throughput pts`);
      setRiskyNodes(data.risky_nodes);
      setThroughputHistory(data.throughput_history);
      setLiveTransactions(data.live_transactions);
      setAggregatedStats(data.aggregated);
      setLastUpdateTime(data.timestamp);
    });

    socket.on('realtime_update', (data: RealtimeUpdate) => {
      queueUpdate(data);
    });

    socket.on('error', (error) => {
      console.error('⚠️  WebSocket protocol error:', error);
    });

    return () => {
      if (flushTimerRef.current !== null) {
        clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      socket.disconnect();
    };
  }, [
    setConnected,
    setRiskyNodes,
    setThroughputHistory,
    setLiveTransactions,
    setAggregatedStats,
    setLastUpdateTime,
    ensureFlushTimer,
    queueUpdate,
  ]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      setConnected(false);
    }
  }, [setConnected]);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttempts.current = 0;
    setTimeout(() => connect(), 500);
  }, [connect, disconnect]);

  useEffect(() => {
    const cleanup = connect();

    const handleReconnectEvent = () => {
      console.log('🔄 Received reconnect event');
      reconnect();
    };

    const handleDisconnectEvent = () => {
      console.log('🔌 Received disconnect event');
      disconnect();
    };

    window.addEventListener('crypto-stream-reconnect', handleReconnectEvent);
    window.addEventListener('crypto-stream-disconnect', handleDisconnectEvent);

    return () => {
      cleanup?.();
      window.removeEventListener('crypto-stream-reconnect', handleReconnectEvent);
      window.removeEventListener('crypto-stream-disconnect', handleDisconnectEvent);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (flushTimerRef.current !== null) {
        clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, [connect, disconnect, reconnect]);

  return {
    isConnected: useAppStore((state) => state.isConnected),
    connect,
    disconnect,
    reconnect,
  };
}
