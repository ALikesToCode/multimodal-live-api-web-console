import {
  createWorkletFromSrc,
  registeredWorklets,
} from "./audioworklet-registry";

/**
 * AudioStreamer handles real-time audio streaming with efficient buffering and scheduling.
 * It supports dynamic worklet processing and graceful error handling.
 */
export class AudioStreamer {
  private context: AudioContext;
  private workletNode?: AudioWorkletNode;
  private gainNode: GainNode;
  private pcmSource?: AudioBufferSourceNode;

  constructor(context: AudioContext) {
    this.context = context;
    this.gainNode = context.createGain();
    this.gainNode.connect(context.destination);
  }

  async addWorklet<T>(name: string, code: string, onMessage: (ev: MessageEvent<T>) => void) {
    const blob = new Blob([code], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    
    try {
      await this.context.audioWorklet.addModule(url);
      this.workletNode = new AudioWorkletNode(this.context, name);
      this.workletNode.port.onmessage = onMessage;
      this.workletNode.connect(this.gainNode);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  addPCM16(data: Uint8Array) {
    const buffer = this.context.createBuffer(1, data.length / 2, 48000);
    const channel = buffer.getChannelData(0);
    
    for (let i = 0; i < data.length; i += 2) {
      const sample = (data[i] << 8) | data[i + 1];
      channel[i / 2] = sample / 32768;
    }
    
    if (this.pcmSource) {
      this.pcmSource.stop();
    }
    
    this.pcmSource = this.context.createBufferSource();
    this.pcmSource.buffer = buffer;
    this.pcmSource.connect(this.workletNode || this.gainNode);
    this.pcmSource.start();
  }

  stop() {
    if (this.pcmSource) {
      this.pcmSource.stop();
      this.pcmSource = undefined;
    }
  }
}
