import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAppStore } from '../store/appStore';
import type { ParticleNode, RiskAddress } from '../types';
import {
  riskScoreToColor,
  volumeToSize,
  generateSphericalPosition,
  lerp,
  lerpColor,
  clamp,
} from '../utils/visualization';

const MAX_ACTIVE_NODES = 200;
const NODE_UPDATE_INTERVAL_MS = 80;
const POSITION_LERP_FACTOR = 0.12;
const SIZE_LERP_FACTOR = 0.1;
const COLOR_LERP_FACTOR = 0.15;

export function useParticleSystem() {
  const {
    riskyNodes,
    filterRiskLevel,
    nodeSizeScale,
    isPaused,
    setParticleNodes,
  } = useAppStore();

  const lastUpdateRef = useRef<number>(0);
  const nodeMapRef = useRef<Map<string, ParticleNode>>(new Map());
  const totalProcessedRef = useRef<number>(0);

  const filteredRiskyNodes = useMemo(() => {
    return riskyNodes.filter((node) => filterRiskLevel.includes(node.risk_level));
  }, [riskyNodes, filterRiskLevel]);

  const syncRiskNodes = useCallback(() => {
    const currentMap = nodeMapRef.current;
    const now = Date.now();

    const highRiskNodes = filteredRiskyNodes.filter((n) => n.risk_level === 'high');
    const mediumRiskNodes = filteredRiskyNodes.filter((n) => n.risk_level === 'medium');
    const lowRiskNodes = filteredRiskyNodes.filter((n) => n.risk_level === 'low');

    const allSorted = [...highRiskNodes, ...mediumRiskNodes, ...lowRiskNodes].slice(
      0,
      MAX_ACTIVE_NODES,
    );
    const total = allSorted.length;

    const addressesInUse = new Set<string>();

    allSorted.forEach((riskNode: RiskAddress, index: number) => {
      addressesInUse.add(riskNode.address);
      const existing = currentMap.get(riskNode.address);
      const targetColor = riskScoreToColor(riskNode.risk_score, riskNode.risk_level);
      const targetSize = volumeToSize(riskNode.total_volume, nodeSizeScale);

      if (existing) {
        existing.riskScore = riskNode.risk_score;
        existing.riskLevel = riskNode.risk_level;
        existing.riskTags = riskNode.risk_tags;
        existing.volume = riskNode.total_volume;
        existing.txCount = riskNode.total_transactions;
        existing.targetSize = targetSize;
        existing.targetColor = targetColor;
        existing.lastUpdated = now;
      } else {
        const position = generateSphericalPosition(
          index + totalProcessedRef.current,
          Math.max(total, 50),
          18,
        );
        currentMap.set(riskNode.address, {
          id: riskNode.address,
          address: riskNode.address,
          position: { ...position },
          basePosition: { ...position },
          targetSize: targetSize,
          currentSize: 0.01,
          riskScore: riskNode.risk_score,
          riskLevel: riskNode.risk_level,
          riskTags: riskNode.risk_tags,
          volume: riskNode.total_volume,
          txCount: riskNode.total_transactions,
          color: { ...targetColor },
          targetColor: targetColor,
          pulsePhase: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.02,
          velocity: {
            x: (Math.random() - 0.5) * 0.002,
            y: (Math.random() - 0.5) * 0.002,
            z: (Math.random() - 0.5) * 0.002,
          },
          connections: [],
          createdAt: now,
          lastUpdated: now,
        });
        totalProcessedRef.current++;
      }
    });

    for (const key of currentMap.keys()) {
      if (!addressesInUse.has(key)) {
        currentMap.delete(key);
      }
    }
  }, [filteredRiskyNodes, nodeSizeScale]);

  useEffect(() => {
    syncRiskNodes();
  }, [syncRiskNodes]);

  useFrame((_state, delta) => {
    if (isPaused) return;

    const now = Date.now();
    if (now - lastUpdateRef.current < NODE_UPDATE_INTERVAL_MS) return;
    lastUpdateRef.current = now;

    const currentNodes = nodeMapRef.current;
    if (currentNodes.size === 0) return;

    const time = now * 0.001;

    currentNodes.forEach((node) => {
      const { targetSize, targetColor, basePosition, riskScore, riskLevel } = node;

      node.currentSize = lerp(node.currentSize, targetSize, SIZE_LERP_FACTOR);

      node.color = lerpColor(node.color, targetColor, COLOR_LERP_FACTOR);

      const pulseAmount = Math.sin(time * 2 + node.pulsePhase) * 0.08 + 1;
      const riskIntensity =
        riskLevel === 'high' ? 0.15 : riskLevel === 'medium' ? 0.08 : 0.03;
      const jitterAmount = Math.sin(time * 3 + node.pulsePhase * 1.7) * riskIntensity;

      node.currentSize = clamp(
        node.currentSize * pulseAmount * (1 + jitterAmount),
        0.2,
        3.5 * nodeSizeScale,
      );

      const wobbleX = Math.sin(time * 1.5 + node.pulsePhase) * 0.3;
      const wobbleY = Math.cos(time * 1.2 + node.pulsePhase * 1.3) * 0.3;
      const wobbleZ = Math.sin(time * 0.8 + node.pulsePhase * 0.7) * 0.3;

      const targetPosX = basePosition.x + wobbleX + node.velocity.x * time * 60;
      const targetPosY = basePosition.y + wobbleY + node.velocity.y * time * 60;
      const targetPosZ = basePosition.z + wobbleZ + node.velocity.z * time * 60;

      node.position.x = lerp(node.position.x, targetPosX, POSITION_LERP_FACTOR);
      node.position.y = lerp(node.position.y, targetPosY, POSITION_LERP_FACTOR);
      node.position.z = lerp(node.position.z, targetPosZ, POSITION_LERP_FACTOR);

      const colorJitter = riskScore * 0.05;
      node.color.r = clamp(node.color.r + (Math.random() - 0.5) * colorJitter, 0, 1);
      node.color.g = clamp(node.color.g + (Math.random() - 0.5) * colorJitter * 0.5, 0, 1);
      node.color.b = clamp(node.color.b + (Math.random() - 0.5) * colorJitter, 0, 1);
    });

    setParticleNodes(new Map(currentNodes));
  });

  return {
    particleNodes: nodeMapRef.current,
    filteredRiskyNodes,
    maxActiveNodes: MAX_ACTIVE_NODES,
  };
}
