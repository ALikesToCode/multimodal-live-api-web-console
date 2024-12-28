import { useEffect, useRef, useState } from "react";
import cn from "classnames";
import Select from "react-select";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { useLoggerStore } from "../../lib/store-logger";
import Logger, { LoggerFilterType } from "../logger/Logger";
import "./side-panel.scss";
import { Part as GoogleAIPart } from "@google/generative-ai";

/* Filter options for the logger */
const filterOptions = [
  { value: "conversations", label: "Conversations" },
  { value: "tools", label: "Tool Use" },
  { value: "none", label: "All" },
];

async function captureVideoFrame(stream: MediaStream): Promise<string | null> {
  try {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      console.warn('No video track available');
      return null;
    }

    // Create canvas for frame capture
    const canvas = document.createElement('canvas');
    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current frame to canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('Could not get canvas context');
      return null;
    }

    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    
    // Clean up
    video.pause();
    video.srcObject = null;

    return imageData.split(',')[1]; // Remove data URL prefix
  } catch (error) {
    console.error('Failed to capture video frame:', error);
    return null;
  }
}

interface SidePanelProps {
  hideHeader?: boolean;
  className?: string;
  multimodalEnabled?: boolean;
  webcamStream?: MediaStream | null;
  screenStream?: MediaStream | null;
  onWebcamStreamChange?: (stream: MediaStream | null) => void;
  onScreenStreamChange?: (stream: MediaStream | null) => void;
  isCollapsed?: boolean;
}

export default function SidePanel({
  hideHeader = false,
  className,
  multimodalEnabled = false,
  webcamStream = null,
  screenStream = null,
  onWebcamStreamChange,
  onScreenStreamChange,
  isCollapsed = false,
}: SidePanelProps) {
  const { connected, client, connect, setConfig, config } = useLiveAPIContext();
  const { log } = useLoggerStore();
  const [textInput, setTextInput] = useState("");
  const loggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [selectedOption, setSelectedOption] = useState<{
    value: string;
    label: string;
  } | null>(filterOptions[2]);

  // Register log listener
  useEffect(() => {
    if (client) {
      client.on('log', (data: { type: string; content: string; timestamp: string }) => {
        log({
          type: data.type,
          message: data.content,
          date: new Date(data.timestamp)
        });
      });
    }
  }, [client, log]);

  /* Handle sending of text input */
  const handleSubmit = async (message: string) => {
    if (!message.trim()) return;

    if (!connected) {
      try {
        await connect();
      } catch (error) {
        console.error("Failed to connect:", error);
        return;
      }
    }

    // Log user message first
    log({
      type: "user",
      message: message,
      date: new Date()
    });

    // Create a new turn with the message and video frames if multimodal is enabled
    const turn: GoogleAIPart = {
      text: message,
    };

    if (multimodalEnabled && (webcamStream || screenStream)) {
      // Capture frames from both streams if available
      const frames: GoogleAIPart[] = [];
      
      if (webcamStream) {
        const webcamFrame = await captureVideoFrame(webcamStream);
        if (webcamFrame) {
          frames.push({
            inlineData: {
              mimeType: "image/jpeg",
              data: webcamFrame
            }
          });
        }
      }

      if (screenStream) {
        const screenFrame = await captureVideoFrame(screenStream);
        if (screenFrame) {
          frames.push({
            inlineData: {
              mimeType: "image/jpeg",
              data: screenFrame
            }
          });
        }
      }

      // Send the turn to the API with all parts
      client?.send([{ text: message }, ...frames]);
    } else {
      // Send just the text message
      client?.send([turn]);
    }

    // Clear the input
    setTextInput("");
  };

  return (
    <div className={cn("side-panel", className, { collapsed: isCollapsed })}>
      {!hideHeader && (
        <header className="side-panel-header">
          <h2>Logger Console</h2>
        </header>
      )}

      {/* Status/Indicators */}
      <section className="indicators">
        <Select
          className="react-select"
          classNamePrefix="react-select"
          styles={{
            control: (baseStyles) => ({
              ...baseStyles,
              background: "var(--Neutral-15)",
              color: "var(--Neutral-90)",
              minHeight: "33px",
              maxHeight: "33px",
              border: 0,
            }),
            option: (styles, { isFocused, isSelected }) => ({
              ...styles,
              backgroundColor: isFocused
                ? "var(--Neutral-30)"
                : isSelected
                ? "var(--Neutral-20)"
                : undefined,
            }),
          }}
          value={selectedOption}
          options={filterOptions}
          onChange={(option) => setSelectedOption(option)}
        />

        {/* Streaming Indicator */}
        <div className={cn("streaming-indicator", { connected })}>
          {connected ? (multimodalEnabled ? "🎥 Multimodal" : "🔵 Streaming") : "⏸️ Paused"}
        </div>
      </section>

      {/* Logger Display */}
      <div className="side-panel-container" ref={loggerRef}>
        <Logger filter={(selectedOption?.value as LoggerFilterType) || "none"} />
      </div>

      {/* Input/Send Section */}
      <div className={cn("input-container", { disabled: !connected })}>
        <div className="input-content">
          <textarea
            ref={inputRef}
            className="input-area"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(textInput);
              }
            }}
            placeholder={multimodalEnabled ? "Type something... (Multimodal mode enabled)" : "Type something..."}
          />

          <button 
            className="send-button" 
            onClick={() => handleSubmit(textInput)}
            disabled={!connected}
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
