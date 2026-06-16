import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store/appStore';
import type { ParticleNode } from '../types';
import { generateHexColor } from '../utils/visualization';

interface RiskParticleProps {
  node: ParticleNode;
  isHovered: boolean;
  isSelected: boolean;
  onClick: (node: ParticleNode) => void;
  onPointerOver: (node: ParticleNode) => void;
  onPointerOut: () => void;
}

const RING1_ROTATION: [number, number, number] = [0, 0, Math.PI / 4];
const RING2_ROTATION: [number, number, number] = [Math.PI / 2, 0, 0];

export function RiskParticle({
  node,
  isHovered,
  isSelected,
  onClick,
  onPointerOver,
  onPointerOut,
}: RiskParticleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  const { setSelectedNode } = useAppStore();

  const color = useMemo(() => generateHexColor(node.color), [node.color]);
  const glowColor = useMemo(() => {
    const c = node.color;
    return generateHexColor({
      r: Math.min(1, c.r * 1.5),
      g: Math.min(1, c.g * 1.5),
      b: Math.min(1, c.b * 1.5),
    });
  }, [node.color]);

  const geometry = useMemo(() => {
    if (node.riskLevel === 'high') {
      return new THREE.IcosahedronGeometry(1, 2);
    } else if (node.riskLevel === 'medium') {
      return new THREE.OctahedronGeometry(1, 1);
    }
    return new THREE.SphereGeometry(1, 16, 16);
  }, [node.riskLevel]);

  const size = useMemo(() => {
    let s = node.currentSize;
    if (isSelected) s *= 1.5;
    if (isHovered) s *= 1.2;
    return s;
  }, [node.currentSize, isSelected, isHovered]);

  const opacity = useMemo(() => {
    if (isSelected) return 1;
    if (isHovered) return 0.95;
    if (node.riskLevel === 'high') return 0.85;
    if (node.riskLevel === 'medium') return 0.7;
    return 0.55;
  }, [isSelected, isHovered, node.riskLevel]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.x += node.rotationSpeed * 0.5;
      groupRef.current.rotation.y += node.rotationSpeed * 0.8;
      groupRef.current.position.set(node.position.x, node.position.y, node.position.z);
    }

    if (ring1Ref.current) {
      ring1Ref.current.rotation.x += delta * 0.5;
      ring1Ref.current.rotation.z += delta * 0.3;
    }

    if (ring2Ref.current) {
      ring2Ref.current.rotation.y -= delta * 0.4;
      ring2Ref.current.rotation.x -= delta * 0.2;
    }

    if (glowRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3 + node.pulsePhase) * 0.2;
      glowRef.current.scale.setScalar(size * scale * 1.3);
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 2 + node.pulsePhase) * 0.15;
      }
    }
  });

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        onClick(node);
        setSelectedNode(isSelected ? null : node);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
        onPointerOver(node);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'auto';
        onPointerOut();
      }}
    >
      <mesh ref={glowRef} geometry={geometry} scale={size * 1.3}>
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.4}
          side={THREE.BackSide}
        />
      </mesh>

      <mesh ref={meshRef} geometry={geometry} scale={size}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.8 : isHovered ? 0.5 : 0.3}
          transparent
          opacity={opacity}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {(isSelected || isHovered || node.riskLevel === 'high') && (
        <>
          <mesh ref={ring1Ref} rotation={RING1_ROTATION}>
            <torusGeometry args={[size * 1.5, 0.02, 8, 32]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.6}
            />
          </mesh>
          <mesh ref={ring2Ref} rotation={RING2_ROTATION}>
            <torusGeometry args={[size * 1.8, 0.015, 8, 32]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.4}
            />
          </mesh>
        </>
      )}

      <pointLight
        color={color}
        intensity={isSelected ? 2 : isHovered ? 1.5 : node.riskScore * 0.8}
        distance={size * 8}
        decay={2}
      />
    </group>
  );
}
