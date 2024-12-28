import React from 'react';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';
import './app-bar.scss';
import cn from 'classnames';

interface AppBarProps {
  onStartWebcam: () => void;
  onStopWebcam: () => void;
  onStartScreenShare: () => void;
  onStopScreenShare: () => void;
  onToggleMultimodal: () => void;
  onToggleSidebar: () => void;
  isMultimodalEnabled: boolean;
  webcamStream: MediaStream | null;
  screenStream: MediaStream | null;
}

export function AppBar({
  onStartWebcam,
  onStopWebcam,
  onStartScreenShare,
  onStopScreenShare,
  onToggleMultimodal,
  onToggleSidebar,
  isMultimodalEnabled,
  webcamStream,
  screenStream,
}: AppBarProps) {
  const { startVoiceChat, stopVoiceChat, isVoiceChatActive } = useLiveAPIContext();

  return (
    <div className="app-bar">
      <div className="app-bar-content">
        <div className="app-bar-section">
          <button
            className={cn("app-bar-button", { active: isVoiceChatActive })}
            onClick={isVoiceChatActive ? stopVoiceChat : startVoiceChat}
            aria-label={isVoiceChatActive ? "Stop voice chat" : "Start voice chat"}
          >
            <span className="material-symbols-outlined">
              {isVoiceChatActive ? "mic_off" : "mic"}
            </span>
            <span className="button-text">
              {isVoiceChatActive ? "Stop Voice" : "Start Voice"}
            </span>
          </button>

          <button
            className={cn("app-bar-button", { active: webcamStream })}
            onClick={webcamStream ? onStopWebcam : onStartWebcam}
            aria-label={webcamStream ? "Stop camera" : "Start camera"}
          >
            <span className="material-symbols-outlined">
              {webcamStream ? "videocam_off" : "videocam"}
            </span>
            <span className="button-text">
              {webcamStream ? "Stop Camera" : "Start Camera"}
            </span>
          </button>

          <button
            className={cn("app-bar-button", { active: screenStream })}
            onClick={screenStream ? onStopScreenShare : onStartScreenShare}
            aria-label={screenStream ? "Stop screen share" : "Start screen share"}
          >
            <span className="material-symbols-outlined">
              {screenStream ? "cancel_presentation" : "present_to_all"}
            </span>
            <span className="button-text">
              {screenStream ? "Stop Screen" : "Share Screen"}
            </span>
          </button>

          <button
            className={cn("app-bar-button", { active: isMultimodalEnabled })}
            onClick={onToggleMultimodal}
            aria-label={isMultimodalEnabled ? "Disable multimodal" : "Enable multimodal"}
          >
            <span className="material-symbols-outlined">
              {isMultimodalEnabled ? "settings_accessibility" : "accessibility"}
            </span>
            <span className="button-text">
              {isMultimodalEnabled ? "Disable Multimodal" : "Enable Multimodal"}
            </span>
          </button>
        </div>

        <div className="app-bar-section">
          <button
            className="app-bar-button"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
          >
            <span className="material-symbols-outlined">menu</span>
            <span className="button-text">Toggle Sidebar</span>
          </button>
        </div>
      </div>
    </div>
  );
} 