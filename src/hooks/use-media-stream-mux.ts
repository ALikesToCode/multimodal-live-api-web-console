
/**
 * Represents the result of using a media stream hook
 * @typedef {Object} UseMediaStreamResult
 * @property {'webcam' | 'screen'} type - The type of media stream (webcam or screen sharing)
 * @property {() => Promise<MediaStream>} start - Async function to start the media stream
 * @property {() => void} stop - Function to stop the media stream
 * @property {boolean} isStreaming - Flag indicating if the stream is currently active
 * @property {MediaStream | null} stream - The current MediaStream object or null if not streaming
 * @property {Error | null} error - Any error that occurred during streaming operations
 * @property {boolean} isLoading - Flag indicating if stream initialization is in progress
 * @property {MediaStreamConstraints} constraints - Current constraints applied to the stream
 */
export type UseMediaStreamResult = {
  type: "webcam" | "screen";
  start: () => Promise<MediaStream>;
  stop: () => void;
  isStreaming: boolean;
  stream: MediaStream | null;
  error: Error | null;
  isLoading: boolean;
  constraints: MediaStreamConstraints;
};
