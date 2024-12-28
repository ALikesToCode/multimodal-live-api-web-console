import { useState, useEffect } from "react";
import { UseMediaStreamResult } from "./use-media-stream-mux";

export function useWebcam(): UseMediaStreamResult {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Handle stream cleanup and event listeners
  useEffect(() => {
    if (!stream) return;

    const handleStreamEnded = () => {
      setIsStreaming(false);
      setStream(null);
    };

    // Add ended event listeners to all tracks
    const tracks = stream.getTracks();
    tracks.forEach(track => track.addEventListener("ended", handleStreamEnded));

    // Cleanup function to remove listeners
    return () => {
      tracks.forEach(track => track.removeEventListener("ended", handleStreamEnded));
    };
  }, [stream]);

  const start = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setIsStreaming(true);
      return mediaStream;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to start webcam");
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const stop = () => {
    if (!stream) return;

    stream.getTracks().forEach(track => track.stop());
    setStream(null);
    setIsStreaming(false);
    setError(null);
  };

  return {
    type: "webcam",
    start,
    stop,
    isStreaming,
    stream,
    error,
    isLoading,
    constraints: {
      video: true
    }
  };
}
