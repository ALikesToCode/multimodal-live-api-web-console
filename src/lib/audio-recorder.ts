import { getAudioContext } from "./utils";
import AudioRecordingWorklet from "./worklets/audio-processing";
import volMeterWorkletCode from "./worklets/vol-meter";
import { createWorkletFromSrc } from "./audioworklet-registry";
import EventEmitter from "eventemitter3";

// Utility function to convert ArrayBuffer to Base64 string
// This is needed for transmitting binary audio data as text
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return window.btoa(Array.from(bytes).map(byte => String.fromCharCode(byte)).join(''));
}

/**
 * AudioRecorder class handles browser audio recording with volume metering
 * Emits 'data' events with recorded audio and 'volume' events with current levels
 */
export class AudioRecorder extends EventEmitter {
  private stream?: MediaStream;
  private audioContext?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private recordingWorklet?: AudioWorkletNode;
  private vuWorklet?: AudioWorkletNode;
  private starting: Promise<void> | null = null;
  private recording: boolean = false;

  constructor(private readonly sampleRate: number = 16000) {
    super();
  }

  async start(): Promise<void> {
    if (!this.hasMediaSupport()) {
      throw new Error("Browser does not support audio recording");
    }

    this.starting = new Promise(async (resolve, reject) => {
      try {
        await this.initializeAudioChain();
        this.recording = true;
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        this.starting = null;
      }
    });

    return this.starting;
  }

  stop(): void {
    const cleanup = () => {
      this.source?.disconnect();
      this.stream?.getTracks().forEach(track => track.stop());
      this.recording = false;
      this.resetState();
    };

    // Handle case where stop is called before start completes
    if (this.starting) {
      this.starting.then(cleanup).catch(console.error);
      return;
    }
    cleanup();
  }

  private hasMediaSupport(): boolean {
    return !!(navigator.mediaDevices?.getUserMedia);
  }

  private async initializeAudioChain(): Promise<void> {
    // Get microphone access
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = await getAudioContext({ 
      id: "audio-recorder",
      sampleRate: this.sampleRate
    });
    
    if (!this.audioContext) {
      throw new Error("Failed to initialize audio context");
    }
    
    this.source = this.audioContext.createMediaStreamSource(this.stream);

    // Setup recording worklet
    await this.setupRecordingWorklet();

    // Setup volume meter worklet
    await this.setupVolumeMeterWorklet();
  }

  private async setupRecordingWorklet(): Promise<void> {
    if (!this.audioContext) return;
    
    const workletName = "audio-recorder-worklet";
    const src = createWorkletFromSrc(workletName, AudioRecordingWorklet);

    await this.audioContext.audioWorklet.addModule(src);
    this.recordingWorklet = new AudioWorkletNode(this.audioContext, workletName);

    this.recordingWorklet.port.onmessage = (ev: MessageEvent) => {
      const arrayBuffer = ev.data.data.int16arrayBuffer;
      if (arrayBuffer) {
        const base64Data = arrayBufferToBase64(arrayBuffer);
        this.emit("data", base64Data);
      }
    };

    this.source!.connect(this.recordingWorklet);
  }

  private async setupVolumeMeterWorklet(): Promise<void> {
    const vuWorkletName = "vu-meter";
    const src = createWorkletFromSrc(vuWorkletName, volMeterWorkletCode);

    await this.audioContext!.audioWorklet.addModule(src);
    this.vuWorklet = new AudioWorkletNode(this.audioContext!, vuWorkletName);

    this.vuWorklet.port.onmessage = (ev: MessageEvent) => {
      this.emit("volume", ev.data.volume);
    };

    this.source!.connect(this.vuWorklet);
  }

  private resetState(): void {
    this.stream = undefined;
    this.recordingWorklet = undefined;
    this.vuWorklet = undefined;
  }
}
