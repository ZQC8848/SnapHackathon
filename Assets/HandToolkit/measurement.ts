import type { Vec3, NormalizedHand, FingerName, JointName, FingerMetric } from "./types"
import { FINGER_JOINTS } from "./types"

// ─── Vec3 primitives ──────────────────────────────────────────────────────────

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

export function magnitude(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

export function normalize(v: Vec3): Vec3 {
  const m = magnitude(v)
  if (m === 0) return { x: 0, y: 0, z: 0 }
  return { x: v.x / m, y: v.y / m, z: v.z / m }
}

export function distance(a: Vec3, b: Vec3): number {
  return magnitude(subtract(a, b))
}

/**
 * Angle in radians at joint b formed by a → b → c. Returns [0, π].
 */
export function angle(a: Vec3, b: Vec3, c: Vec3): number {
  const ba = normalize(subtract(a, b))
  const bc = normalize(subtract(c, b))
  return Math.acos(Math.min(1, Math.max(-1, dot(ba, bc))))
}


// Adjacent proximal joints for spread calculation
const ADJACENT_PROXIMAL: Record<FingerName, JointName[]> = {
  thumb:  ["indexKnuckle"],
  index:  ["middleKnuckle"],
  middle: ["indexKnuckle", "ringKnuckle"],
  ring:   ["pinkyKnuckle"],
  little: ["ringKnuckle"],
}

// Maximum spread angle (~22.5 degrees) for normalization
const MAX_SPREAD_RAD = Math.PI / 8

// Reference distance for pinch normalization (fully open hand ≈ 10cm)
const PINCH_MAX_DISTANCE = 0.1

// ─── Public measurement functions ────────────────────────────────────────────

/**
 * Full curl: PIP joint angle (proximal → intermediate → distal).
 * 0 = straight, 1 = fully curled.
 */
export function fingerCurl(hand: NormalizedHand, finger: FingerName): number {
  const j = FINGER_JOINTS[finger]
  const a = angle(hand.joints[j.proximal], hand.joints[j.intermediate], hand.joints[j.distal])
  return Math.min(1, Math.max(0, a / Math.PI))
}

/**
 * Base curl: MCP joint angle (metacarpal → proximal → intermediate).
 * 0 = straight, 1 = fully curled.
 */
export function fingerBaseCurl(hand: NormalizedHand, finger: FingerName): number {
  const j = FINGER_JOINTS[finger]
  const a = angle(hand.joints[j.metacarpal], hand.joints[j.proximal], hand.joints[j.intermediate])
  return Math.min(1, Math.max(0, a / Math.PI))
}

/**
 * Tip curl: DIP joint angle (intermediate → distal → tip).
 * For thumb (no DIP joint), returns the same as fingerCurl.
 * 0 = straight, 1 = fully curled.
 */
export function fingerTipCurl(hand: NormalizedHand, finger: FingerName): number {
  if (finger === "thumb") return fingerCurl(hand, finger)
  const j = FINGER_JOINTS[finger]
  const a = angle(hand.joints[j.intermediate], hand.joints[j.distal], hand.joints[j.tip])
  return Math.min(1, Math.max(0, a / Math.PI))
}

/**
 * Pinch strength: normalized distance between thumbTip and the given finger's tip.
 * 0 = fully open, 1 = touching.
 */
export function pinchStrength(hand: NormalizedHand, finger: FingerName): number {
  const thumbTip  = hand.joints["thumbTip"]
  const fingerTip = hand.joints[FINGER_JOINTS[finger].tip]
  const dist = distance(thumbTip, fingerTip)
  return Math.min(1, Math.max(0, 1 - dist / PINCH_MAX_DISTANCE))
}

/**
 * Finger spread: normalized angle between this finger's proximal direction
 * and its adjacent finger(s), measured from the wrist.
 * 0 = fingers together, 1 = maximally spread.
 */
export function fingerSpread(hand: NormalizedHand, finger: FingerName): number {
  const wrist   = hand.joints["wrist"]
  const myDir   = normalize(subtract(hand.joints[FINGER_JOINTS[finger].proximal], wrist))
  const adjs    = ADJACENT_PROXIMAL[finger]

  let total = 0
  for (const adj of adjs) {
    const adjDir = normalize(subtract(hand.joints[adj], wrist))
    const d = Math.min(1, Math.max(-1, dot(myDir, adjDir)))
    total += Math.acos(d)
  }

  const avg = total / adjs.length
  return Math.min(1, Math.max(0, avg / MAX_SPREAD_RAD))
}

/**
 * Returns a value 0-1 representing how much the palm faces the given direction.
 */
export function palmFacingScore(
  hand: NormalizedHand,
  direction: "up" | "down" | "camera" | "away"
): number {
  const wrist  = hand.joints["wrist"]
  const middle = hand.joints["middleKnuckle"]
  const index  = hand.joints["indexKnuckle"]

  const normal = hand.hand === "right"
    ? normalize(cross(subtract(middle, wrist), subtract(index, wrist)))
    : normalize(cross(subtract(index, wrist), subtract(middle, wrist)))

  const targets: Record<"up" | "down" | "camera" | "away", Vec3> = {
    up:     { x: 0, y:  1, z:  0 },
    down:   { x: 0, y: -1, z:  0 },
    camera: { x: 0, y:  0, z: -1 },
    away:   { x: 0, y:  0, z:  1 },
  }

  const d = dot(normal, targets[direction])
  return Math.min(1, Math.max(0, (d + 1) / 2))
}

/**
 * Convenience: get a finger metric value by name.
 */
export function getFingerMetric(hand: NormalizedHand, finger: FingerName, metric: FingerMetric): number {
  switch (metric) {
    case "fullCurl": return fingerCurl(hand, finger)
    case "baseCurl": return fingerBaseCurl(hand, finger)
    case "tipCurl":  return fingerTipCurl(hand, finger)
    case "pinch":    return pinchStrength(hand, finger)
    case "spread":   return fingerSpread(hand, finger)
  }
}
