import { useRef, useState, useEffect } from "react";
import "./App.scss";
import { LiveAPIProvider, useLiveAPIContext } from "./contexts/LiveAPIContext";
import SidePanel from "./components/side-panel/SidePanel";
import { AppBar } from "./components/app-bar/AppBar";
import cn from "classnames";

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY || '';
const MODEL = process.env.REACT_APP_GEMINI_MODEL || 'gemini-2.0-flash-exp';

if (!API_KEY) {
  throw new Error("Missing REACT_APP_GEMINI_API_KEY in .env file");
}

function AppContent() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { connected, client, setConfig, config, initializeAudio, connect } = useLiveAPIContext();

  // States for video streaming
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isMultimodalEnabled, setIsMultimodalEnabled] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);

  // Initialize connection when needed
  useEffect(() => {
    if (!connected) {
      connect().catch(console.error);
    }
  }, [connected, connect]);

  // Keep video srcObject in sync with the active stream
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = screenStream || webcamStream;
    }
  }, [screenStream, webcamStream]);

  // Media control handlers
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: isAudioEnabled 
      });
      setWebcamStream(stream);

      if (client && isMultimodalEnabled) {
        client.on('videoStart', (data: any) => {
          // Handle video start event
          console.log('Video stream started:', data);
        });

        if (isAudioEnabled) {
          client.on('audioStart', (data: any) => {
            // Handle audio start event
            console.log('Audio stream started:', data);
          });
        }
      }
    } catch (error) {
      console.error('Failed to start webcam:', error);
    }
  };

  const stopWebcam = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      setWebcamStream(null);

      if (client) {
        client.off('videoStart');
        client.off('audioStart');
      }
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: isAudioEnabled
      });
      setScreenStream(stream);

      if (client && isMultimodalEnabled) {
        client.on('videoStart', (data: any) => {
          // Handle video start event
          console.log('Screen share started:', data);
        });

        if (isAudioEnabled) {
          client.on('audioStart', (data: any) => {
            // Handle audio start event
            console.log('Audio stream started:', data);
          });
        }
      }
    } catch (error) {
      console.error('Failed to start screen share:', error);
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);

      if (client) {
        client.off('videoStart');
        client.off('audioStart');
      }
    }
  };

  const toggleMultimodal = () => {
    const newValue = !isMultimodalEnabled;
    setIsMultimodalEnabled(newValue);
    setConfig({
      ...config,
      multimodalEnabled: newValue,
      model: MODEL,
      generationConfig: {
        ...config.generationConfig,
        responseModalities: newValue ? ["TEXT", "VIDEO", "AUDIO"] : ["TEXT"],
      }
    });

    if (newValue && (webcamStream || screenStream)) {
      initializeAudio();
    }
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="stream">
      <AppBar
        onStartWebcam={startWebcam}
        onStopWebcam={stopWebcam}
        onStartScreenShare={startScreenShare}
        onStopScreenShare={stopScreenShare}
        onToggleMultimodal={toggleMultimodal}
        onToggleSidebar={toggleSidebar}
        isMultimodalEnabled={isMultimodalEnabled}
        webcamStream={webcamStream}
        screenStream={screenStream}
      />

      <div className="video-container">
        <video
          ref={videoRef}
          className={cn("stream", { hidden: !webcamStream && !screenStream })}
          autoPlay
          playsInline
          muted={!isAudioEnabled}
          aria-label="Live video stream"
        />
      </div>

      <SidePanel 
        hideHeader 
        multimodalEnabled={isMultimodalEnabled}
        webcamStream={webcamStream}
        screenStream={screenStream}
        onWebcamStreamChange={setWebcamStream}
        onScreenStreamChange={setScreenStream}
        isCollapsed={isSidebarCollapsed}
      />
    </div>
  );
}

function App() {
  return (
    <LiveAPIProvider apiKey={API_KEY} url="" model={MODEL}>
      <AppContent />
    </LiveAPIProvider>
  );
}

export default App;
