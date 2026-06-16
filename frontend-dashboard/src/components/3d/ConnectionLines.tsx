import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ParticleNode } from '../../types';
import { generateHexColor } from '../../utils/visualization';

interface ConnectionLinesProps {
  nodes: Map<string, ParticleNode>;
  transactions: Array<{ from: string; to: string; amount: number }>;
}

export function ConnectionLines({ nodes, transactions }: ConnectionLinesProps) {
  const groupRef = useRef<THREE.Group>(null);

  const lineData = useMemo(() => {
    const lines: Array<{
      start: THREE.Vector3;
      end: THREE.Vector3;
      color: string;
      opacity: number;
      amount: number;
    }> = [];

    transactions.forEach((tx) => {
      const fromNode = nodes.get(tx.from);
      const toNode = nodes.get(tx.to);
      if (fromNode && toNode && fromNode.address !== toNode.address) {
        const avgRisk = (fromNode.riskScore + toNode.riskScore) / 2;
        if (avgRisk > 0.4) {
          lines.push({
            start: new THREE.Vector3(
              fromNode.position.x,
              fromNode.position.y,
              fromNode.position.z
            ),
            end: new THREE.Vector3(
              toNode.position.x,
              toNode.position.y,
              toNode.position.z
            ),
            color: generateHexColor({
              r: (fromNode.color.r + toNode.color.r) / 2,
              g: (fromNode.color.g + toNode.color.g) / 2,
              b: (fromNode.color.b + toNode.color.b) / 2,
            }),
            opacity: 0.2 + avgRisk * 0.4,
            amount: tx.amount,
          });
        }
      }
    });

    const nodeArray = Array.from(nodes.values());
    for (let i = 0; i < nodeArray.length; i++) {
      for (let j = i + 1; j < Math.min(i + 4, nodeArray.length); j++) {
        const a = nodeArray[i];
        const b = nodeArray[j];
        if (!a || !b) continue;
        const dist = Math.sqrt(
          Math.pow(a.position.x - b.position.x, 2) +
          Math.pow(a.position.y - b.position.y, 2) +
          Math.pow(a.position.z - b.position.z, 2)
        );

        if (dist < 8 && Math.random() < 0.3) {
          const avgRisk = (a.riskScore + b.riskScore) / 2;

          if (avgRisk > 0.5) {
            lines.push({
              start: new THREE.Vector3(a.position.x, a.position.y, a.position.z),
              end: new THREE.Vector3(b.position.x, b.position.y, b.position.z),
              color: generateHexColor({
                r: (a.color.r + b.color.r) / 2,
                g: (a.color.g + b.color.g) / 2,
                b: (a.color.b + b.color.b) / 2,
              }),
              opacity: 0.15 + avgRisk * 0.3,
              amount: (a.volume + b.volume) / 2,
            });
          }
        }
      }
    }

    return lines.slice(0, 80);
  }, [nodes, transactions]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.elapsedTime;

    groupRef.current.children.forEach((child, idx) => {
      const line = child as THREE.Line;
      const mat = line.material as THREE.LineBasicMaterial;
      if (mat) {
        const pulse = Math.sin(time * 2 + idx * 0.3) * 0.1 + 0.9;
        mat.opacity = lineData[idx]?.opacity * pulse || 0.1;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {lineData.map((line, idx) => {
        const points = [];
        const segments = 16;
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const x = line.start.x + (line.end.x - line.start.x) * t;
          const y = line.start.y + (line.end.y - line.start.y) * t +
                    Math.sin(t * Math.PI) * 0.5;
          const z = line.start.z + (line.end.z - line.start.z) * t;
          points.push(new THREE.Vector3(x, y, z));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        return (
          <line key={idx} geometry={geometry}>
            <lineBasicMaterial
              color={line.color}
              transparent
              opacity={line.opacity}
              linewidth={1}
            />
          </line>
        );
      })}
    </group>
  );
}
