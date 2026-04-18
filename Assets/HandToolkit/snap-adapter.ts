import { SIK } from 'SpectaclesInteractionKit.lspkg/SIK'
import type { HandFrame, NormalizedHand, Vec3 } from './types'
import { GestureEngine } from './engine'
import type { Policy, TriggerOutput } from './types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function v(p: vec3): Vec3 {
  return { x: p.x, y: p.y, z: p.z }
}

/**
 * Converts a SIK TrackedHand to NormalizedHand.
 * Returns undefined when the hand is not tracked so HandFrame omits it.
 * NOTE: SIK names the little finger "pinky"; we map it to "little" here.
 */
function adaptHand(
  hand: ReturnType<ReturnType<typeof SIK.HandInputData.getHand>>,
  side: 'left' | 'right'
): NormalizedHand | undefined {
  if (!hand.isTracked()) return undefined

  return {
    hand: side,
    trackingConfidence: 1.0,
    joints: {
      wrist:               v(hand.wrist.position),

      thumbMetacarpal:     v(hand.thumbMetacarpal.position),
      thumbProximal:       v(hand.thumbProximal.position),
      thumbDistal:         v(hand.thumbDistal.position),
      thumbTip:            v(hand.thumbTip.position),

      indexMetacarpal:     v(hand.indexMetacarpal.position),
      indexProximal:       v(hand.indexProximal.position),
      indexIntermediate:   v(hand.indexIntermediate.position),
      indexDistal:         v(hand.indexDistal.position),
      indexTip:            v(hand.indexTip.position),

      middleMetacarpal:    v(hand.middleMetacarpal.position),
      middleProximal:      v(hand.middleProximal.position),
      middleIntermediate:  v(hand.middleIntermediate.position),
      middleDistal:        v(hand.middleDistal.position),
      middleTip:           v(hand.middleTip.position),

      ringMetacarpal:      v(hand.ringMetacarpal.position),
      ringProximal:        v(hand.ringProximal.position),
      ringIntermediate:    v(hand.ringIntermediate.position),
      ringDistal:          v(hand.ringDistal.position),
      ringTip:             v(hand.ringTip.position),

      // SIK calls this finger "pinky"; HandToolkit uses "little"
      littleMetacarpal:    v(hand.pinkyMetacarpal.position),
      littleProximal:      v(hand.pinkyProximal.position),
      littleIntermediate:  v(hand.pinkyIntermediate.position),
      littleDistal:        v(hand.pinkyDistal.position),
      littleTip:           v(hand.pinkyTip.position),
    },
  }
}

/**
 * Pure function — converts a pair of SIK TrackedHands into a HandFrame.
 * Usable standalone if you need the raw frame without running the engine.
 */
export function toHandFrame(
  left:  ReturnType<ReturnType<typeof SIK.HandInputData.getHand>>,
  right: ReturnType<ReturnType<typeof SIK.HandInputData.getHand>>
): HandFrame {
  return {
    timestamp: Date.now(),
    left:  adaptHand(left,  'left'),
    right: adaptHand(right, 'right'),
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Drop this component on any scene object.
 * Each frame it reads both SIK hands, builds a HandFrame, runs the
 * GestureEngine, and calls onTrigger with the results.
 *
 * Usage:
 *   const adapter = sceneObject.getComponent(SnapHandAdapter.getTypeName())
 *   adapter.loadPolicy(myPolicy)
 *   adapter.onTrigger = (output) => { ... }
 */
@component
export class SnapHandAdapter extends BaseScriptComponent {
  /** Called every frame with gesture results. Wire this up after onAwake. */
  onTrigger: ((output: TriggerOutput) => void) | null = null

  private engine: GestureEngine | null = null

  onAwake() {
    this.createEvent('OnStartEvent').bind(() => this.onStart())
  }

  /** Load (or replace) the gesture policy at any time. */
  loadPolicy(policy: Policy): void {
    if (this.engine === null) {
      this.engine = new GestureEngine(policy)
    } else {
      this.engine.loadPolicy(policy)
    }
  }

  private onStart() {
    const handInputData = SIK.HandInputData
    const leftHand  = handInputData.getHand('left')
    const rightHand = handInputData.getHand('right')

    let debugFrameCount = 0

    this.createEvent('UpdateEvent').bind(() => {
      debugFrameCount++

      // ── Debug: print tracking state every 60 frames (~1 s) ──────────────
      if (debugFrameCount % 60 === 0) {
        const lTracked = leftHand.isTracked()
        const rTracked = rightHand.isTracked()
        print(`[SnapHandAdapter] left=${lTracked} right=${rTracked}`)
      }

      const frame = toHandFrame(leftHand, rightHand)

      // ── Debug: print HandFrame wrist positions when a hand is present ───
      if (debugFrameCount % 60 === 0) {
        if (frame.left) {
          const w = frame.left.joints.wrist
          print(`[SnapHandAdapter] left wrist → (${Math.round(w.x*1000)/1000}, ${Math.round(w.y*1000)/1000}, ${Math.round(w.z*1000)/1000})`)
        }
        if (frame.right) {
          const w = frame.right.joints.wrist
          print(`[SnapHandAdapter] right wrist → (${Math.round(w.x*1000)/1000}, ${Math.round(w.y*1000)/1000}, ${Math.round(w.z*1000)/1000})`)
        }
      }

      if (this.engine !== null && this.onTrigger !== null) {
        const output = this.engine.process(frame)
        if (output.gestures.length > 0) {
          this.onTrigger(output)
        }
      }
    })
  }
}
