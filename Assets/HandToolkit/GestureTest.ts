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
      for (const g of output.gestures) {
        print(`[GestureTest] ${g.tag} | ${g.hand} | ${g.state} | ${Math.round(g.confidence * 100)}%`)
      }
    }

    print('[GestureTest] Policy loaded, watching for fist gesture...')
  }
}
