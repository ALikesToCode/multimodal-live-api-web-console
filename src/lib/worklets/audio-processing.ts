

const AudioRecordingWorklet = `
class AudioProcessingWorklet extends AudioWorkletProcessor {
  // Buffer size optimized for performance and latency
  // 2048 samples at 16kHz = ~128ms chunks, balancing processing overhead and responsiveness
  static BUFFER_SIZE = 2048;
  static INT16_MAX = 32767;

  // TypedArray for efficient memory usage and faster processing
  buffer = new Int16Array(AudioProcessingWorklet.BUFFER_SIZE);
  bufferWriteIndex = 0;
  
  // Track if we're receiving audio to optimize processing
  isReceivingAudio = false;

  constructor() {
    super();
    // Initialize processor state
    this.port.onmessage = this.handleMessage.bind(this);
  }

  /**
   * Processes incoming audio data
   * @param {Float32Array[][]} inputs - Array of inputs, each containing channels of audio data
   * @param {Float32Array[][]} outputs - Not used in this implementation
   * @returns {boolean} - Keep processor alive
   */
  process(inputs) {
    const input = inputs[0];
    if (input?.length) {
      this.isReceivingAudio = true;
      this.processChunk(input[0]);
    } else if (this.isReceivingAudio) {
      // Handle end of audio stream
      this.isReceivingAudio = false;
      if (this.bufferWriteIndex > 0) {
        this.sendAndClearBuffer();
      }
    }
    return true;
  }

  /**
   * Sends accumulated buffer to main thread and resets state
   */
  sendAndClearBuffer() {
    // Only send non-empty buffers
    if (this.bufferWriteIndex > 0) {
      this.port.postMessage({
        event: "chunk",
        data: {
          int16arrayBuffer: this.buffer.slice(0, this.bufferWriteIndex).buffer,
        },
      }, [this.buffer.slice(0, this.bufferWriteIndex).buffer]); // Transfer buffer for better performance
      
      this.bufferWriteIndex = 0;
    }
  }

  /**
   * Handles messages from main thread
   */
  handleMessage(event) {
    // Extensible message handling
    console.log('Message received:', event.data);
  }

  /**
   * Converts and buffers audio samples
   * @param {Float32Array} float32Array - Input audio data
   */
  processChunk(float32Array) {
    const length = float32Array.length;
    
    // Pre-calculate conversion factor for better performance
    const conversionFactor = AudioProcessingWorklet.INT16_MAX;
    
    for (let i = 0; i < length; i++) {
      // Optimize conversion from float32 [-1,1] to int16 [-32768,32767]
      // Using Math.round for better accuracy
      this.buffer[this.bufferWriteIndex++] = Math.round(float32Array[i] * conversionFactor);
      
      if (this.bufferWriteIndex >= this.buffer.length) {
        this.sendAndClearBuffer();
      }
    }
  }
}
`;

export default AudioRecordingWorklet;
