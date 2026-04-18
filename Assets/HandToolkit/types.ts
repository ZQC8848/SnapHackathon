export type Vec3 = { x: number; y: number; z: number }

export type JointName =
  | "wrist"
  | "thumbMetacarpal" | "thumbProximal" | "thumbDistal" | "thumbTip"
  | "indexMetacarpal" | "indexProximal" | "indexIntermediate" | "indexDistal" | "indexTip"
  | "middleMetacarpal" | "middleProximal" | "middleIntermediate" | "middleDistal" | "middleTip"
  | "ringMetacarpal" | "ringProximal" | "ringIntermediate" | "ringDistal" | "ringTip"
  | "littleMetacarpal" | "littleProximal" | "littleIntermediate" | "littleDistal" | "littleTip"

export type FingerName = "thumb" | "index" | "middle" | "ring" | "little"

export type FingerMetric = "fullCurl" | "baseCurl" | "tipCurl" | "pinch" | "spread"

export const FINGER_JOINTS = {
  thumb: {
    metacarpal:   "thumbMetacarpal"  as JointName,
    proximal:     "thumbProximal"    as JointName,
    intermediate: "thumbDistal"      as JointName,  // thumb has no intermediate; use distal
    distal:       "thumbTip"         as JointName,  // use tip for angle
    tip:          "thumbTip"         as JointName,
  },
  index: {
    metacarpal:   "indexMetacarpal"    as JointName,
    proximal:     "indexProximal"      as JointName,
    intermediate: "indexIntermediate"  as JointName,
    distal:       "indexDistal"        as JointName,
    tip:          "indexTip"           as JointName,
  },
  middle: {
    metacarpal:   "middleMetacarpal"    as JointName,
    proximal:     "middleProximal"      as JointName,
    intermediate: "middleIntermediate"  as JointName,
    distal:       "middleDistal"        as JointName,
    tip:          "middleTip"           as JointName,
  },
  ring: {
    metacarpal:   "ringMetacarpal"    as JointName,
    proximal:     "ringProximal"      as JointName,
    intermediate: "ringIntermediate"  as JointName,
    distal:       "ringDistal"        as JointName,
    tip:          "ringTip"           as JointName,
  },
  little: {
    metacarpal:   "littleMetacarpal"    as JointName,
    proximal:     "littleProximal"      as JointName,
    intermediate: "littleIntermediate"  as JointName,
    distal:       "littleDistal"        as JointName,
    tip:          "littleTip"           as JointName,
  },
} satisfies Record<FingerName, { metacarpal: JointName; proximal: JointName; intermediate: JointName; distal: JointName; tip: JointName }>

export type NormalizedHand = {
  hand: "left" | "right"
  joints: Record<JointName, Vec3>
  trackingConfidence: number
}

export type HandFrame = {
  timestamp: number
  left?: NormalizedHand
  right?: NormalizedHand
}

export type Condition =
  | {
      type: "finger_shape"
      finger: FingerName
      metric: FingerMetric
      target: number
      upperTolerance: number
      lowerTolerance: number
      buffer?: number
    }
  | {
      type: "distance"
      joint_a: JointName
      joint_b: JointName
      target: number
      upperTolerance: number
      lowerTolerance: number
      buffer?: number
    }
  | {
      type: "palm_facing"
      direction: "up" | "down" | "camera" | "away"
    }

export type TemporalConfig = {
  sustain_ms?: number
  cooldown_ms?: number
}

export type GestureDefinition = {
  tag: string
  hand: "left" | "right" | "any" | "both"
  conditions: Condition[]
  temporal?: TemporalConfig
}

export type Policy = {
  version: string
  gestures: GestureDefinition[]
  dynamic_gestures?: DynamicGesture[]
}

// ─── Dynamic gesture types ────────────────────────────────────────────────────

export type Phase = {
  conditions: Condition[]
  min_ms?: number
  timeout_ms?: number
}

export type DynamicGesture = {
  tag: string
  hand: "left" | "right" | "any" | "both"
  phases: Phase[]
  trajectory: Vec3[]
  similarity_threshold?: number
}

export type GestureState = "began" | "changed" | "ended"

export type GestureResult = {
  tag: string
  confidence: number
  hand: "left" | "right" | "both"
  state: GestureState
}

export type TriggerOutput = {
  timestamp: number
  gestures: GestureResult[]
}
