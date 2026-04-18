@component
export class SendMsgToServer extends BaseScriptComponent {
    @input
    @allowUndefined
    @hint("Internet Module asset used to create WebSocket")
    internetModule!: InternetModule

    @input
    @hint("WebSocket server URL, e.g. ws://192.168.1.42:3000/ws or wss://.../ws")
    serverUrl: string = "wss://paralysis-coach-manifesto.ngrok-free.dev/ws"

    @input
    @hint("Dedicated hand-data WebSocket endpoint")
    handServerUrl: string = "wss://paralysis-coach-manifesto.ngrok-free.dev/ws/hand"

    @input
    @hint("Enable dedicated hand-data channel")
    enableHandChannel: boolean = true

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

    @input
    @allowUndefined
    @hint("Optional Text component to display the latest message")
    messageText: Text | undefined

    // Active WebSocket connection. Null means disconnected.
    private socket: WebSocket | null = null
    // Outgoing messages buffered while socket is not OPEN.
    private pending: string[] = []
    // Reused delayed event for reconnect attempts.
    private reconnectEvent: DelayedCallbackEvent | null = null

    private handSocket: WebSocket | null = null
    private handPending: string[] = []
    private handReconnectEvent: DelayedCallbackEvent | null = null

    private updateEvent: UpdateEvent | null = null
    // Next send timestamp (seconds) to enforce fixed send interval.
    private nextSendAtSec: number = 0
    private isConnecting: boolean = false
    private isHandConnecting: boolean = false

    onAwake() {
        // Guard against missing inspector input.
        if (!this.internetModule) {
            this.log("Missing internetModule input")
            return
        }

        // Start connection immediately on script awake.
        this.connect()
        if (this.enableHandChannel) {
            this.connectHandChannel()
        }

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

        if (this.handReconnectEvent) {
            this.handReconnectEvent.enabled = false
        }

        if (this.handSocket) {
            this.handSocket.close()
            this.handSocket = null
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
        if (!this.internetModule) {
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
            this.socket = this.internetModule.createWebSocket(url)
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

    private connectHandChannel() {
        if (!this.enableHandChannel || !this.internetModule) {
            return
        }

        const url = (this.handServerUrl || "").trim()
        if (url.length === 0) {
            this.log("handServerUrl is empty")
            return
        }

        if (this.isHandConnecting) {
            return
        }

        if (this.handSocket && (this.handSocket.readyState === 0 || this.handSocket.readyState === 1)) {
            return
        }

        this.isHandConnecting = true
        this.log("Connecting hand channel: " + url)

        try {
            this.handSocket = this.internetModule.createWebSocket(url)
        } catch (e) {
            this.isHandConnecting = false
            this.log("createWebSocket(hand) failed: " + e)
            this.scheduleHandReconnect()
            return
        }

        this.handSocket.onopen = () => {
            this.isHandConnecting = false
            this.log("Hand channel opened")
            this.flushHandPending()
        }

        this.handSocket.onerror = () => {
            this.isHandConnecting = false
            this.log("Hand channel error")
            this.scheduleHandReconnect()
        }

        this.handSocket.onclose = () => {
            this.isHandConnecting = false
            this.log("Hand channel closed")
            this.handSocket = null
            this.scheduleHandReconnect()
        }
    }

    private scheduleHandReconnect() {
        if (!this.autoReconnect || !this.enableHandChannel) {
            return
        }

        if (!this.handReconnectEvent) {
            this.handReconnectEvent = this.createEvent("DelayedCallbackEvent")
            this.handReconnectEvent.bind(() => {
                this.connectHandChannel()
            })
        }

        this.handReconnectEvent.reset(Math.max(0.1, this.reconnectDelaySec))
    }

    private sendText(text: string) {
        // Send immediately when OPEN, otherwise buffer.
        if (this.socket && this.socket.readyState === 1) {
            try {
                this.socket.send(text)
                this.log("Sent: " + text)
                this.updateMessageText("Sent: " + text)
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
        this.updateMessageText("Queued: " + text)

        // Keep queue bounded so offline periods do not grow memory indefinitely.
        const maxCount = Math.max(1, Math.floor(this.maxPendingMessages))
        while (this.pending.length > maxCount) {
            this.pending.shift()
        }
    }

    private sendToHandChannel(text: string): "sent" | "queued" | "blocked" {
        if (!this.enableHandChannel) {
            this.log("Hand channel disabled, recording payload blocked")
            this.updateMessageText("Hand channel disabled")
            return "blocked"
        }

        if (this.handSocket && this.handSocket.readyState === 1) {
            try {
                this.handSocket.send(text)
                this.log("Hand sent: " + text)
                this.updateMessageText("Hand sent")
                return "sent"
            } catch (e) {
                this.log("Hand send failed, queued: " + e)
                this.enqueueHand(text)
                return "queued"
            }
        }

        this.enqueueHand(text)
        this.connectHandChannel()
        return "queued"
    }

    private enqueueHand(text: string) {
        this.handPending.push(text)
        this.updateMessageText("Hand queued")

        const maxCount = Math.max(1, Math.floor(this.maxPendingMessages))
        while (this.handPending.length > maxCount) {
            this.handPending.shift()
        }
    }

    private flushHandPending() {
        if (!this.handSocket || this.handSocket.readyState !== 1) {
            return
        }

        for (let i = 0; i < this.handPending.length; i++) {
            this.handSocket.send(this.handPending[i])
        }
        this.handPending = []
        this.updateMessageText("Hand sent")
    }

    private flushPending() {
        if (!this.socket || this.socket.readyState !== 1) {
            return
        }

        // Preserve original order for buffered messages.
        let lastFlushed = ""
        for (let i = 0; i < this.pending.length; i++) {
            this.socket.send(this.pending[i])
            lastFlushed = this.pending[i]
        }
        this.pending = []

        if (lastFlushed.length > 0) {
            this.updateMessageText("Sent: " + lastFlushed)
        }
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

    private updateMessageText(message: string) {
        if (this.messageText) {
            this.messageText.text = message
        }
    }

    public sendRecordingGesturetoServer(gesture: string): "sent" | "queued" | "blocked" {
        if (!gesture || gesture.length === 0) {
            this.log("sendRecordingGesturetoServer skipped: empty payload")
            return "blocked"
        }

        return this.sendToHandChannel(gesture)
    }
}
