import type { Vec3 } from "./types"

const RESAMPLE_N = 64

// ─── Vec3 helpers ─────────────────────────────────────────────────────────────

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function dist(a: Vec3, b: Vec3): number {
  const d = sub(a, b)
  return Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z)
}

function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s }
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  }
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

function mag(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

function normalize(v: Vec3): Vec3 {
  const m = mag(v)
  if (m === 0) return { x: 0, y: 0, z: 0 }
  return { x: v.x / m, y: v.y / m, z: v.z / m }
}

// Rodrigues rotation: rotate v around unit axis k by theta
function rotateAroundAxis(v: Vec3, k: Vec3, theta: number): Vec3 {
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)
  const kv = dot(k, v)
  const kxv = cross(k, v)
  return {
    x: v.x * cosT + kxv.x * sinT + k.x * kv * (1 - cosT),
    y: v.y * cosT + kxv.y * sinT + k.y * kv * (1 - cosT),
    z: v.z * cosT + kxv.z * sinT + k.z * kv * (1 - cosT),
  }
}

// ─── Resample ─────────────────────────────────────────────────────────────────

function pathLength(pts: Vec3[]): number {
  let len = 0
  for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1]!, pts[i]!)
  return len
}

// Uniformly resample path to N points
function resample(pts: Vec3[], n: number): Vec3[] {
  if (pts.length === 0) return []
  const interval = pathLength(pts) / (n - 1)
  let accumulated = 0
  const result: Vec3[] = [pts[0]!]
  let carry: Vec3 | null = null

  for (let i = 1; i < pts.length; i++) {
    const prev = carry ?? pts[i - 1]!
    const curr = pts[i]!
    const d = dist(prev, curr)

    if (accumulated + d >= interval) {
      let remaining = interval - accumulated
      while (remaining <= d + 1e-8) {
        const t = remaining / d
        const pt = lerp(prev, curr, t)
        result.push(pt)
        if (result.length === n) return result
        remaining += interval
      }
      accumulated = d - (remaining - interval)
      carry = curr
    } else {
      accumulated += d
      carry = null
    }
  }

  // Fill remaining points with the last point if needed
  while (result.length < n) result.push(pts[pts.length - 1]!)
  return result
}

// ─── Normalize ────────────────────────────────────────────────────────────────

// Translate so centroid is at origin
function translateToOrigin(pts: Vec3[]): Vec3[] {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
  const cz = pts.reduce((s, p) => s + p.z, 0) / pts.length
  return pts.map(p => ({ x: p.x - cx, y: p.y - cy, z: p.z - cz }))
}

// Rotate all points so the first point aligns with +X axis.
// Mirrors $3's rotate_to_zero: provides a canonical orientation so that
// two recordings of the same gesture starting in different directions match.
function rotateToZero(pts: Vec3[]): Vec3[] {
  if (pts.length === 0) return pts
  const p0 = pts[0]!
  if (mag(p0) < 1e-10) return pts

  const ref: Vec3 = { x: 1, y: 0, z: 0 }
  const p0n = normalize(p0)
  const theta = Math.acos(Math.min(1, Math.max(-1, dot(p0n, ref))))
  if (theta < 1e-10) return pts

  const axis = normalize(cross(p0n, ref))
  // p0n anti-parallel to ref: pick any perpendicular axis for 180° rotation
  if (mag(axis) < 1e-10) {
    const perp: Vec3 = Math.abs(p0.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 }
    const fallback = normalize(cross(p0n, perp))
    return pts.map(p => rotateAroundAxis(p, fallback, Math.PI))
  }

  return pts.map(p => rotateAroundAxis(p, axis, theta))
}

// Scale so the bounding box fits in a unit cube (uniform — preserves aspect ratio)
function scaleTo1(pts: Vec3[]): Vec3[] {
  const xs = pts.map(p => p.x)
  const ys = pts.map(p => p.y)
  const zs = pts.map(p => p.z)
  const size = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
    Math.max(...zs) - Math.min(...zs),
  )
  if (size === 0) return pts
  return pts.map(p => scale(p, 1 / size))
}

export function normalize3D(pts: Vec3[]): Vec3[] {
  return scaleTo1(rotateToZero(translateToOrigin(resample(pts, RESAMPLE_N))))
}

// ─── Similarity ───────────────────────────────────────────────────────────────

// Average point-to-point distance between two normalized paths of the same length
function avgDistance(a: Vec3[], b: Vec3[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += dist(a[i]!, b[i]!)
  return sum / a.length
}

/**
 * Compare a candidate path against a template.
 * Both are normalized before comparison.
 * Returns similarity in [0, 1] where 1 = identical.
 */
export function similarity(candidate: Vec3[], template: Vec3[]): number {
  if (candidate.length < 2 || template.length < 2) return 0
  const normCandidate = normalize3D(candidate)
  const normTemplate  = normalize3D(template)
  const d = avgDistance(normCandidate, normTemplate)
  // Mirrors $3 score: 1 - d / half-diagonal of unit cube (√3/2 ≈ 0.866)
  return Math.max(0, 1 - d / (0.5 * Math.sqrt(3)))
}
