import type {
  Policy,
  HandFrame,
  TriggerOutput,
  GestureResult,
  GestureState,
  NormalizedHand,
  GestureDefinition,
  DynamicGesture,
  Phase,
} from "./types.js"
import { evaluateGesture, evaluateCondition } from "./evaluator.js"
import { similarity } from "./trajectory.js"

// ---------------------------------------------------------------------------
// Internal per-gesture-per-hand temporal state
// ---------------------------------------------------------------------------

interface GestureTrack {
  /** Current lifecycle state; undefined means not yet active. */
  lifecycleState: GestureState | null
  /** Timestamp when confidence first crossed 0.5 (used for sustain check). */
  activeSince: number | null
  /** Timestamp when the gesture last ended (used for cooldown check). */
  endedAt: number | null
}

function makeKey(tag: string, hand: "left" | "right" | "both"): string {
  return `${tag}:${hand}`
}

const CONFIDENCE_THRESHOLD = 0.5

// ---------------------------------------------------------------------------
// PolicyEngine
// ---------------------------------------------------------------------------

export class PolicyEngine {
  private policy: Policy
  /** Map from "tag:hand" → temporal track */
  private tracks: Map<string, GestureTrack> = new Map()

  constructor(policy: Policy) {
    this.policy = policy
  }

  /** Replace the active policy and reset all temporal state. */
  loadPolicy(policy: Policy): void {
    this.policy = policy
    this.tracks.clear()
  }

  /**
   * Main entry point — call every animation frame.
   * Evaluates all gestures against the provided HandFrame and returns
   * a TriggerOutput containing all gestures with confidence > 0,
   * sorted by confidence descending.
   */
  process(frame: HandFrame): TriggerOutput {
    const results: GestureResult[] = []
    const now = frame.timestamp

    for (const gesture of this.policy.gestures) {
      if (gesture.hand === "both") {
        // Both hands must satisfy — use the minimum score so neither hand can carry the other.
        if (frame.left && frame.right) {
          const score = Math.min(
            evaluateGesture(gesture, frame.left),
            evaluateGesture(gesture, frame.right)
          )
          const key = makeKey(gesture.tag, "both")
          const track = this.getOrCreateTrack(key)
          const result = this.advanceTrack(gesture, track, score, now, "both")
          if (result !== null) results.push(result)
        }
        continue
      }

      for (const { hand, side } of this.resolveHands(gesture, frame)) {
        const score = evaluateGesture(gesture, hand)
        const key = makeKey(gesture.tag, side)
        const track = this.getOrCreateTrack(key)
        const result = this.advanceTrack(gesture, track, score, now, side)
        if (result !== null) results.push(result)
      }
    }

    // Sort by confidence descending
    results.sort((a, b) => b.confidence - a.confidence)

    return { timestamp: now, gestures: results }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private resolveHands(
    gesture: GestureDefinition,
    frame: HandFrame
  ): Array<{ hand: NormalizedHand; side: "left" | "right" }> {
    const out: Array<{ hand: NormalizedHand; side: "left" | "right" }> = []

    if ((gesture.hand === "left" || gesture.hand === "any") && frame.left) {
      out.push({ hand: frame.left, side: "left" })
    }
    if ((gesture.hand === "right" || gesture.hand === "any") && frame.right) {
      out.push({ hand: frame.right, side: "right" })
    }

    return out
  }

  private getOrCreateTrack(key: string): GestureTrack {
    let track = this.tracks.get(key)
    if (track === undefined) {
      track = { lifecycleState: null, activeSince: null, endedAt: null }
      this.tracks.set(key, track)
    }
    return track
  }

  private advanceTrack(
    gesture: GestureDefinition,
    track: GestureTrack,
    score: number,
    now: number,
    side: "left" | "right" | "both",
  ): GestureResult | null {
    const sustainMs = gesture.temporal?.sustain_ms ?? 0
    const cooldownMs = gesture.temporal?.cooldown_ms ?? 0
    const active = score >= CONFIDENCE_THRESHOLD

    if (!active) {
      // Gesture not firing
      if (track.lifecycleState !== null && track.lifecycleState !== "ended") {
        // Was active — emit "ended" once
        track.lifecycleState = "ended"
        track.endedAt = now
        track.activeSince = null
        return { tag: gesture.tag, confidence: score, hand: side, state: "ended" }
      }
      // Already ended or never started; reset ended state if cooldown elapsed
      if (track.lifecycleState === "ended" && track.endedAt !== null) {
        if (now - track.endedAt >= cooldownMs) {
          track.lifecycleState = null
          track.endedAt = null
        }
      }
      // Only include in output if score > 0 and not in cooldown
      if (score > 0 && track.lifecycleState === null) {
        return { tag: gesture.tag, confidence: score, hand: side, state: "ended" }
      }
      return null
    }

    // Gesture is firing (score >= threshold)

    // Check cooldown — don't re-trigger while in cooldown
    if (track.lifecycleState === "ended" || track.lifecycleState === null) {
      if (track.endedAt !== null && now - track.endedAt < cooldownMs) {
        // Still in cooldown; suppress
        return null
      }
    }

    if (track.lifecycleState === null || track.lifecycleState === "ended") {
      // Starting a new activation
      if (track.activeSince === null) {
        track.activeSince = now
      }
      const elapsed = now - track.activeSince
      if (elapsed >= sustainMs) {
        // Sustain condition met — emit "began"
        track.lifecycleState = "began"
        return { tag: gesture.tag, confidence: score, hand: side, state: "began" }
      }
      // Still waiting for sustain — include in output with current score but no lifecycle state change
      return { tag: gesture.tag, confidence: score, hand: side, state: "began" }
    }

    if (track.lifecycleState === "began") {
      // Transition to "changed" after the first "began" frame
      track.lifecycleState = "changed"
      return { tag: gesture.tag, confidence: score, hand: side, state: "changed" }
    }

    // lifecycleState === "changed"
    return { tag: gesture.tag, confidence: score, hand: side, state: "changed" }
  }
}

// ---------------------------------------------------------------------------
// DynamicEngine
// ---------------------------------------------------------------------------

const TRAJECTORY_MAX_LEN = 600   // ~10 s at 60 fps
const DYNAMIC_PHASE_THRESHOLD = 0.6

interface DynamicTrack {
  /** Which phase we are currently trying to satisfy. */
  phaseIndex: number
  /** When current phase's conditions first exceeded the threshold. */
  phaseActiveAt: number | null
  /** When we transitioned INTO the current phase (used for timeout). */
  phaseTransitionedAt: number | null
  /** Rolling buffer of wrist world-positions (Vec3). */
  trajectoryBuffer: Array<{ x: number; y: number; z: number }>
  /** Index into trajectoryBuffer recorded when phase 0 completed. */
  trajStartIndex: number
}

export class DynamicEngine {
  private gestures: DynamicGesture[]
  private tracks: Map<string, DynamicTrack> = new Map()

