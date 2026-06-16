import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ParticleNode, RiskLevel } from '../../types';
import {
  acquireSharedAssets,
  releaseSharedAssets,
  riskLevelToGeometryKey,
} from '../../utils/threeAssets';
import { useAppStore } from '../../store/appStore';

const MAX_VISIBLE_NODES = 200;
const COLOR_BUFFER_MAX = 256;

interface InstancedParticlesProps {
  onNodeClick: (node: ParticleNode) => void;
  onNodeHover: (node: ParticleNode | null) => void;
}

interface InstanceState {
  particleKey: string;
  riskLevel: RiskLevel;
}

export function InstancedParticles({ onNodeClick, onNodeHover }: InstancedParticlesProps) {
  const {
    particleNodes,
    filterRiskLevel,
    selectedNode,
    hoveredNode,
    nodeSizeScale,
    isPaused,
  } = useAppStore();

  const groupRef = useRef<THREE.Group>(null);
  const instancedMeshesRef = useRef<Map<RiskLevel, THREE.InstancedMesh>>(new Map());
  const glowInstancedMeshesRef = useRef<Map<RiskLevel, THREE.InstancedMesh>>(new Map());
  const ringInstancedMeshesRef = useRef<THREE.InstancedMesh | null>(null);

  const instanceStatesRef = useRef<Map<THREE.InstancedMesh, InstanceState[]>>(new Map());
  const dummyMatrix = useMemo(() => new THREE.Matrix4(), []);
  const dummyPosition = useMemo(() => new THREE.Vector3(), []);
  const dummyQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const dummyScale = useMemo(() => new THREE.Vector3(), []);
  const dummyColor = useMemo(() => new THREE.Color(), []);

  const { gl } = useThree();

  useEffect(() => {
    acquireSharedAssets();
    return () => releaseSharedAssets();
  }, []);

  const assets = useMemo(() => acquireSharedAssets(), []);

  const levels: RiskLevel[] = useMemo(() => ['high', 'medium', 'low'], []);

  const sortedAndFilteredNodes = useMemo(() => {
    const all = Array.from(particleNodes.values()).filter((n) =>
      filterRiskLevel.includes(n.riskLevel),
    );
    all.sort((a, b) => b.riskScore - a.riskScore);
    return all.slice(0, MAX_VISIBLE_NODES);
  }, [particleNodes, filterRiskLevel]);

  const handleClick = useCallback(
    (e: any) => {
      e.stopPropagation();
      const mesh = e.object as THREE.InstancedMesh;
      const instanceId = e.instanceId as number;
      const states = instanceStatesRef.current.get(mesh);
      if (!states || instanceId === undefined || instanceId < 0) return;
      const state = states[instanceId];
      if (!state) return;
      const node = particleNodes.get(state.particleKey);
      if (node) onNodeClick(node);
    },
    [particleNodes, onNodeClick],
  );

  const handlePointerOver = useCallback(
    (e: any) => {
      e.stopPropagation();
      const mesh = e.object as THREE.InstancedMesh;
      const instanceId = e.instanceId as number;
      const states = instanceStatesRef.current.get(mesh);
      if (!states || instanceId === undefined || instanceId < 0) return;
      const state = states[instanceId];
      if (!state) return;
      const node = particleNodes.get(state.particleKey);
      if (node) {
        (e.target as any).style = { cursor: 'pointer' };
        onNodeHover(node);
      }
    },
    [particleNodes, onNodeHover],
  );

  const handlePointerOut = useCallback(
    (e: any) => {
      e.stopPropagation();
      onNodeHover(null);
    },
    [onNodeHover],
  );

  useFrame((state, delta) => {
    if (sortedAndFilteredNodes.length === 0) return;
    const time = !isPaused ? state.clock.elapsedTime : 0;
    const isSelected = selectedNode?.address;
    const isHovered = hoveredNode?.address;

    let globalInstanceIdx = 0;
    let ringInstanceIdx = 0;

    levels.forEach((level) => {
      const coreMesh = instancedMeshesRef.current.get(level);
      const glowMesh = glowInstancedMeshesRef.current.get(level);
      if (!coreMesh || !glowMesh) return;

      const coreStates: InstanceState[] = [];
      const glowStates: InstanceState[] = [];
      const levelNodes = sortedAndFilteredNodes.filter((n) => n.riskLevel === level);

      coreMesh.count = Math.min(levelNodes.length, MAX_VISIBLE_NODES);
      glowMesh.count = coreMesh.count;

      levelNodes.forEach((node, idx) => {
        if (idx >= MAX_VISIBLE_NODES) return;

        const isNodeSelected = node.address === isSelected;
        const isNodeHovered = node.address === isHovered;

        let scaleMul = 1;
        if (isNodeSelected) scaleMul *= 1.6;
        else if (isNodeHovered) scaleMul *= 1.25;

        const pulse = 1 + Math.sin(time * 2.5 + node.pulsePhase) * 0.08;
        const riskWobble = 1 + Math.sin(time * 3.5 + node.pulsePhase * 1.7) *
          (node.riskLevel === 'high' ? 0.15 : node.riskLevel === 'medium' ? 0.08 : 0.04);

        const baseSize = node.currentSize * nodeSizeScale * pulse * riskWobble;
        const finalSize = baseSize * scaleMul;

        const wobbleX = Math.sin(time * 1.5 + node.pulsePhase) * 0.25;
        const wobbleY = Math.cos(time * 1.2 + node.pulsePhase * 1.3) * 0.25;
        const wobbleZ = Math.sin(time * 0.9 + node.pulsePhase * 0.7) * 0.25;

        dummyPosition.set(
          node.position.x + wobbleX,
          node.position.y + wobbleY,
          node.position.z + wobbleZ,
        );
        dummyQuaternion.setFromEuler(
          new THREE.Euler(
            time * node.rotationSpeed * 30 + node.pulsePhase,
            time * node.rotationSpeed * 45 + node.pulsePhase,
            0,
          ),
        );

        dummyScale.setScalar(finalSize);
        dummyMatrix.compose(dummyPosition, dummyQuaternion, dummyScale);
        coreMesh.setMatrixAt(idx, dummyMatrix);
        coreStates.push({ particleKey: node.address, riskLevel: level });

        const colorJitter = node.riskScore * 0.06;
        const cr = Math.min(1, node.color.r + (Math.random() - 0.5) * colorJitter);
        const cg = Math.min(1, node.color.g + (Math.random() - 0.5) * colorJitter * 0.5);
        const cb = Math.min(1, node.color.b + (Math.random() - 0.5) * colorJitter);

        dummyColor.setRGB(cr, cg, cb);
        coreMesh.setColorAt(idx, dummyColor);

        dummyScale.setScalar(finalSize * 1.35);
        dummyMatrix.compose(dummyPosition, dummyQuaternion, dummyScale);
        glowMesh.setMatrixAt(idx, dummyMatrix);
        glowStates.push({ particleKey: node.address, riskLevel: level });
        glowMesh.setColorAt(idx, dummyColor);

        if (isNodeSelected || isNodeHovered || level === 'high') {
          const ringMesh = ringInstancedMeshesRef.current;
          if (ringMesh) {
            ringMesh.count = Math.max(ringMesh.count, ringInstanceIdx + 2);

            dummyScale.setScalar(finalSize * 1.5);
            dummyQuaternion.setFromEuler(
              new THREE.Euler(
                time * 50 * THREE.MathUtils.DEG2RAD,
                0,
                Math.PI / 4 + time * 30 * THREE.MathUtils.DEG2RAD,
              ),
            );
            dummyMatrix.compose(dummyPosition, dummyQuaternion, dummyScale);
            ringMesh.setMatrixAt(ringInstanceIdx, dummyMatrix);
            ringMesh.setColorAt(ringInstanceIdx, dummyColor);
            ringInstanceIdx++;

            dummyScale.setScalar(finalSize * 1.8);
            dummyQuaternion.setFromEuler(
              new THREE.Euler(
                Math.PI / 2,
                -time * 40 * THREE.MathUtils.DEG2RAD,
                -time * 20 * THREE.MathUtils.DEG2RAD,
              ),
            );
            dummyMatrix.compose(dummyPosition, dummyQuaternion, dummyScale);
            ringMesh.setMatrixAt(ringInstanceIdx, dummyMatrix);
            ringMesh.setColorAt(ringInstanceIdx, dummyColor);
            ringInstanceIdx++;
          }
        }

        globalInstanceIdx++;
      });

      coreMesh.instanceMatrix.needsUpdate = true;
      if (coreMesh.instanceColor) coreMesh.instanceColor.needsUpdate = true;
      glowMesh.instanceMatrix.needsUpdate = true;
      if (glowMesh.instanceColor) glowMesh.instanceColor.needsUpdate = true;

      instanceStatesRef.current.set(coreMesh, coreStates);
      instanceStatesRef.current.set(glowMesh, glowStates);
    });

    const ringMesh = ringInstancedMeshesRef.current;
    if (ringMesh) {
      if (ringInstanceIdx === 0) ringMesh.count = 0;
      else ringMesh.count = ringInstanceIdx;
      ringMesh.instanceMatrix.needsUpdate = true;
      if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;
    }

    gl.info.reset();
  });

  const createInstancedMesh = useCallback(
    (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      capacity: number,
      key: string,
    ): THREE.InstancedMesh => {
      const mesh = new THREE.InstancedMesh(geometry, material, capacity);
      mesh.count = 0;
      mesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(capacity * 3),
        3,
      );
      mesh.userData.key = key;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      return mesh;
    },
    [],
  );

  return (
    <group ref={groupRef}>
      {levels.map((level) => {
        const geoKey = riskLevelToGeometryKey(level);
        const geometry = assets.geometries[geoKey];

        const coreMaterial = assets.materials.core.clone();
        coreMaterial.transparent = true;
        coreMaterial.opacity = level === 'high' ? 0.88 : level === 'medium' ? 0.72 : 0.58;

        const glowMaterial = assets.materials.glow.clone();
        glowMaterial.side = THREE.BackSide;
        glowMaterial.transparent = true;

        return (
          <group key={level}>
            <instancedMesh
              ref={(el) => {
                if (el) instancedMeshesRef.current.set(level, el);
              }}
              args={[geometry, coreMaterial, MAX_VISIBLE_NODES]}
              count={0}
              onClick={handleClick}
              onPointerOver={handlePointerOver}
              onPointerOut={handlePointerOut}
              castShadow={false}
              receiveShadow={false}
              frustumCulled={false}
            />
            <instancedMesh
              ref={(el) => {
                if (el) glowInstancedMeshesRef.current.set(level, el);
              }}
              args={[geometry, glowMaterial, MAX_VISIBLE_NODES]}
              count={0}
            />
          </group>
        );
      })}

      <instancedMesh
        ref={(el) => {
          ringInstancedMeshesRef.current = el;
        }}
        args={[assets.ringGeometry, assets.materials.ring, MAX_VISIBLE_NODES * 2]}
        count={0}
      />
    </group>
  );
}
