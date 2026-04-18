import SIK from "SpectaclesInteractionKit.lspkg/SIK"
import TrackedHand from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/TrackedHand"
import { SendMsgToServer } from "./SendMsgToServer"

type JointSample = {
    position: number[]
    rotation?: number[]
}

type HandPose = {
    [jointName: string]: JointSample
}

type HandAnimationFrame = {
    left: HandPose
    right: HandPose
}

@component
export class SignLanguageRecoder extends BaseScriptComponent {
    @input
    @allowUndefined
    @hint("Reference to SendMsgToServer component used for transport")
    sender: SendMsgToServer | undefined

    @input
    @hint("Countdown seconds before recording starts")
    countdownSeconds: number = 3

    @input
    @hint("Recording duration in seconds")
    recordingSeconds: number = 3

    @input
    @hint("Start recording automatically on start")
    autoStartRecording: boolean = false

    @input
    @allowUndefined
    @hint("Optional Text component for recording status")
    statusText: Text | undefined

    @input
    @hint("Enable debug logs")
    enableLogging: boolean = true

    private updateEvent: UpdateEvent | null = null

    private leftHand: TrackedHand | null = null
    private rightHand: TrackedHand | null = null

    private phase: "idle" | "countdown" | "recording" = "idle"
    private countdownEndTime: number = 0
    private recordingEndTime: number = 0
    private frames: HandAnimationFrame[] = []

    private readonly jointReaders: { key: string, source: string }[] = [
        { key: "wrist", source: "wrist" },
        { key: "wrist_to_thumb", source: "thumbBaseJoint" },
        { key: "wrist_to_index", source: "indexKnuckle" },
        { key: "wrist_to_mid", source: "middleKnuckle" },
        { key: "wrist_to_ring", source: "ringKnuckle" },
        { key: "wrist_to_pinky", source: "pinkyKnuckle" },
        { key: "thumb-0", source: "thumbBaseJoint" },
        { key: "thumb-1", source: "thumbKnuckle" },
        { key: "thumb-2", source: "thumbMidJoint" },
        { key: "thumb-3", source: "thumbTip" },
        { key: "index-0", source: "indexKnuckle" },
        { key: "index-1", source: "indexMidJoint" },
        { key: "index-2", source: "indexUpperJoint" },
        { key: "index-3", source: "indexTip" },
        { key: "mid-0", source: "middleKnuckle" },
        { key: "mid-1", source: "middleMidJoint" },
        { key: "mid-2", source: "middleUpperJoint" },
        { key: "mid-3", source: "middleTip" },
        { key: "ring-0", source: "ringKnuckle" },
        { key: "ring-1", source: "ringMidJoint" },
        { key: "ring-2", source: "ringUpperJoint" },
        { key: "ring-3", source: "ringTip" },
        { key: "pinky-0", source: "pinkyKnuckle" },
        { key: "pinky-1", source: "pinkyMidJoint" },
        { key: "pinky-2", source: "pinkyUpperJoint" },
        { key: "pinky-3", source: "pinkyTip" },
    ]

    onAwake() {
        if (!this.sender) {
            this.log("Missing sender input")
            this.setStatus("Missing sender")
            return
        }

        if (!this.sender.enableHandChannel) {
            this.log("Hand channel disabled on sender")
            this.setStatus("Hand channel disabled")
            return
        }

        const handInputData = SIK.HandInputData
        this.leftHand = handInputData.getHand("left")
        this.rightHand = handInputData.getHand("right")

        this.updateEvent = this.createEvent("UpdateEvent")
        this.updateEvent.bind(() => {
            this.onUpdate()
        })

        if (this.autoStartRecording) {
            this.startRecording()
        } else {
            this.setStatus("Ready")
        }
    }

    onDestroy() {
        // Nothing to cleanup here, transport lifecycle is managed by SendMsgToServer.
    }

