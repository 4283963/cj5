import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '../store/appStore';
import type { RealtimeUpdate, InitialSnapshot } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/crypto-stream';

export function useCryptoStream() {
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  const {
    setConnected,
    setRiskyNodes,
    addThroughputPoint,
    setThroughputHistory,
    addLiveTransaction,
    setLiveTransactions,
    setAggregatedStats,
    setLastUpdateTime,
  } = useAppStore();

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    console.log(`🔌 Connecting to WebSocket: ${WS_URL}`);

    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setConnected(true);
      reconnectAttempts.current = 0;
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.warn('⚠️  WebSocket connection error:', error.message);
      reconnectAttempts.current++;
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.error('❌ Max reconnection attempts reached');
      }
    });

    socket.on('connected', (data) => {
      console.log('🎯 Server handshake:', data.message);
      socket.emit('request_snapshot');
    });

    socket.on('initial_snapshot', (data: InitialSnapshot) => {
      console.log(`📸 Initial snapshot received: ${data.risky_nodes.length} nodes`);
      setRiskyNodes(data.risky_nodes);
      setThroughputHistory(data.throughput_history);
      setLiveTransactions(data.live_transactions);
      setAggregatedStats(data.aggregated);
      setLastUpdateTime(data.timestamp);
    });

    socket.on('realtime_update', (data: RealtimeUpdate) => {
      setRiskyNodes(data.risky_nodes);
      if (data.throughput) {
        addThroughputPoint(data.throughput);
      }
      data.live_transactions.forEach((tx) => {
        addLiveTransaction(tx);
      });
      setAggregatedStats(data.aggregated);
      setLastUpdateTime(data.timestamp);
    });

    socket.on('error', (error) => {
      console.error('⚠️  WebSocket error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, [
    setConnected,
    setRiskyNodes,
    addThroughputPoint,
    setThroughputHistory,
    addLiveTransaction,
    setLiveTransactions,
    setAggregatedStats,
    setLastUpdateTime,
  ]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      setConnected(false);
    }
  }, [setConnected]);

  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => connect(), 500);
  }, [connect, disconnect]);

  return {
    isConnected: useAppStore((state) => state.isConnected),
    connect,
    disconnect,
    reconnect,
  };
}
