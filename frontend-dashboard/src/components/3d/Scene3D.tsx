import { useRef, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars, OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { RiskParticle } from './RiskParticle';
import { ConnectionLines } from './ConnectionLines';
import { useParticleSystem } from '../../hooks/useParticleSystem';
import { useAppStore } from '../../store/appStore';
import type { ParticleNode } from '../../types';

interface Scene3DProps {
  showConnections: boolean;
}

export function Scene3D({ showConnections }: Scene3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { particleNodes, filteredRiskyNodes } = useParticleSystem();
  const {
    hoveredNode,
    setHoveredNode,
    selectedNode,
    setSelectedNode,
    cameraMode,
  } = useAppStore();

  const handlePointerOver = useCallback((node: ParticleNode) => {
    setHoveredNode(node);
  }, [setHoveredNode]);

  const handlePointerOut = useCallback(() => {
    setHoveredNode(null);
  }, [setHoveredNode]);

  const handleClick = useCallback((node: ParticleNode) => {
    setSelectedNode(node);
  }, [setSelectedNode]);

  const nodeArray = useMemo(() => Array.from(particleNodes.values()), [particleNodes]);

  const connections = useMemo(() => {
    return filteredRiskyNodes.slice(0, 30).map((tx) => ({
      from: tx.address,
      to: filteredRiskyNodes[Math.floor(Math.random() * filteredRiskyNodes.length)]?.address || tx.address,
      amount: tx.total_volume,
    })).filter((c) => c.from !== c.to);
  }, [filteredRiskyNodes]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.02;
    }
  });

  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight position={[20, 20, 20]} intensity={0.6} color="#00ccff" />
      <pointLight position={[-20, -10, -20]} intensity={0.4} color="#ff3366" />
      <pointLight position={[0, 20, -20]} intensity={0.4} color="#00ff88" />
      <pointLight position={[0, -20, 0]} intensity={0.2} color="#cc66ff" />

      <fog attach="fog" args={['#050510', 20, 60]} />

      <Stars
        radius={150}
        depth={80}
        count={8000}
        factor={5}
        saturation={0}
        fade
        speed={0.5}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -15, 0]}>
        <ringGeometry args={[18, 25, 128]} />
        <meshBasicMaterial
          color="#00ccff"
          transparent
          opacity={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -15, 0]}>
        <ringGeometry args={[28, 30, 128]} />
        <meshBasicMaterial
          color="#00ff88"
          transparent
          opacity={0.08}
        />
      </mesh>

      <group ref={groupRef}>
        {nodeArray.map((node) => (
          <RiskParticle
            key={node.address}
            node={node}
            isHovered={hoveredNode?.address === node.address}
            isSelected={selectedNode?.address === node.address}
            onClick={handleClick}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
          />
        ))}

        {showConnections && (
          <ConnectionLines
            nodes={particleNodes}
            transactions={connections}
          />
        )}
      </group>

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={60}
        autoRotate={cameraMode === 'orbit'}
        autoRotateSpeed={0.3}
        enableDamping
        dampingFactor={0.05}
      />

      <gridHelper
        args={[80, 40, '#0066cc', '#003366']}
        position={[0, -15, 0]}
        transparent
        opacity={0.15}
      />
    </>
  );
}
