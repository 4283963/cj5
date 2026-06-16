import * as THREE from 'three';
import type { RiskLevel } from '../types';

export interface SharedAssets {
  geometries: {
    high: THREE.BufferGeometry;
    medium: THREE.BufferGeometry;
    low: THREE.BufferGeometry;
    ring: THREE.BufferGeometry;
  };
  materials: {
    core: THREE.MeshStandardMaterial;
    glow: THREE.MeshBasicMaterial;
    ring: THREE.MeshBasicMaterial;
    line: THREE.LineBasicMaterial;
  };
  ringGeometry: THREE.BufferGeometry;
}

let cachedAssets: SharedAssets | null = null;
let refCount = 0;

export function acquireSharedAssets(): SharedAssets {
  if (!cachedAssets) {
    cachedAssets = {
      geometries: {
        high: new THREE.IcosahedronGeometry(1, 2),
        medium: new THREE.OctahedronGeometry(1, 1),
        low: new THREE.SphereGeometry(1, 12, 12),
        ring: new THREE.TorusGeometry(1, 0.02, 8, 32),
      },
      materials: {
        core: new THREE.MeshStandardMaterial({
          metalness: 0.85,
          roughness: 0.15,
          transparent: true,
        }),
        glow: new THREE.MeshBasicMaterial({
          side: THREE.BackSide,
          transparent: true,
          opacity: 0.35,
        }),
        ring: new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0.5,
        }),
        line: new THREE.LineBasicMaterial({
          transparent: true,
          opacity: 0.3,
        }),
      },
      ringGeometry: new THREE.TorusGeometry(1, 0.02, 8, 32),
    };
  }
  refCount++;
  return cachedAssets;
}

export function releaseSharedAssets(): void {
  refCount--;
  if (refCount <= 0 && cachedAssets) {
    Object.values(cachedAssets.geometries).forEach((g) => g.dispose());
    Object.values(cachedAssets.materials).forEach((m) => m.dispose());
    cachedAssets.ringGeometry.dispose();
    cachedAssets = null;
    refCount = 0;
  }
}

export function riskLevelToGeometryKey(level: RiskLevel): 'high' | 'medium' | 'low' {
  return level;
}

export function createColorForLevel(level: RiskLevel, score: number): THREE.Color {
  const t = Math.min(1, Math.max(0, score));
  const color = new THREE.Color();
  switch (level) {
    case 'high':
      color.setRGB(1.0, 0.2 + t * 0.3, 0.4);
      break;
    case 'medium':
      color.setRGB(1.0, 0.7 + t * 0.3, 0.0);
      break;
    case 'low':
    default:
      color.setRGB(0.0, 0.7 + t * 0.3, 0.53);
      break;
  }
  return color;
}
