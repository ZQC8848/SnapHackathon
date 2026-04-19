import { SnapHandAdapter } from './snap-adapter'
import { HandDebugPanel } from './HandDebugPanel'
import { SendMsgToServer } from '../MyScripts/SendMsgToServer'
import type { Policy } from './types'

const FIST_POLICY: Policy = {
  version: '1',
  gestures: [],
  dynamic_gestures: [
    // {
    //   tag: 'swipe_diagonal',
    //   hand: 'right',
    //   conditions: [
    //     { type: 'finger_shape', finger: 'index',  metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
    //     { type: 'finger_shape', finger: 'middle', metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
    //     { type: 'finger_shape', finger: 'ring',   metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
    //     { type: 'finger_shape', finger: 'little', metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
    //   ],
    //   trajectory: [
    //     { x:  1.0, y:  1.0, z: 0 }, { x:  0.8, y:  0.8, z: 0 }, { x:  0.6, y:  0.6, z: 0 },
    //     { x:  0.4, y:  0.4, z: 0 }, { x:  0.2, y:  0.2, z: 0 }, { x:  0.0, y:  0.0, z: 0 },
    //     { x: -0.2, y: -0.2, z: 0 }, { x: -0.4, y: -0.4, z: 0 }, { x: -0.6, y: -0.6, z: 0 },
    //     { x: -0.8, y: -0.8, z: 0 }, { x: -1.0, y: -1.0, z: 0 },
    //   ],
    //   similarity_threshold: 0.85,
    // },
    // {
    //   tag: 'push_forward',
    //   hand: 'right',
    //   conditions: [
    //     { type: 'finger_shape', finger: 'index',  metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
    //     { type: 'finger_shape', finger: 'middle', metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
    //     { type: 'finger_shape', finger: 'ring',   metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
    //     { type: 'finger_shape', finger: 'little', metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
    //   ],
    //   trajectory: [
    //     { x: 0, y: 0, z:  1.0 }, { x: 0, y: 0, z:  0.6 }, { x: 0, y: 0, z:  0.2 },
    //     { x: 0, y: 0, z: -0.2 }, { x: 0, y: 0, z: -0.6 }, { x: 0, y: 0, z: -1.0 },
    //   ],
    //   similarity_threshold: 0.85,
    // },
    {
      tag: 'Plane',
      hand: 'right',
      conditions: [
        { type: 'finger_shape', finger: 'middle', metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
        { type: 'finger_shape', finger: 'ring',   metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
        { type: 'finger_shape', finger: 'index',  metric: 'fullCurl', target: 0.1, upperTolerance: 0.15, lowerTolerance: 0.1 },
        { type: 'finger_shape', finger: 'little', metric: 'fullCurl', target: 0.1, upperTolerance: 0.15, lowerTolerance: 0.1 },
      ],
      // Template: left-biased shake (start right, sweep left)
      trajectory: [
        { x:  1.0, y: 0, z: 0 },
        { x:  0.0, y: 0, z: 0 },
        { x: -1.0, y: 0, z: 0 },
        { x:  0.0, y: 0, z: 0 },
        { x: -1.0, y: 0, z: 0 },
      ],
      similarity_threshold: 0.7,
    },
    // {
    //   tag: 'yes',
    //   hand: 'right',
    //   conditions: [
    //     { type: 'finger_shape', finger: 'index',  metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
    //     { type: 'finger_shape', finger: 'middle', metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
    //     { type: 'finger_shape', finger: 'ring',   metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
    //     { type: 'finger_shape', finger: 'little', metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
    //   ],
    //   trajectory: [
    //     { x: 0, y: 0, z:  1.0 },
    //     { x: 0, y: 0, z:  0.0 },
    //     { x: 0, y: 0, z: -1.0 },
    //     { x: 0, y: 0, z:  0.0 },
    //     { x: 0, y: 0, z:  1.0 },
    //   ],
    //   similarity_threshold: 0.7,
    // },
    {
      tag: 'Fight On',
      hand: 'right',
      conditions: [
        { type: 'finger_shape', finger: 'index',  metric: 'fullCurl', target: 0.1, upperTolerance: 0.15, lowerTolerance: 0.1 },
        { type: 'finger_shape', finger: 'middle', metric: 'fullCurl', target: 0.1, upperTolerance: 0.15, lowerTolerance: 0.1 },
        { type: 'finger_shape', finger: 'ring',   metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
        { type: 'finger_shape', finger: 'little', metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
      ],
      trajectory: [
        { x: 0, y: -1.0, z: 0 },
        { x: 0, y: -0.5, z: 0 },
        { x: 0, y:  0.0, z: 0 },
        { x: 0, y:  0.5, z: 0 },
        { x: 0, y:  1.0, z: 0 },
      ],
      similarity_threshold: 0.7,
    },
    {
      tag: 'Flying',
      hand: 'right',
      conditions: [
        { type: 'finger_shape', finger: 'middle', metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
        { type: 'finger_shape', finger: 'ring',   metric: 'fullCurl', target: 0.8, upperTolerance: 0.2, lowerTolerance: 0.2 },
        { type: 'finger_shape', finger: 'index',  metric: 'fullCurl', target: 0.1, upperTolerance: 0.15, lowerTolerance: 0.1 },
        { type: 'finger_shape', finger: 'little', metric: 'fullCurl', target: 0.1, upperTolerance: 0.15, lowerTolerance: 0.1 },
      ],
      // Template: large forward push (+Z to -Z)
      trajectory: [
        { x: 0, y: 0, z:  3.0 },
        { x: 0, y: 0, z:  2.0 },
        { x: 0, y: 0, z:  1.0 },
        { x: 0, y: 0, z:  0.0 },
        { x: 0, y: 0, z: -1.0 },
        { x: 0, y: 0, z: -2.0 },
        { x: 0, y: 0, z: -3.0 },
      ],
      similarity_threshold: 0.85,
    },
        {
      tag: 'Fours Up',
      hand: 'left',
      conditions: [
        { type: 'finger_shape', finger: 'middle', metric: 'fullCurl', target: 0.1, upperTolerance: 0.08, lowerTolerance: 0.05 },
        { type: 'finger_shape', finger: 'ring',   metric: 'fullCurl', target: 0.1, upperTolerance: 0.08, lowerTolerance: 0.05 },
        { type: 'finger_shape', finger: 'index',  metric: 'fullCurl', target: 0.1, upperTolerance: 0.08, lowerTolerance: 0.05 },
        { type: 'finger_shape', finger: 'little', metric: 'fullCurl', target: 0.1, upperTolerance: 0.08, lowerTolerance: 0.05 },
        { type: 'finger_shape', finger: 'thumb', metric: 'baseCurl', target: 0.5, upperTolerance: 0.06, lowerTolerance: 0.2 },
        { type: 'finger_shape', finger: 'thumb', metric: 'baseCurl', target: 0.5, upperTolerance: 0.06, lowerTolerance: 0.2 },
        { type: 'finger_shape', finger: 'thumb', metric: 'baseCurl', target: 0.5, upperTolerance: 0.06, lowerTolerance: 0.2 },
      ],
      // Template: large forward push (+Z to -Z)
      trajectory: [
        { x: 0, y: 0, z:  3.0 },
        { x: 0, y: 0, z:  2.0 },
        { x: 0, y: 0, z:  1.0 },
        { x: 0, y: 0, z:  0.0 },
        { x: 0, y: 0, z: -1.0 },
        { x: 0, y: 0, z: -2.0 },
        { x: 0, y: 0, z: -3.0 },
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

  @input
  @allowUndefined
  server: SendMsgToServer

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
      const top = output.gestures.find(g => g.state === 'ended')
      if (top) {
        print(`[GestureTest] ${top.tag} | ${top.hand} | ${Math.round(top.confidence * 100)}%`)
        if (this.server) {
          this.server.sendGesture(top.tag)
        }
      }
    }

    // print('[GestureTest] Policy loaded, watching for fist gesture...')
  }
}
