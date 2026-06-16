import { useRef, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { InstancedParticles } from './InstancedParticles';
import { BufferLineRenderer } from './BufferLineRenderer';
import { useParticleSystem } from '../../hooks/useParticleSystem';
import { useAppStore } from '../../store/appStore';
import type { ParticleNode } from '../../types';
import { acquireSharedAssets, releaseSharedAssets } from '../../utils/threeAssets';
import { useEffect } from 'react';

interface Scene3DProps {
  showConnections: boolean;
}

export function Scene3D({ showConnections }: Scene3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { particleNodes, filteredRiskyNodes } = useParticleSystem();
  const { setHoveredNode, setSelectedNode, cameraMode } = useAppStore();

  useEffect(() => {
    acquireSharedAssets();
    return () => releaseSharedAssets();
  }, []);

  const handleNodeClick = useCallback(
    (node: ParticleNode) => {
      setSelectedNode(node);
    },
    [setSelectedNode],
  );

  const handleNodeHover = useCallback(
    (node: ParticleNode | null) => {
      setHoveredNode(node);
    },
    [setHoveredNode],
  );

  const connections = useMemo(() => {
    return filteredRiskyNodes
      .slice(0, 60)
      .map((tx, idx) => ({
        from: tx.address,
        to:
          filteredRiskyNodes[(idx + 7 + Math.floor(Math.random() * 5)) % filteredRiskyNodes.length]
            ?.address || tx.address,
        amount: tx.total_volume,
      }))
      .filter((c) => c.from !== c.to);
  }, [filteredRiskyNodes]);

  useFrame((_state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.015;
    }
  });

  return (
    <>
      <ambientLight intensity={0.12} />
      <pointLight position={[20, 20, 20]} intensity={0.5} color="#00ccff" />
      <pointLight position={[-20, -10, -20]} intensity={0.35} color="#ff3366" />
      <pointLight position={[0, 20, -20]} intensity={0.35} color="#00ff88" />
      <pointLight position={[0, -20, 0]} intensity={0.18} color="#cc66ff" />
      <hemisphereLight intensity={0.1} args={['#1a1a3a', '#050510', 0.1]} />

      <fog attach="fog" args={['#050510', 25, 70]} />

      <Stars
        radius={180}
        depth={90}
        count={10000}
        factor={5}
        saturation={0}
        fade
        speed={0.3}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -15, 0]}>
        <ringGeometry args={[18, 25, 128]} />
        <meshBasicMaterial color="#00ccff" transparent opacity={0.04} side={THREE.DoubleSide} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -15, 0]}>
        <ringGeometry args={[28, 30, 128]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.06} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -15, 0]}>
        <ringGeometry args={[33, 34, 128]} />
        <meshBasicMaterial color="#cc66ff" transparent opacity={0.04} />
      </mesh>

      <group ref={groupRef}>
        <InstancedParticles
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
        />

        <BufferLineRenderer
          nodes={particleNodes}
          transactions={connections}
          visible={showConnections}
        />
      </group>

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={8}
        maxDistance={55}
        autoRotate={cameraMode === 'orbit'}
        autoRotateSpeed={0.25}
        enableDamping
        dampingFactor={0.08}
      />

      <gridHelper
        args={[80, 40, '#004488', '#002244']}
        position={[0, -15, 0]}
      />

      <gridHelper
        args={[80, 40, '#004488', '#002244']}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, -35]}
      />
    </>
  );
}
