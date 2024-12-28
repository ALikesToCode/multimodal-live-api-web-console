// Type definition for AudioContext initialization options
export type GetAudioContextOptions = {
  id: string;
  sampleRate?: number;
};

// Cache to store and reuse AudioContext instances
const audioContextCache: Map<string, AudioContext> = new Map();

/**
 * Creates or retrieves a cached AudioContext instance.
 * Handles user interaction requirements for audio playback.
 */
export async function getAudioContext({ id, sampleRate = 48000 }: GetAudioContextOptions): Promise<AudioContext> {
  const context = new AudioContext({
    latencyHint: 'interactive',
    sampleRate,
  });

  if (context.state === 'suspended') {
    try {
      await context.resume();
    } catch (error) {
      console.warn('AudioContext resume failed:', error);
    }
  }

  return context;
}

/**
 * Converts a Blob to JSON
 * @param blob - The Blob to convert
 * @returns Promise resolving to parsed JSON
 */
export const blobToJSON = <T>(blob: Blob): Promise<T> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        resolve(json);
      } catch (error) {
        reject(new Error('Failed to parse blob as JSON'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsText(blob);
  });

/**
 * Converts a base64 string to ArrayBuffer
 * @param base64 - The base64 string to convert
 * @returns ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
