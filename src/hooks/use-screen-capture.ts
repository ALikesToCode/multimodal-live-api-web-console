import { useState, useEffect, useCallback } from "react";
import { UseMediaStreamResult } from "./use-media-stream-mux";

export function useScreenCapture(): UseMediaStreamResult {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Memoize handleStreamEnded to prevent unnecessary re-renders
  const handleStreamEnded = useCallback(() => {
    setIsStreaming(false);
    setStream(null);
  }, []);

  useEffect(() => {
    if (!stream) return;

    // Add event listeners to all tracks
    const tracks = stream.getTracks();
    tracks.forEach((track) => track.addEventListener("ended", handleStreamEnded));

    // Cleanup function
    return () => {
      tracks.forEach((track) => 
        track.removeEventListener("ended", handleStreamEnded)
      );
    };
  }, [stream, handleStreamEnded]);

  const start = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const constraints = {
        video: {
          cursor: "always", // Always show cursor in screen capture
          displaySurface: "monitor", // Prefer capturing entire monitor
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        }
      };

      const mediaStream = await navigator.mediaDevices.getDisplayMedia(constraints);
      setStream(mediaStream);
      setIsStreaming(true);
      return mediaStream;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to start screen capture'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const stop = useCallback(() => {
    if (!stream) return;

    stream.getTracks().forEach((track) => track.stop());
    setStream(null);
    setIsStreaming(false);
  }, [stream]);

  return {
    type: "screen",
    start,
    stop,
    isStreaming,
    stream,
    error,
    isLoading,
    constraints: {
      video: true,
      audio: true
    }
  };
}
