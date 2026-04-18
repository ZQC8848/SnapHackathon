import SIK from 'SpectaclesInteractionKit.lspkg/SIK'
import type { NormalizedHand, TriggerOutput } from './types'
import { getFingerMetric, palmFacingScore } from './measurement'

const FINGERS = ['thumb', 'index', 'middle', 'ring', 'little'] as const

function fmt(n: number): string {
  return n.toFixed(2)
}

function bar(n: number, width: number = 8): string {
  const filled = Math.round(Math.min(1, Math.max(0, n)) * width)
  return '[' + '|'.repeat(filled) + '.'.repeat(width - filled) + ']'
}

function handSection(hand: NormalizedHand): string {
  const lines: string[] = []
  lines.push(`── ${hand.hand.toUpperCase()} HAND ──`)

  for (const finger of FINGERS) {
    const curl  = getFingerMetric(hand, finger, 'fullCurl')
    const base  = getFingerMetric(hand, finger, 'baseCurl')
    const tip   = getFingerMetric(hand, finger, 'tipCurl')
    const pinch = getFingerMetric(hand, finger, 'pinch')
    const sprd  = getFingerMetric(hand, finger, 'spread')
    const label = finger.substring(0, 3).padEnd(3)
    lines.push(`${label} curl${bar(curl)} ${fmt(curl)}  base${bar(base)} ${fmt(base)}`)
    lines.push(`    tip ${bar(tip)} ${fmt(tip)}  pnch${bar(pinch)} ${fmt(pinch)}  sprd${bar(sprd,5)} ${fmt(sprd)}`)
  }

  const up   = palmFacingScore(hand, 'up')
  const down = palmFacingScore(hand, 'down')
  const cam  = palmFacingScore(hand, 'camera')
  const away = palmFacingScore(hand, 'away')
  lines.push(`palm  up=${fmt(up)} dn=${fmt(down)} cam=${fmt(cam)} away=${fmt(away)}`)

  return lines.join('\n')
}

/**
 * Drop this component on a scene object that has a Text component.
 * Wire adapter.onTrigger to call panel.updateGestures(output) to show scores.
 *
 * Usage:
 *   const panel = sceneObject.getComponent(HandDebugPanel.getTypeName())
 *   adapter.onTrigger = (output) => { panel.updateGestures(output) }
 */
@component
export class HandDebugPanel extends BaseScriptComponent {
  /** Optional — assign a Text component to render into the scene. Falls back to print() if not set. */
  @input('Component.Text')
  @allowUndefined
  debugText: Text | null = null

  /** How many frames to skip between refreshes (lower = more CPU). */
  @input
  updateInterval: number = 4

  private lastGestures: string = ''
  private frameCount: number = 0

  onAwake() {
    this.createEvent('OnStartEvent').bind(() => this.onStart())
  }

  /** Call from adapter.onTrigger to include gesture scores in the panel. */
  updateGestures(output: TriggerOutput): void {
    if (output.gestures.length === 0) {
      this.lastGestures = '── GESTURES ──\n(none)'
      return
    }
    const lines = ['── GESTURES ──']
    for (const g of output.gestures) {
      lines.push(`${g.tag.padEnd(16)} ${fmt(g.confidence)} ${bar(g.confidence)}  [${g.state}] ${g.hand}`)
    }
    this.lastGestures = lines.join('\n')
  }

  private onStart() {
    const handInputData = SIK.HandInputData
    const leftHand  = handInputData.getHand('left')
    const rightHand = handInputData.getHand('right')

    this.createEvent('UpdateEvent').bind(() => {
      this.frameCount++
      if (this.frameCount % (this.updateInterval + 1) !== 0) return

      const sections: string[] = []

      const leftNorm  = leftHand.isTracked()
        ? buildNormalizedHand(leftHand, 'left')
        : null
      const rightNorm = rightHand.isTracked()
        ? buildNormalizedHand(rightHand, 'right')
        : null

      if (leftNorm)  sections.push(handSection(leftNorm))
      if (rightNorm) sections.push(handSection(rightNorm))
      if (!leftNorm && !rightNorm) sections.push('No hands tracked')
      if (this.lastGestures) sections.push(this.lastGestures)

      if (this.debugText) {
        this.debugText.text = sections.join('\n\n')
      }
    })
  }
}

// ─── Internal helper (mirrors snap-adapter logic) ────────────────────────────

import TrackedHand from 'SpectaclesInteractionKit.lspkg/Providers/HandInputData/TrackedHand'

function v(p: vec3) { return { x: p.x, y: p.y, z: p.z } }

function buildNormalizedHand(hand: TrackedHand, side: 'left' | 'right'): NormalizedHand {
  return {
    hand: side,
    trackingConfidence: 1.0,
    joints: {
      wrist:            v(hand.wrist.position),
      thumbBaseJoint:   v(hand.thumbBaseJoint.position),
      thumbKnuckle:     v(hand.thumbKnuckle.position),
      thumbMidJoint:    v(hand.thumbMidJoint.position),
      thumbTip:         v(hand.thumbTip.position),
      indexKnuckle:     v(hand.indexKnuckle.position),
      indexMidJoint:    v(hand.indexMidJoint.position),
      indexUpperJoint:  v(hand.indexUpperJoint.position),
      indexTip:         v(hand.indexTip.position),
      middleKnuckle:    v(hand.middleKnuckle.position),
      middleMidJoint:   v(hand.middleMidJoint.position),
      middleUpperJoint: v(hand.middleUpperJoint.position),
      middleTip:        v(hand.middleTip.position),
      ringKnuckle:      v(hand.ringKnuckle.position),
      ringMidJoint:     v(hand.ringMidJoint.position),
      ringUpperJoint:   v(hand.ringUpperJoint.position),
      ringTip:          v(hand.ringTip.position),
      pinkyKnuckle:     v(hand.pinkyKnuckle.position),
      pinkyMidJoint:    v(hand.pinkyMidJoint.position),
      pinkyUpperJoint:  v(hand.pinkyUpperJoint.position),
      pinkyTip:         v(hand.pinkyTip.position),
    },
  }
}
