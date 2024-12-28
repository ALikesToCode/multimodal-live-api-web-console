const workletCode = `
class VolumeMeterProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0];
    let sum = 0;
    
    // Calculate RMS (Root Mean Square) volume
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    
    const rms = Math.sqrt(sum / samples.length);
    const volume = Math.max(0, Math.min(1, rms * 4)); // Scale and clamp between 0 and 1
    
    this.port.postMessage({ volume });
    
    return true;
  }
}

registerProcessor('vumeter-out', VolumeMeterProcessor);
`;

export default workletCode;
