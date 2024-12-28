import cn from "classnames";
import { memo, ReactNode, RefObject, useEffect, useRef, useState, useCallback } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { UseMediaStreamResult } from "../../hooks/use-media-stream-mux";
import { useScreenCapture } from "../../hooks/use-screen-capture";
import { useWebcam } from "../../hooks/use-webcam";
import { AudioRecorder } from "../../lib/audio-recorder";
import AudioPulse from "../audio-pulse/AudioPulse";
import "./control-tray.scss";

// Improved type definitions with better documentation
export interface ControlTrayProps {
  videoRef: RefObject<HTMLVideoElement>;
  children?: ReactNode;
  supportsVideo: boolean;
  onVideoStreamChange?: (stream: MediaStream | null) => void;
}

interface MediaStreamButtonProps {
  isStreaming: boolean;
  onIcon: string;
  offIcon: string;
  start: () => Promise<any>;
  stop: () => void;
  ariaLabel: string; // Made required for better accessibility
  disabled?: boolean;
}

// Constants to avoid magic numbers
const VIDEO_SCALE_FACTOR = 0.25;
const JPEG_QUALITY = 0.8;
const FRAME_INTERVAL = 2000; // 0.5 FPS
const MIN_VOLUME = 5;
const MAX_VOLUME = 8;
const VOLUME_MULTIPLIER = 200;

/**
 * Button component for media stream controls with improved accessibility
 * and performance optimization through memoization
 */
const MediaStreamButton = memo(
  ({ isStreaming, onIcon, offIcon, start, stop, ariaLabel, disabled }: MediaStreamButtonProps) => (
    <button 
      className={cn("action-button", { disabled })}
      onClick={isStreaming ? stop : start}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      <span className="material-symbols-outlined" aria-hidden="true">
        {isStreaming ? onIcon : offIcon}
      </span>
    </button>
  ),
  // Custom comparison function for better memoization
  (prevProps, nextProps) => 
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.disabled === nextProps.disabled
);

/**
 * ControlTray component handles media stream controls and UI
 * Optimized for performance and accessibility
 */
