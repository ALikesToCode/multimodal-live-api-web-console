import { Content, GenerativeContentBlob, Part } from "@google/generative-ai";
import { EventEmitter } from "eventemitter3";
import { difference } from "lodash";
import {
  ClientContentMessage,
  isInterrupted,
  isModelTurn,
  isServerContenteMessage,
  isSetupCompleteMessage,
  isToolCallCancellationMessage,
  isToolCallMessage,
  isTurnComplete,
  LiveIncomingMessage,
  ModelTurn,
  RealtimeInputMessage,
  ServerContent,
  SetupMessage,
  StreamingLog,
  ToolCall,
  ToolCallCancellation,
  ToolResponseMessage,
  type LiveConfig,
} from "../multimodal-live-types";
import { blobToJSON, base64ToArrayBuffer } from "./utils";

/**
 * Events emitted by the MultimodalLiveClient
 * @interface MultimodalLiveClientEventTypes
 */
export interface MultimodalLiveClientEventTypes {
  open: () => void;
  log: (log: StreamingLog) => void;
  close: (event: CloseEvent) => void;
  audio: (data: ArrayBuffer) => void;
  content: (data: ServerContent) => void;
  interrupted: () => void;
  setupcomplete: () => void;
  turncomplete: () => void;
  toolcall: (toolCall: ToolCall) => void;
  toolcallcancellation: (toolcallCancellation: ToolCallCancellation) => void;
}

/**
 * Configuration for establishing API connection
 * @interface MultimodalLiveAPIClientConnection
 */
export type MultimodalLiveAPIClientConnection = {
  url?: string;
  apiKey: string;
};

/**
 * A robust WebSocket client for real-time multimodal communication.
 * Handles bidirectional streaming of audio, video, and text content.
 * Implements event-driven architecture for flexible integration.
 */
export class MultimodalLiveClient extends EventEmitter<MultimodalLiveClientEventTypes> {
  private ws: WebSocket | null = null;
  private config: LiveConfig | null = null;
  private readonly url: string;
  private readonly reconnectAttempts = 3;
  private readonly reconnectDelay = 1000; // ms

  public getConfig(): Readonly<LiveConfig | null> {
    return this.config ? { ...this.config } : null;
  }

