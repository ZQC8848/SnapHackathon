export type Vec3 = { x: number; y: number; z: number }

export type JointName =
  | "wrist"
  | "thumbBaseJoint" | "thumbKnuckle" | "thumbMidJoint" | "thumbTip"
  | "indexKnuckle" | "indexMidJoint" | "indexUpperJoint" | "indexTip"
  | "middleKnuckle" | "middleMidJoint" | "middleUpperJoint" | "middleTip"
  | "ringKnuckle" | "ringMidJoint" | "ringUpperJoint" | "ringTip"
  | "pinkyKnuckle" | "pinkyMidJoint" | "pinkyUpperJoint" | "pinkyTip"

export type FingerName = "thumb" | "index" | "middle" | "ring" | "little"

export type FingerMetric = "fullCurl" | "baseCurl" | "tipCurl" | "pinch" | "spread"

export const FINGER_JOINTS = {
  thumb: {
    metacarpal:   "wrist"          as JointName,  // no metacarpal in SIK; wrist used for baseCurl
    proximal:     "thumbBaseJoint" as JointName,
    intermediate: "thumbKnuckle"   as JointName,
    distal:       "thumbMidJoint"  as JointName,
    tip:          "thumbTip"       as JointName,
  },
  index: {
    metacarpal:   "wrist"           as JointName,
    proximal:     "indexKnuckle"    as JointName,
    intermediate: "indexMidJoint"   as JointName,
    distal:       "indexUpperJoint" as JointName,
    tip:          "indexTip"        as JointName,
  },
  middle: {
    metacarpal:   "wrist"            as JointName,
    proximal:     "middleKnuckle"    as JointName,
    intermediate: "middleMidJoint"   as JointName,
    distal:       "middleUpperJoint" as JointName,
    tip:          "middleTip"        as JointName,
  },
  ring: {
    metacarpal:   "wrist"          as JointName,
    proximal:     "ringKnuckle"    as JointName,
    intermediate: "ringMidJoint"   as JointName,
    distal:       "ringUpperJoint" as JointName,
    tip:          "ringTip"        as JointName,
  },
  little: {
    metacarpal:   "wrist"           as JointName,
    proximal:     "pinkyKnuckle"    as JointName,
    intermediate: "pinkyMidJoint"   as JointName,
    distal:       "pinkyUpperJoint" as JointName,
    tip:          "pinkyTip"        as JointName,
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

export type DynamicGesture = {
  tag: string
  hand: "left" | "right" | "any" | "both"
  conditions: Condition[]
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