function ControlTray({
  videoRef,
  children,
  onVideoStreamChange = () => {},
  supportsVideo,
}: ControlTrayProps) {
  // Organized state management
  const [mediaState, setMediaState] = useState({
    activeVideoStream: null as MediaStream | null,
    inVolume: 0,
    muted: false
  });
  
  // Refs with TypeScript safety
  const refs = {
    renderCanvas: useRef<HTMLCanvasElement>(null),
    connectButton: useRef<HTMLButtonElement>(null),
    frameRequest: useRef<number>(),
    timeout: useRef<number>()
  };

  // Custom hooks with better organization
  const videoStreams = [useWebcam(), useScreenCapture()];
  const [webcam, screenCapture] = videoStreams;
  const [audioRecorder] = useState(() => new AudioRecorder());
  const { client, connected, connect, disconnect, volume } = useLiveAPIContext();

  // Accessibility: Focus management
  useEffect(() => {
    if (!connected && refs.connectButton.current) {
      refs.connectButton.current.focus();
    }
  }, [connected]);

  // Performance optimized volume update
  useEffect(() => {
    const volumeValue = Math.max(MIN_VOLUME, 
      Math.min(mediaState.inVolume * VOLUME_MULTIPLIER, MAX_VOLUME));
    document.documentElement.style.setProperty("--volume", `${volumeValue}px`);
  }, [mediaState.inVolume]);

  // Optimized audio handling with cleanup
  useEffect(() => {
    const onData = (base64: string) => {
      client.sendRealtimeInput([{
        mimeType: "audio/pcm;rate=16000",
        data: base64,
      }]);
    };

    const handleAudioStream = () => {
      if (connected && !mediaState.muted && audioRecorder) {
        audioRecorder
          .on("data", onData)
          .on("volume", (vol) => setMediaState(prev => ({ ...prev, inVolume: vol })))
          .start();
      } else {
        audioRecorder.stop();
      }
    };

    handleAudioStream();

    return () => {
      audioRecorder
        .off("data", onData)
        .off("volume", (vol) => setMediaState(prev => ({ ...prev, inVolume: vol })));
    };
  }, [connected, client, mediaState.muted, audioRecorder]);

  // Optimized video frame processing
  useEffect(() => {
    if (!videoRef.current) return;
    
    videoRef.current.srcObject = mediaState.activeVideoStream;

    const processVideoFrame = () => {
      const video = videoRef.current;
      const canvas = refs.renderCanvas.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Optimize canvas dimensions
      canvas.width = video.videoWidth * VIDEO_SCALE_FACTOR;
      canvas.height = video.videoHeight * VIDEO_SCALE_FACTOR;

      if (canvas.width + canvas.height > 0) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        const data = base64.slice(base64.indexOf(",") + 1);
        client.sendRealtimeInput([{ mimeType: "image/jpeg", data }]);
      }

      if (connected) {
        refs.timeout.current = window.setTimeout(() => {
          refs.frameRequest.current = requestAnimationFrame(processVideoFrame);
        }, FRAME_INTERVAL);
      }
    };

    if (connected && mediaState.activeVideoStream) {
      refs.frameRequest.current = requestAnimationFrame(processVideoFrame);
    }

    return () => {
      cancelAnimationFrame(refs.frameRequest.current!);
      clearTimeout(refs.timeout.current);
    };
  }, [connected, mediaState.activeVideoStream, client, videoRef]);

  // Optimized stream management
  const changeStreams = useCallback((next?: UseMediaStreamResult) => async () => {
    try {
      if (next) {
        const mediaStream = await next.start();
        setMediaState(prev => ({ ...prev, activeVideoStream: mediaStream }));
        onVideoStreamChange(mediaStream);
      } else {
        setMediaState(prev => ({ ...prev, activeVideoStream: null }));
        onVideoStreamChange(null);
      }

      videoStreams
        .filter((msr) => msr !== next)
        .forEach((msr) => msr.stop());
    } catch (error) {
      console.error('Failed to change media stream:', error);
      // Could add error handling UI here
    }
  }, [videoStreams, onVideoStreamChange]);

  return (
    <section className="control-tray" role="toolbar" aria-label="Media controls">
      <canvas className="hidden" ref={refs.renderCanvas} />
      
      <nav className={cn("actions-nav", { disabled: !connected })}>
        <button
          className={cn("action-button mic-button")}
          onClick={() => setMediaState(prev => ({ ...prev, muted: !prev.muted }))}
          aria-label={mediaState.muted ? "Unmute microphone" : "Mute microphone"}
        >
          <span className="material-symbols-outlined filled">
            {!mediaState.muted ? "mic" : "mic_off"}
          </span>
        </button>

        <div className="action-button no-action outlined">
          <AudioPulse volume={volume} active={connected} hover={false} />
        </div>

        {supportsVideo && (
          <>
            <MediaStreamButton
              isStreaming={screenCapture.isStreaming}
              start={changeStreams(screenCapture)}
              stop={changeStreams()}
              onIcon="cancel_presentation"
              offIcon="present_to_all"
              ariaLabel="Toggle screen sharing"
              disabled={!connected}
            />
            <MediaStreamButton
              isStreaming={webcam.isStreaming}
              start={changeStreams(webcam)}
              stop={changeStreams()}
              onIcon="videocam_off"
              offIcon="videocam"
              ariaLabel="Toggle webcam"
              disabled={!connected}
            />
          </>
        )}
        {children}
      </nav>

      <div className={cn("connection-container", { connected })}>
        <div className="connection-button-container">
          <button
            ref={refs.connectButton}
            className={cn("action-button connect-toggle", { connected })}
            onClick={connected ? disconnect : connect}
            aria-label={connected ? "Stop streaming" : "Start streaming"}
          >
            <span className="material-symbols-outlined filled" aria-hidden="true">
              {connected ? "pause" : "play_arrow"}
            </span>
          </button>
        </div>
        <span className="text-indicator" aria-live="polite">
          {connected ? "Streaming" : "Not streaming"}
        </span>
      </div>
    </section>
  );
}

export default memo(ControlTray);
