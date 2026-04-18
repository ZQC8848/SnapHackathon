@component
export class SendMsgToServer extends BaseScriptComponent {
    @input
    @hint("Remote Service Module asset used to create WebSocket")
    remoteServiceModule!: RemoteServiceModule

    @input
    @hint("WebSocket server URL, e.g. ws://192.168.1.42:3000/ws or wss://.../ws")
    serverUrl: string = "wss://paralysis-coach-manifesto.ngrok-free.dev/ws"

    @input
    @hint("Seconds between sends")
    sendIntervalSec: number = 1.0

    @input
    @hint("Enable automatic reconnect on close/error")
    autoReconnect: boolean = true

    @input
    @hint("Seconds to wait before reconnect")
    reconnectDelaySec: number = 1.5

    @input
    @hint("Maximum queued messages while socket is not open")
    maxPendingMessages: number = 32

    @input
    @hint("Enable logs in Lens Studio logger")
    enableLogging: boolean = true

    // Active WebSocket connection. Null means disconnected.
    private socket: WebSocket | null = null
    // Outgoing messages buffered while socket is not OPEN.
    private pending: string[] = []
    // Reused delayed event for reconnect attempts.
    private reconnectEvent: DelayedCallbackEvent | null = null
    private updateEvent: UpdateEvent | null = null
    // Next send timestamp (seconds) to enforce fixed send interval.
    private nextSendAtSec: number = 0
    private isConnecting: boolean = false

    onAwake() {
        // Guard against missing inspector input.
        if (!this.remoteServiceModule) {
            this.log("Missing remoteServiceModule input")
            return
        }

        // Start connection immediately on script awake.
        this.connect()

        // Drive periodic sending using frame updates + time gate.
        this.updateEvent = this.createEvent("UpdateEvent")
        this.updateEvent.bind(() => {
            this.onUpdate()
        })
    }

    onDestroy() {
        // Stop reconnect attempts after component is destroyed.
        if (this.reconnectEvent) {
            this.reconnectEvent.enabled = false
        }

        // Close socket to release resources.
        if (this.socket) {
            this.socket.close()
            this.socket = null
        }
    }

    private onUpdate() {
        if (this.sendIntervalSec <= 0) {
            return
        }

        const nowSec = getTime()
        if (nowSec < this.nextSendAtSec) {
            return
        }

        // Send one message every sendIntervalSec.
        this.nextSendAtSec = nowSec + this.sendIntervalSec
        this.sendText(this.getCurrentPstText())
    }

    private connect() {
        if (!this.remoteServiceModule) {
            return
        }

        const url = (this.serverUrl || "").trim()
        if (url.length === 0) {
            this.log("serverUrl is empty")
            return
        }

        if (this.isConnecting) {
            return
        }

        if (this.socket && (this.socket.readyState === 0 || this.socket.readyState === 1)) {
            return
        }

        this.isConnecting = true
        this.log("Connecting: " + url)

        try {
            this.socket = this.remoteServiceModule.createWebSocket(url)
        } catch (e) {
            this.isConnecting = false
            this.log("createWebSocket failed: " + e)
            this.scheduleReconnect()
            return
        }

        // Flush any queued messages once connection is ready.
        this.socket.onopen = () => {
            this.isConnecting = false
            this.log("WebSocket opened")
            this.flushPending()
        }

        this.socket.onmessage = (event) => {
            // Optional: keep lightweight log for server replies.
            if (this.enableLogging && event && event.data) {
                this.log("Received: " + event.data)
            }
        }

        this.socket.onerror = () => {
            this.isConnecting = false
            this.log("WebSocket error")
            this.scheduleReconnect()
        }

        // Clear reference on close so future connect() can recreate it.
        this.socket.onclose = () => {
            this.isConnecting = false
            this.log("WebSocket closed")
            this.socket = null
            this.scheduleReconnect()
        }
    }

    private scheduleReconnect() {
        if (!this.autoReconnect) {
            return
        }

        // Create once and reuse to avoid accumulating delayed events.
        if (!this.reconnectEvent) {
            this.reconnectEvent = this.createEvent("DelayedCallbackEvent")
            this.reconnectEvent.bind(() => {
                this.connect()
            })
        }

        this.reconnectEvent.reset(Math.max(0.1, this.reconnectDelaySec))
    }

    private sendText(text: string) {
        // Send immediately when OPEN, otherwise buffer.
        if (this.socket && this.socket.readyState === 1) {
            try {
                this.socket.send(text)
                this.log("Sent: " + text)
            } catch (e) {
                this.log("Send failed, queued: " + e)
                this.enqueue(text)
            }
            return
        }

        this.enqueue(text)
    }

    private enqueue(text: string) {
        this.pending.push(text)

        // Keep queue bounded so offline periods do not grow memory indefinitely.
        const maxCount = Math.max(1, Math.floor(this.maxPendingMessages))
        while (this.pending.length > maxCount) {
            this.pending.shift()
        }
    }

    private flushPending() {
        if (!this.socket || this.socket.readyState !== 1) {
            return
        }

        // Preserve original order for buffered messages.
        for (let i = 0; i < this.pending.length; i++) {
            this.socket.send(this.pending[i])
        }
        this.pending = []
    }

    private getCurrentPstText(): string {
        // PST is UTC-8 (fixed offset, no DST adjustment).
        const pstOffsetMs = 8 * 60 * 60 * 1000
        const nowUtcMs = new Date().getTime()
        const pstDate = new Date(nowUtcMs - pstOffsetMs)

        const year = pstDate.getUTCFullYear()
        const month = this.pad2(pstDate.getUTCMonth() + 1)
        const day = this.pad2(pstDate.getUTCDate())
        const hour = this.pad2(pstDate.getUTCHours())
        const minute = this.pad2(pstDate.getUTCMinutes())
        const second = this.pad2(pstDate.getUTCSeconds())

        return year + "-" + month + "-" + day + " " + hour + ":" + minute + ":" + second + " PST"
    }

    private pad2(value: number): string {
        return value < 10 ? "0" + value : "" + value
    }

    private log(message: string) {
        if (this.enableLogging) {
            print("[SendMsgToServer] " + message)
        }
    }
}
