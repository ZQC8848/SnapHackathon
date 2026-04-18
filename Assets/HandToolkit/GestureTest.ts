import { SnapHandAdapter } from './snap-adapter'
import { HandDebugPanel } from './HandDebugPanel'
import type { Policy } from './types'

const FIST_POLICY: Policy = {
  version: '1',
  gestures: [
    {
      tag: 'fist',
      hand: 'any',
      conditions: [
        { type: 'finger_shape', finger: 'index',  metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
        { type: 'finger_shape', finger: 'middle', metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
        { type: 'finger_shape', finger: 'ring',   metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
        { type: 'finger_shape', finger: 'little', metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
      ],
    },
  ],
  dynamic_gestures: [
    {
      tag: 'swipe_diagonal',
      hand: 'any',
      // Phase 0: fist to start recording, Phase 1: open hand to end
      // Make a fist, swipe top-right to bottom-left, then open hand
      phases: [
        {
          conditions: [
            { type: 'finger_shape', finger: 'index',  metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
            { type: 'finger_shape', finger: 'middle', metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
          ],
          min_ms: 0,
        },
        {
          conditions: [
            { type: 'finger_shape', finger: 'index',  metric: 'fullCurl', target: 0.1, upperTolerance: 0.15, lowerTolerance: 0.1 },
            { type: 'finger_shape', finger: 'middle', metric: 'fullCurl', target: 0.1, upperTolerance: 0.15, lowerTolerance: 0.1 },
          ],
          min_ms: 0,
          timeout_ms: 2000,
        },
      ],
      // Template: straight line from top-right (+X+Y) to bottom-left (-X-Y)
      trajectory: [
        { x:  1.0, y:  1.0, z: 0 },
        { x:  0.8, y:  0.8, z: 0 },
        { x:  0.6, y:  0.6, z: 0 },
        { x:  0.4, y:  0.4, z: 0 },
        { x:  0.2, y:  0.2, z: 0 },
        { x:  0.0, y:  0.0, z: 0 },
        { x: -0.2, y: -0.2, z: 0 },
        { x: -0.4, y: -0.4, z: 0 },
        { x: -0.6, y: -0.6, z: 0 },
        { x: -0.8, y: -0.8, z: 0 },
        { x: -1.0, y: -1.0, z: 0 },
      ],
      similarity_threshold: 0.85,
    },
  ],
}

@component
export class GestureTest extends BaseScriptComponent {
  @input
  adapter: SnapHandAdapter

  @input
  @allowUndefined
  panel: HandDebugPanel

  onAwake() {
    this.createEvent('OnStartEvent').bind(() => this.onStart())
  }

  private onStart() {
    if (!this.adapter) {
      print('[GestureTest] ERROR: adapter input not wired in Inspector')
      return
    }

    this.adapter.loadPolicy(FIST_POLICY)
    this.adapter.onTrigger = (output) => {
      if (this.panel) {
        this.panel.updateGestures(output)
      }
      // for (const g of output.gestures) {
      //   print(`[GestureTest] ${g.tag} | ${g.hand} | ${g.state} | ${Math.round(g.confidence * 100)}%`)
      // }
    }

    // print('[GestureTest] Policy loaded, watching for fist gesture...')
  }
}
