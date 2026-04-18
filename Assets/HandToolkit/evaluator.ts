import type { Condition, GestureDefinition, NormalizedHand } from "./types"
import { distance, getFingerMetric, palmFacingScore } from "./measurement"

// ─── Tolerance band scoring ───────────────────────────────────────────────────
//
// Mirrors Unity's HandShapeCompletenessCalculator:
//   · actual within [target - lowerTolerance, target + upperTolerance] → 1.0
//   · actual within buffer zone outside tolerance               → linear 1→0
//   · actual outside buffer                                     → 0.0

function toleranceBandScore(
  actual: number,
  target: number,
  upperTolerance: number,
  lowerTolerance: number,
  buffer: number
): number {
  const lower = target - lowerTolerance
  const upper = target + upperTolerance

  if (actual >= lower && actual <= upper) return 1.0

  if (buffer <= 0) return 0

  // Mirror Unity's Clamp01 on buffer boundary points so values outside [0,1]
  // don't produce ghost scores (e.g. target=0.05 with large lower buffer).
  const lowerBufferStart = Math.max(0, lower - buffer)
  const upperBufferEnd   = Math.min(1, upper + buffer)

  if (lowerBufferStart < actual && actual < lower)
    return (actual - lowerBufferStart) / buffer

  if (upper < actual && actual < upperBufferEnd)
    return (upperBufferEnd - actual) / buffer

  return 0
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Score a single condition against a NormalizedHand.
 * Returns [0.0, 1.0] where 1.0 is fully satisfied.
 */
export function evaluateCondition(condition: Condition, hand: NormalizedHand): number {
  switch (condition.type) {
    case "finger_shape": {
      const actual = getFingerMetric(hand, condition.finger, condition.metric)
      return toleranceBandScore(
        actual,
        condition.target,
        condition.upperTolerance,
        condition.lowerTolerance,
        condition.buffer ?? 0.1
      )
    }

    case "distance": {
      const actual = distance(hand.joints[condition.joint_a], hand.joints[condition.joint_b])
      return toleranceBandScore(
        actual,
        condition.target,
        condition.upperTolerance,
        condition.lowerTolerance,
        condition.buffer ?? 0.01
      )
    }

    case "palm_facing": {
      return palmFacingScore(hand, condition.direction)
    }
  }
}

/**
 * Score a full gesture against a hand.
 * Returns the average score across all conditions (logical AND with graceful degradation).
 * Returns 0 if there are no conditions.
 *
 * Note: uses average (not minimum) to mirror Unity's HandShapeCompletenessCalculator,
 * so one slightly weak condition lowers confidence rather than killing the gesture.
 */
export function evaluateGesture(gesture: GestureDefinition, hand: NormalizedHand): number {
  if (gesture.conditions.length === 0) return 0
  let sum = 0
  for (const condition of gesture.conditions) {
    sum += evaluateCondition(condition, hand)
  }
  return sum / gesture.conditions.length
}