  constructor({ url, apiKey }: MultimodalLiveAPIClientConnection) {
    super();
    this.url = url 
      ? `${url}?key=${apiKey}`
      : `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    this.send = this.send.bind(this);
  }

  /**
   * Logs events with timestamp and emits them
   */
  private log(type: string, message: StreamingLog["message"]): void {
    const log: StreamingLog = {
      date: new Date(),
      type,
      message,
    };
    this.emit("log", log);
  }

  /**
   * Establishes WebSocket connection with retry mechanism
   */
  async connect(config: LiveConfig): Promise<boolean> {
    this.config = config;
    
    for (let attempt = 1; attempt <= this.reconnectAttempts; attempt++) {
      try {
        return await this.establishConnection();
      } catch (error) {
        if (attempt === this.reconnectAttempts) throw error;
        await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
      }
    }
    return false;
  }

  private async establishConnection(): Promise<boolean> {
    const ws = new WebSocket(this.url);

    ws.addEventListener("message", async (evt: MessageEvent) => {
      if (evt.data instanceof Blob) {
        await this.receive(evt.data);
      } else {
        console.warn("Received non-blob message:", evt);
      }
    });

    return new Promise((resolve, reject) => {
      const onError = (ev: Event) => {
        this.disconnect(ws);
        const message = `Connection failed to "${this.url}"`;
        this.log(`server.${ev.type}`, message);
        reject(new Error(message));
      };

      ws.addEventListener("error", onError);
      ws.addEventListener("open", this.handleOpenConnection(ws, onError, resolve, reject));
    });
  }

  private handleOpenConnection(
    ws: WebSocket, 
    onError: (ev: Event) => void,
    resolve: (value: boolean) => void,
    reject: (reason?: any) => void
  ) {
    return (ev: Event) => {
      if (!this.config) {
        reject(new Error("Invalid config provided to connect()"));
        return;
      }

      this.log(`client.${ev.type}`, `Connected to socket`);
      this.emit("open");
      this.ws = ws;

      const setupMessage: SetupMessage = { setup: this.config };
      this._sendDirect(setupMessage);
      this.log("client.send", "setup");

      ws.removeEventListener("error", onError);
      ws.addEventListener("close", this.handleCloseConnection(ws));
      resolve(true);
    };
  }

  private handleCloseConnection(ws: WebSocket) {
    return (ev: CloseEvent) => {
      this.disconnect(ws);
      const reason = this.parseCloseReason(ev.reason);
      this.log(
        `server.${ev.type}`,
        `Disconnected ${reason ? `with reason: ${reason}` : ''}`
      );
      this.emit("close", ev);
    };
  }

  private parseCloseReason(reason: string): string {
    if (!reason.toLowerCase().includes("error")) return reason;
    
    const prelude = "ERROR]";
    const preludeIndex = reason.indexOf(prelude);
    return preludeIndex > 0 
      ? reason.slice(preludeIndex + prelude.length + 1)
      : reason;
  }

  /**
   * Safely disconnects the WebSocket connection
   */
  disconnect(ws?: WebSocket): boolean {
    if ((!ws || this.ws === ws) && this.ws) {
      this.ws.close();
      this.ws = null;
      this.log("client.close", `Disconnected`);
      return true;
    }
    return false;
  }

  /**
   * Processes incoming WebSocket messages
   */
  protected async receive(blob: Blob): Promise<void> {
    const response: LiveIncomingMessage = await blobToJSON(blob) as LiveIncomingMessage;

    if (isToolCallMessage(response)) {
      this.handleToolCall(response);
      return;
    }

    if (isToolCallCancellationMessage(response)) {
      this.handleToolCallCancellation(response);
      return;
    }

    if (isSetupCompleteMessage(response)) {
      this.handleSetupComplete();
      return;
    }

    if (isServerContenteMessage(response)) {
      await this.handleServerContent(response);
      return;
    }

    console.warn("Received unmatched message:", response);
  }

  private handleToolCall(response: { toolCall: ToolCall }): void {
    this.log("server.toolCall", response);
    this.emit("toolcall", response.toolCall);
  }

  private handleToolCallCancellation(response: { toolCallCancellation: ToolCallCancellation }): void {
    this.log("receive.toolCallCancellation", response);
    this.emit("toolcallcancellation", response.toolCallCancellation);
  }

  private handleSetupComplete(): void {
    this.log("server.send", "setupComplete");
    this.emit("setupcomplete");
  }

  private async handleServerContent(response: { serverContent: ServerContent }): Promise<void> {
    const { serverContent } = response;

    if (isInterrupted(serverContent)) {
      this.log("receive.serverContent", "interrupted");
      this.emit("interrupted");
      return;
    }

    if (isTurnComplete(serverContent)) {
      this.log("server.send", "turnComplete");
      this.emit("turncomplete");
    }

    if (isModelTurn(serverContent)) {
      await this.processModelTurn(serverContent.modelTurn);
    }
  }

  private async processModelTurn(modelTurn: { parts: Part[] }): Promise<void> {
    const { audioParts, otherParts } = this.separateContentParts(modelTurn.parts);
    
    await this.processAudioParts(audioParts);
    
    if (otherParts.length) {
      const content: ModelTurn = { modelTurn: { parts: otherParts } };
      this.emit("content", content);
      this.log(`server.content`, { serverContent: content });
    }
  }

  private separateContentParts(parts: Part[]) {
    const audioParts = parts.filter(
      p => p.inlineData?.mimeType.startsWith("audio/pcm")
    );
    const otherParts = difference(parts, audioParts);
    return { audioParts, otherParts };
  }

  private async processAudioParts(audioParts: Part[]): Promise<void> {
    for (const part of audioParts) {
      if (part.inlineData?.data) {
        const data = base64ToArrayBuffer(part.inlineData.data);
        this.emit("audio", data);
        this.log(`server.audio`, `buffer (${data.byteLength})`);
      }
    }
  }

  /**
   * Sends realtime input chunks (audio/video)
   */
  sendRealtimeInput(chunks: GenerativeContentBlob[]): void {
    const mediaTypes = this.analyzeMediaTypes(chunks);
    const message = this.formatMediaMessage(mediaTypes);

    const data: RealtimeInputMessage = {
      realtimeInput: { mediaChunks: chunks },
    };
    
    this._sendDirect(data);
    this.log(`client.realtimeInput`, message);
  }

  private analyzeMediaTypes(chunks: GenerativeContentBlob[]) {
    return chunks.reduce((types, chunk) => ({
      hasAudio: types.hasAudio || chunk.mimeType.includes("audio"),
      hasVideo: types.hasVideo || chunk.mimeType.includes("image")
    }), { hasAudio: false, hasVideo: false });
  }

  private formatMediaMessage({ hasAudio, hasVideo }: { hasAudio: boolean, hasVideo: boolean }): string {
    if (hasAudio && hasVideo) return "audio + video";
    if (hasAudio) return "audio";
    if (hasVideo) return "video";
    return "unknown";
  }

  /**
   * Sends tool response with corresponding ID
   */
  sendToolResponse(toolResponse: ToolResponseMessage["toolResponse"]): void {
    const message: ToolResponseMessage = { toolResponse };
    this._sendDirect(message);
    this.log(`client.toolResponse`, message);
  }

  /**
   * Sends content parts (text/data)
   */
  send(parts: Part | Part[], turnComplete: boolean = true): void {
    const content: Content = {
      role: "user",
      parts: Array.isArray(parts) ? parts : [parts],
    };

    const clientContentRequest: ClientContentMessage = {
      clientContent: {
        turns: [content],
        turnComplete,
      },
    };

    this._sendDirect(clientContentRequest);
    this.log(`client.send`, clientContentRequest);
  }

  /**
   * Internal method for sending WebSocket messages
   */
  private _sendDirect(request: object): void {
    if (!this.ws) {
      throw new Error("WebSocket is not connected");
    }
    this.ws.send(JSON.stringify(request));
  }
}
