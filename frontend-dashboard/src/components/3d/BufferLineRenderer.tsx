import { useRef, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ParticleNode } from '../../types';

const MAX_CONNECTIONS = 120;
const SEGMENTS_PER_LINE = 12;

interface BufferLineRendererProps {
  nodes: Map<string, ParticleNode>;
  transactions: Array<{ from: string; to: string; amount: number }>;
  visible: boolean;
}

export function BufferLineRenderer({ nodes, transactions, visible }: BufferLineRendererProps) {
  const lineRef = useRef<THREE.LineSegments>(null);
  const positionsRef = useRef<Float32Array>(new Float32Array(MAX_CONNECTIONS * SEGMENTS_PER_LINE * 2 * 3));
  const colorsRef = useRef<Float32Array>(new Float32Array(MAX_CONNECTIONS * SEGMENTS_PER_LINE * 2 * 3));
  const connectionDataRef = useRef<Array<{ from: ParticleNode; to: ParticleNode; opacity: number; color: THREE.Color }>>([]);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  const rebuildConnectionData = useCallback(() => {
    const connections: typeof connectionDataRef.current = [];
    const nodeArray = Array.from(nodes.values());

    transactions.forEach((tx) => {
      if (connections.length >= MAX_CONNECTIONS) return;
      const fromNode = nodes.get(tx.from);
      const toNode = nodes.get(tx.to);
      if (!fromNode || !toNode || fromNode.address === toNode.address) return;
      const avgRisk = (fromNode.riskScore + toNode.riskScore) / 2;
      if (avgRisk < 0.35) return;

      tmpColor.setRGB(
        (fromNode.color.r + toNode.color.r) / 2,
        (fromNode.color.g + toNode.color.g) / 2,
        (fromNode.color.b + toNode.color.b) / 2,
      );

      connections.push({
        from: fromNode,
        to: toNode,
        opacity: 0.15 + avgRisk * 0.45,
        color: tmpColor.clone(),
      });
    });

    for (let i = 0; i < nodeArray.length && connections.length < MAX_CONNECTIONS; i++) {
      for (let j = i + 1; j < Math.min(i + 5, nodeArray.length) && connections.length < MAX_CONNECTIONS; j++) {
        const a = nodeArray[i];
        const b = nodeArray[j];
        if (!a || !b) continue;
        const distSq =
          Math.pow(a.position.x - b.position.x, 2) +
          Math.pow(a.position.y - b.position.y, 2) +
          Math.pow(a.position.z - b.position.z, 2);
        if (distSq > 64) continue;

        const avgRisk = (a.riskScore + b.riskScore) / 2;
        if (avgRisk < 0.45) continue;
        if (Math.random() > 0.5) continue;

        tmpColor.setRGB(
          (a.color.r + b.color.r) / 2,
          (a.color.g + b.color.g) / 2,
          (a.color.b + b.color.b) / 2,
        );

        connections.push({
          from: a,
          to: b,
          opacity: 0.1 + avgRisk * 0.3,
          color: tmpColor.clone(),
        });
      }
    }

    connectionDataRef.current = connections;
  }, [nodes, transactions, tmpColor]);

  useMemo(() => {
    if (visible) rebuildConnectionData();
  }, [nodes, visible, rebuildConnectionData]);

  useFrame((state) => {
    if (!visible || !lineRef.current) return;
    const time = state.clock.elapsedTime;
    const connections = connectionDataRef.current;
    const pos = positionsRef.current;
    const col = colorsRef.current;

    let vertexOffset = 0;
    const maxLines = Math.min(connections.length, MAX_CONNECTIONS);
    const totalVertices = maxLines * SEGMENTS_PER_LINE * 2;

    for (let c = 0; c < maxLines; c++) {
      const conn = connections[c];
      if (!conn) break;

      const pulse = 0.8 + Math.sin(time * 2 + c * 0.4) * 0.2;
      const r = conn.color.r * pulse;
      const g = conn.color.g * pulse;
      const b = conn.color.b * pulse;
      const alpha = conn.opacity * pulse;

      for (let s = 0; s < SEGMENTS_PER_LINE; s++) {
        const t1 = s / SEGMENTS_PER_LINE;
        const t2 = (s + 1) / SEGMENTS_PER_LINE;

        const arcY = Math.sin(t1 * Math.PI) * 0.6;
        const x1 = conn.from.position.x + (conn.to.position.x - conn.from.position.x) * t1;
        const y1 = conn.from.position.y + (conn.to.position.y - conn.from.position.y) * t1 + arcY;
        const z1 = conn.from.position.z + (conn.to.position.z - conn.from.position.z) * t1;

        const arcY2 = Math.sin(t2 * Math.PI) * 0.6;
        const x2 = conn.from.position.x + (conn.to.position.x - conn.from.position.x) * t2;
        const y2 = conn.from.position.y + (conn.to.position.y - conn.from.position.y) * t2 + arcY2;
        const z2 = conn.from.position.z + (conn.to.position.z - conn.from.position.z) * t2;

        pos[vertexOffset] = x1;
        pos[vertexOffset + 1] = y1;
        pos[vertexOffset + 2] = z1;
        col[vertexOffset] = r;
        col[vertexOffset + 1] = g;
        col[vertexOffset + 2] = b;

        pos[vertexOffset + 3] = x2;
        pos[vertexOffset + 4] = y2;
        pos[vertexOffset + 5] = z2;
        col[vertexOffset + 3] = r;
        col[vertexOffset + 4] = g;
        col[vertexOffset + 5] = b;

        vertexOffset += 6;
      }
    }

    const geometry = lineRef.current.geometry as THREE.BufferGeometry;
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geometry.getAttribute('color') as THREE.BufferAttribute;

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    geometry.setDrawRange(0, totalVertices);
  });

  const bufferSize = MAX_CONNECTIONS * SEGMENTS_PER_LINE * 2;

  return (
    <group>
      <lineSegments ref={lineRef} visible={visible}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={bufferSize}
            array={positionsRef.current}
            itemSize={3}
            args={[positionsRef.current, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            count={bufferSize}
            array={colorsRef.current}
            itemSize={3}
            args={[colorsRef.current, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}