  constructor(gestures: DynamicGesture[]) {
    this.gestures = gestures
  }

  loadGestures(gestures: DynamicGesture[]): void {
    this.gestures = gestures
    this.tracks.clear()
  }

  process(frame: HandFrame): TriggerOutput {
    const results: GestureResult[] = []
    const now = frame.timestamp

    for (const gesture of this.gestures) {
      for (const { hand, side } of this._resolveHands(gesture, frame)) {
        const key = makeKey(gesture.tag, side)
        const track = this._getOrCreateTrack(key)

        // Always record wrist position — continuous trajectory capture
        const w = hand.joints.wrist
        track.trajectoryBuffer.push({ x: w.x, y: w.y, z: w.z })
        if (track.trajectoryBuffer.length > TRAJECTORY_MAX_LEN) {
          track.trajectoryBuffer.shift()
          if (track.trajStartIndex > 0) track.trajStartIndex--
        }

        const result = this._advanceTrack(gesture, track, hand, now, side)
        if (result !== null) results.push(result)
      }
    }

    results.sort((a, b) => b.confidence - a.confidence)
    return { timestamp: now, gestures: results }
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private _resolveHands(
    gesture: DynamicGesture,
    frame: HandFrame,
  ): Array<{ hand: NormalizedHand; side: "left" | "right" }> {
    const out: Array<{ hand: NormalizedHand; side: "left" | "right" }> = []
    if ((gesture.hand === "left"  || gesture.hand === "any") && frame.left)
      out.push({ hand: frame.left,  side: "left"  })
    if ((gesture.hand === "right" || gesture.hand === "any") && frame.right)
      out.push({ hand: frame.right, side: "right" })
    // "both" is not meaningful for a single wrist trajectory — treat as "any"
    if (gesture.hand === "both") {
      if (frame.left)  out.push({ hand: frame.left,  side: "left"  })
      if (frame.right) out.push({ hand: frame.right, side: "right" })
    }
    return out
  }

  private _getOrCreateTrack(key: string): DynamicTrack {
    let t = this.tracks.get(key)
    if (t === undefined) {
      t = { phaseIndex: 0, phaseActiveAt: null, phaseTransitionedAt: null, trajectoryBuffer: [], trajStartIndex: 0 }
      this.tracks.set(key, t)
    }
    return t
  }

  private _advanceTrack(
    gesture: DynamicGesture,
    track: DynamicTrack,
    hand: NormalizedHand,
    now: number,
    side: "left" | "right",
  ): GestureResult | null {
    const phase: Phase | undefined = gesture.phases[track.phaseIndex]
    if (phase === undefined) return null

    // Timeout: if a non-start phase takes too long, reset
    if (track.phaseIndex > 0 && phase.timeout_ms !== undefined && track.phaseTransitionedAt !== null) {
      if (now - track.phaseTransitionedAt > phase.timeout_ms) {
        this._resetTrack(track)
        return null
      }
    }

    // Score current phase
    const score = this._evaluatePhase(phase, hand)
    const active = score >= DYNAMIC_PHASE_THRESHOLD

    if (active) {
      if (track.phaseActiveAt === null) track.phaseActiveAt = now
      const minMs = phase.min_ms ?? 0

      if (now - track.phaseActiveAt < minMs) return null   // still holding

      // ── Phase completed ──────────────────────────────────────────────────
      const completedIndex = track.phaseIndex
      const isLast = completedIndex === gesture.phases.length - 1

      if (completedIndex === 0) {
        // Record trajectory start at the moment the start gesture is confirmed
        track.trajStartIndex = Math.max(0, track.trajectoryBuffer.length - 1)
      }

      if (isLast) {
        // End gesture confirmed — check trajectory similarity
        const slice = track.trajectoryBuffer.slice(track.trajStartIndex)
        const threshold = gesture.similarity_threshold ?? 0.7
        const sim = similarity(slice, gesture.trajectory)
        this._resetTrack(track)
        if (sim >= threshold) {
          return { tag: gesture.tag, confidence: sim, hand: side, state: "ended" }
        }
        return null
      }

      // Advance to next phase
      track.phaseIndex++
      track.phaseActiveAt = null
      track.phaseTransitionedAt = now

      const state: GestureState = completedIndex === 0 ? "began" : "changed"
      return { tag: gesture.tag, confidence: score, hand: side, state }
    }

    // Conditions not met
    if (track.phaseIndex === 0) {
      // Start phase: reset hold timer on any gap
      track.phaseActiveAt = null
    }
    // Mid/end phases: keep phaseActiveAt; timeout handles regression if gap is too long

    return null
  }

  private _evaluatePhase(phase: Phase, hand: NormalizedHand): number {
    if (phase.conditions.length === 0) return 1.0
    let sum = 0
    for (const c of phase.conditions) sum += evaluateCondition(c, hand)
    return sum / phase.conditions.length
  }

  private _resetTrack(track: DynamicTrack): void {
    track.phaseIndex = 0
    track.phaseActiveAt = null
    track.phaseTransitionedAt = null
    track.trajStartIndex = 0
    // trajectoryBuffer kept — recording is always continuous
  }
}

// ---------------------------------------------------------------------------
// GestureEngine — unified wrapper
// ---------------------------------------------------------------------------

export class GestureEngine {
  private policyEngine: PolicyEngine
  private dynamicEngine: DynamicEngine

  constructor(policy: Policy) {
    this.policyEngine = new PolicyEngine(policy)
    this.dynamicEngine = new DynamicEngine(policy.dynamic_gestures ?? [])
  }

  /** Replace the active policy and reset all state. */
  loadPolicy(policy: Policy): void {
    this.policyEngine.loadPolicy(policy)
    this.dynamicEngine.loadGestures(policy.dynamic_gestures ?? [])
  }

  /**
   * Call every animation frame.
   * Returns combined static + dynamic results sorted by confidence descending.
   */
  process(frame: HandFrame): TriggerOutput {
    const staticOut  = this.policyEngine.process(frame)
    const dynamicOut = this.dynamicEngine.process(frame)
    const combined   = [...staticOut.gestures, ...dynamicOut.gestures]
    combined.sort((a, b) => b.confidence - a.confidence)
    return { timestamp: frame.timestamp, gestures: combined }
  }
}