    /**
     * Public API: call this from button events or other scripts.
     */
    startRecording() {
        if (this.phase !== "idle") {
            this.log("Countdown/recording already in progress")
            return
        }

        if (!this.sender) {
            this.setStatus("Missing sender")
            this.log("Cannot start recording: sender is missing")
            return
        }

        if (!this.sender.enableHandChannel) {
            this.setStatus("Hand channel disabled")
            this.log("Cannot start recording: sender hand channel disabled")
            return
        }

        this.frames = []

        const countdownDuration = Math.max(0, this.countdownSeconds)
        if (countdownDuration <= 0) {
            this.beginRecordingPhase()
            return
        }

        this.phase = "countdown"
        this.countdownEndTime = getTime() + countdownDuration
        this.setStatus("Countdown: " + countdownDuration.toFixed(1) + "s")
        this.log("Countdown started")
    }

    private onUpdate() {
        if (this.phase === "idle") {
            return
        }

        if (!this.leftHand || !this.rightHand) {
            return
        }

        if (this.phase === "countdown") {
            const remaining = this.countdownEndTime - getTime()
            if (remaining <= 0) {
                this.beginRecordingPhase()
            } else {
                this.setStatus("Countdown: " + remaining.toFixed(1) + "s")
            }
            return
        }

        if (this.phase !== "recording") {
            return
        }

        this.frames.push({
            left: this.captureHandPose(this.leftHand),
            right: this.captureHandPose(this.rightHand),
        })

        const recordingRemaining = this.recordingEndTime - getTime()
        if (recordingRemaining <= 0) {
            this.stopAndSend()
            return
        }

        this.setStatus("Recording: " + recordingRemaining.toFixed(1) + "s")
    }

    private beginRecordingPhase() {
        this.phase = "recording"
        this.frames = []

        const duration = Math.max(0.1, this.recordingSeconds)
        this.recordingEndTime = getTime() + duration
        this.setStatus("Recording: " + duration.toFixed(1) + "s")
        this.log("Recording started")
    }

    private stopAndSend() {
        this.phase = "idle"
        this.log("Recording stopped: " + this.frames.length + " frames")

        const payload = {
            type: "hand_animation",
            name: "recording_" + Date.now(),
            frames: this.frames,
        }

        const message = JSON.stringify(payload)
        if (!this.sender) {
            this.setStatus("Missing sender")
            this.log("Cannot send: sender is missing")
            return
        }

        const sendState = this.sender.sendRecordingGesturetoServer(message)
        if (sendState === "sent") {
            this.setStatus("Sent: " + this.frames.length + " frames")
            this.log("Animation sent")
        } else if (sendState === "queued") {
            this.setStatus("Queued: " + this.frames.length + " frames")
            this.log("Animation queued until hand socket opens")
        } else {
            this.setStatus("Hand channel disabled")
            this.log("Animation blocked: hand channel disabled")
        }
    }

    private captureHandPose(hand: TrackedHand): HandPose {
        const pose: HandPose = {}

        for (let i = 0; i < this.jointReaders.length; i++) {
            const mapping = this.jointReaders[i]
            const sample = this.readJointSample(hand, mapping.source)
            if (sample) {
                pose[mapping.key] = sample
            }
        }

        return pose
    }

    private readJointSample(hand: TrackedHand, jointProperty: string): JointSample | null {
        const anyHand = hand as any
        const joint = anyHand[jointProperty]
        if (!joint || !joint.position) {
            return null
        }

        const p = joint.position
        const sample: JointSample = {
            position: [p.x, p.y, p.z],
        }

        if (joint.rotation) {
            const r = joint.rotation
            sample.rotation = [r.x, r.y, r.z, r.w]
        }

        return sample
    }

    private setStatus(text: string) {
        if (this.statusText) {
            this.statusText.text = text
        }
    }

    private log(message: string) {
        if (this.enableLogging) {
            print("[SignLanguageRecoder] " + message)
        }
    }
}
