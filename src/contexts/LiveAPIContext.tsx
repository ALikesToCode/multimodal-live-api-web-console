import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

interface LiveAPIContextType {
  connected: boolean;
  client: any;
  config: {
    multimodalEnabled: boolean;
    model: string;
    generationConfig?: {
      candidateCount?: number;
      maxOutputTokens?: number;
      temperature?: number;
      topP?: number;
      topK?: number;
      presencePenalty?: number;
      frequencyPenalty?: number;
      responseModalities?: string[];
      speechConfig?: {
        voiceConfig?: {
          prebuiltVoiceConfig?: {
            voiceName: string;
          };
        };
      };
    };
    systemInstruction?: string;
  };
  setConfig: (config: any) => void;
  initializeAudio: () => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  volume: number;
  startVoiceChat: () => Promise<void>;
  stopVoiceChat: () => void;
  isVoiceChatActive: boolean;
}

export interface LiveAPIProviderProps {
  apiKey: string;
  url: string;
  model?: string;
  children: React.ReactNode;
}

const LiveAPIContext = createContext<LiveAPIContextType | undefined>(undefined);

export function LiveAPIProvider({ apiKey, url, model = 'gemini-2.0-flash-exp', children }: LiveAPIProviderProps) {
  const [connected, setConnected] = useState(false);
  const [client, setClient] = useState<any>(null);
  const [volume, setVolume] = useState(1);
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const [config, setConfig] = useState({
    multimodalEnabled: true,
    model: model,
    generationConfig: {
      candidateCount: 1,
      maxOutputTokens: 2048,
      temperature: 0.7,
      topP: 0.8,
      topK: 40,
      responseModalities: ["TEXT", "AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: "Aoede"
          }
        }
      }
    }
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const initializeClient = useCallback(async () => {
    try {
      const wsUrl = `wss://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`;
      const ws = new WebSocket(wsUrl);

      // Create new client
      const newClient = {
        ws,
        send: async (parts: any[]) => {
          try {
            const message = {
              client_content: {
                turns: [{
                  role: "user",
                  parts: parts
                }],
                turn_complete: true
              }
            };
            ws.send(JSON.stringify(message));
          } catch (error) {
            console.error("Error sending message:", error);
            throw error;
          }
        },
        sendRealtimeInput: async (audioData: string) => {
          try {
            const message = {
              media_chunks: [{
                mime_type: "audio/wav",
                data: audioData
              }]
            };
            ws.send(JSON.stringify(message));
          } catch (error) {
            console.error("Error sending realtime input:", error);
          }
        },
        listeners: {
          log: null as ((data: any) => void) | null,
          audioStart: null as ((data: any) => void) | null,
          audioEnd: null as ((data: any) => void) | null,
          videoStart: null as ((data: any) => void) | null,
          videoEnd: null as ((data: any) => void) | null
        },
        on: (event: string, callback: (data: any) => void) => {
          switch (event) {
            case "log":
              newClient.listeners.log = callback;
              break;
            case "audioStart":
              newClient.listeners.audioStart = callback;
              break;
            case "audioEnd":
              newClient.listeners.audioEnd = callback;
              break;
            case "videoStart":
              newClient.listeners.videoStart = callback;
              break;
            case "videoEnd":
              newClient.listeners.videoEnd = callback;
              break;
          }
        },
        off: (event: string) => {
          switch (event) {
            case "log":
              newClient.listeners.log = null;
              break;
            case "audioStart":
              newClient.listeners.audioStart = null;
              break;
            case "audioEnd":
              newClient.listeners.audioEnd = null;
              break;
            case "videoStart":
              newClient.listeners.videoStart = null;
              break;
            case "videoEnd":
              newClient.listeners.videoEnd = null;
              break;
          }
        },
        disconnect: () => {
          ws.close();
          Object.keys(newClient.listeners).forEach(event => {
            newClient.off(event);
          });
        }
      };

      // Set up WebSocket event handlers
      ws.onopen = () => {
        // Send initial setup message
        const setupMessage = {
          model: `models/${model}`,
          generation_config: {
            ...config.generationConfig,
            response_modalities: ["TEXT", "AUDIO"]
          }
        };
        ws.send(JSON.stringify(setupMessage));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle setup complete
          if (data.type === "BidiGenerateContentSetupComplete") {
            setConnected(true);
            return;
          }

          // Handle server content
          if (data.model_turn?.parts) {
            for (const part of data.model_turn.parts) {
              if (part.text && newClient.listeners.log) {
                newClient.listeners.log({
                  type: "assistant",
                  content: part.text,
                  timestamp: new Date().toISOString()
                });
              }
            }
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnected(false);
      };

      ws.onclose = () => {
        console.log("WebSocket connection closed");
        setConnected(false);
      };

      setClient(newClient);

    } catch (error) {
      console.error('Failed to initialize client:', error);
      setConnected(false);
      setClient(null);
    }
  }, [apiKey, model, config.generationConfig]);

  const connect = useCallback(async () => {
    if (!connected) {
      await initializeClient();
    }
  }, [connected, initializeClient]);

  const disconnect = useCallback(() => {
    if (client) {
      client.disconnect();
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      setClient(null);
      setConnected(false);
      setIsVoiceChatActive(false);
    }
  }, [client]);

  const startVoiceChat = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
    }

    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      audioSourceRef.current = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
      
      // Create a processor node for audio processing
      const bufferSize = 16384;
      audioProcessorRef.current = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);
      
      let lastSendTime = 0;
      const SEND_INTERVAL = 1000;
      
      audioProcessorRef.current.onaudioprocess = async (e) => {
        const now = Date.now();
        if (now - lastSendTime < SEND_INTERVAL) {
          return;
        }
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Check if there's actual audio data
        const hasAudio = inputData.some(sample => Math.abs(sample) > 0.01);
        if (!hasAudio) {
          return;
        }
        
        // Convert Float32Array to Int16Array
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Create WAV header
        const wavHeader = new ArrayBuffer(44);
        const view = new DataView(wavHeader);
        
        // "RIFF" chunk descriptor
        view.setUint32(0, 0x52494646, false); // "RIFF"
        view.setUint32(4, 36 + pcmData.length * 2, true); // File size
        view.setUint32(8, 0x57415645, false); // "WAVE"
        
        // "fmt " sub-chunk
        view.setUint32(12, 0x666D7420, false); // "fmt "
        view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
        view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
        view.setUint16(22, 1, true); // NumChannels (1 for mono)
        view.setUint32(24, 16000, true); // SampleRate
        view.setUint32(28, 16000 * 2, true); // ByteRate
        view.setUint16(32, 2, true); // BlockAlign
        view.setUint16(34, 16, true); // BitsPerSample
        
        // "data" sub-chunk
        view.setUint32(36, 0x64617461, false); // "data"
        view.setUint32(40, pcmData.length * 2, true); // Subchunk2Size
        
        // Combine header and data
        const wavBytes = new Uint8Array(wavHeader.byteLength + pcmData.length * 2);
        wavBytes.set(new Uint8Array(wavHeader), 0);
        wavBytes.set(new Uint8Array(pcmData.buffer), wavHeader.byteLength);
        
        // Convert to base64
        const base64Audio = btoa(String.fromCharCode(...wavBytes));

        // Send the audio data
        if (client) {
          try {
            await client.sendRealtimeInput(base64Audio);
            lastSendTime = now;
          } catch (error) {
            console.error("Error sending audio data:", error);
          }
        }
      };

      // Connect the nodes
      audioSourceRef.current.connect(audioProcessorRef.current);
      audioProcessorRef.current.connect(audioContextRef.current.destination);

      setIsVoiceChatActive(true);
      console.log("Voice chat started successfully");
    } catch (error) {
      console.error("Error starting voice chat:", error);
      throw error;
    }
  };

  const stopVoiceChat = useCallback(() => {
    try {
      // Disconnect and clean up audio nodes
      if (audioProcessorRef.current) {
        audioProcessorRef.current.disconnect();
        audioProcessorRef.current = null;
      }
      
      if (audioSourceRef.current) {
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
      }

      // Stop all tracks in the media stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }

      // Close audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      setIsVoiceChatActive(false);
      console.log("Voice chat stopped successfully");
    } catch (error) {
      console.error("Error stopping voice chat:", error);
    }
  }, []);

  const initializeAudio = useCallback(() => {
    if (!client) return;

    const audioContext = new AudioContext();
    const processor = audioContext.createScriptProcessor(1024, 1, 1);
    const gainNode = audioContext.createGain();
    gainNode.gain.value = volume;
    
    processor.onaudioprocess = (e) => {
      if (client.listeners.audioStart) {
        const inputData = e.inputBuffer.getChannelData(0);
        client.listeners.audioStart(inputData);
      }
    };

    processor.connect(gainNode);
    gainNode.connect(audioContext.destination);

    const cleanup = () => {
      processor.disconnect();
      gainNode.disconnect();
      audioContext.close();
    };

    cleanupRef.current = cleanup;
    return cleanup;
  }, [client, volume]);

  useEffect(() => {
    return () => {
      if (client) {
        disconnect();
      }
    };
  }, []);

  return (
    <LiveAPIContext.Provider
      value={{
        connected,
        client,
        config,
        setConfig,
        initializeAudio,
        connect,
        disconnect,
        volume,
        startVoiceChat,
        stopVoiceChat,
        isVoiceChatActive,
      }}
    >
      {children}
    </LiveAPIContext.Provider>
  );
}

export function useLiveAPIContext() {
  const context = useContext(LiveAPIContext);
  if (context === undefined) {
    throw new Error('useLiveAPIContext must be used within a LiveAPIProvider');
  }
  return context;
}
