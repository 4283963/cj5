import type { RiskLevel } from '../types';

export function riskScoreToColor(score: number, level: RiskLevel): { r: number; g: number; b: number } {
  const colors = {
    high: { r: 1.0, g: 0.2, b: 0.4 },
    medium: { r: 1.0, g: 0.8, b: 0.0 },
    low: { r: 0.0, g: 1.0, b: 0.53 },
  };

  const base = colors[level];
  const intensity = level === 'high' ? 0.7 + score * 0.3 : level === 'medium' ? 0.5 + score * 0.5 : 0.3 + score * 0.7;

  return {
    r: Math.min(1, base.r * intensity),
    g: Math.min(1, base.g * intensity),
    b: Math.min(1, base.b * intensity),
  };
}

export function volumeToSize(volume: number, scale: number = 1): number {
  const logVolume = Math.log10(Math.max(volume, 1));
  const minSize = 0.3;
  const maxSize = 2.5;
  const normalized = (logVolume - 9) / 5;
  return Math.max(minSize, Math.min(maxSize, minSize + normalized * maxSize)) * scale;
}

export function generateSphericalPosition(index: number, total: number, radius: number = 15): { x: number; y: number; z: number } {
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  const i = index + 0.5;
  const theta = 2 * Math.PI * i / goldenRatio;
  const phi = Math.acos(1 - 2 * i / total);

  return {
    x: radius * Math.cos(theta) * Math.sin(phi),
    y: radius * Math.sin(theta) * Math.sin(phi),
    z: radius * Math.cos(phi),
  };
}

export function generateClusterPosition(
  index: number,
  clusterIndex: number,
  totalInCluster: number,
  level: RiskLevel,
): { x: number; y: number; z: number } {
  const clusterCenters = {
    high: { x: -10, y: 5, z: 0 },
    medium: { x: 0, y: -5, z: 8 },
    low: { x: 10, y: 2, z: -8 },
  };

  const center = clusterCenters[level];
  const clusterRadius = level === 'high' ? 6 : level === 'medium' ? 8 : 10;

  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  const i = index + 0.5;
  const theta = 2 * Math.PI * i / goldenRatio;
  const phi = Math.acos(1 - 2 * i / Math.max(totalInCluster, 1));

  return {
    x: center.x + clusterRadius * Math.cos(theta) * Math.sin(phi),
    y: center.y + clusterRadius * Math.sin(theta) * Math.sin(phi),
    z: center.z + clusterRadius * Math.cos(phi),
  };
}

export function generateHexColor(c: { r: number; g: number; b: number }): string {
  const r = Math.floor(c.r * 255).toString(16).padStart(2, '0');
  const g = Math.floor(c.g * 255).toString(16).padStart(2, '0');
  const b = Math.floor(c.b * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function formatAddress(addr: string, start: number = 6, end: number = 6): string {
  if (!addr || addr.length < start + end) return addr || '';
  return `${addr.slice(0, start)}...${addr.slice(-end)}`;
}

export function formatVolume(volume: number): string {
  if (volume >= 1e12) return `${(volume / 1e12).toFixed(2)}T`;
  if (volume >= 1e9) return `${(volume / 1e9).toFixed(2)}B`;
  if (volume >= 1e6) return `${(volume / 1e6).toFixed(2)}M`;
  if (volume >= 1e3) return `${(volume / 1e3).toFixed(2)}K`;
  return volume.toString();
}

export function formatSol(volume: number): string {
  const sol = volume / 1e9;
  if (sol >= 1e6) return `${(sol / 1e6).toFixed(2)}M SOL`;
  if (sol >= 1e3) return `${(sol / 1e3).toFixed(2)}K SOL`;
  return `${sol.toFixed(2)} SOL`;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpColor(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
): { r: number; g: number; b: number } {
  return {
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function easeOutElastic(t: number): number {
  const p = 0.3;
  return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
}
