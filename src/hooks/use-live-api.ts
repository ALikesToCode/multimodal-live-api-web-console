import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MultimodalLiveAPIClientConnection,
  MultimodalLiveClient,
  type MultimodalLiveClientEventTypes,
} from "../lib/multimodal-live-client";
import { LiveConfig } from "../multimodal-live-types";
import { AudioStreamer } from "../lib/audio-streamer";
import { getAudioContext } from "../lib/utils";
import volMeterWorkletCode from "../lib/worklets/vol-meter";

// Improved type definition with more specific types and documentation
export interface UseLiveAPIResults {
  /** The multimodal client instance */
  client: MultimodalLiveClient;
  /** Function to update the configuration */
  setConfig: (config: LiveConfig) => void;
  /** Current configuration */
  config: LiveConfig;
  /** Connection status */
  connected: boolean;
  /** Connect to the API */
  connect: () => Promise<void>;
  /** Disconnect from the API */
  disconnect: () => Promise<void>;
  /** Current audio volume level */
  volume: number;
  /** Function to initialize audio */
  initializeAudio: () => Promise<void>;
}

export function useLiveAPI({
  url,
  apiKey,
}: MultimodalLiveAPIClientConnection): UseLiveAPIResults {
  const client = useMemo(
    () => new MultimodalLiveClient({ url, apiKey }),
    [url, apiKey]
  );

  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const audioInitializedRef = useRef(false);

  const [state, setState] = useState({
    connected: false,
    volume: 0,
    config: {
      model: "models/gemini-2.0-flash-exp",
      multimodalEnabled: false,
    } as LiveConfig,
  });

  const initializeAudio = useCallback(async () => {
    if (audioStreamerRef.current || audioInitializedRef.current) return;
    
    try {
      const audioCtx = await getAudioContext({ id: "audio-out" });
      const streamer = new AudioStreamer(audioCtx);
      await streamer.addWorklet<any>("vumeter-out", volMeterWorkletCode, (ev: any) => {
        setState(prev => ({ ...prev, volume: ev.data.volume }));
      });
      audioStreamerRef.current = streamer;
      audioInitializedRef.current = true;
    } catch (error) {
      console.error("Failed to initialize audio:", error);
    }
  }, []);

  // Handle client events
  useEffect(() => {
    const handlers: { [K in keyof MultimodalLiveClientEventTypes]?: MultimodalLiveClientEventTypes[K] } = {
      close: () => setState(prev => ({ ...prev, connected: false })),
      interrupted: () => audioStreamerRef.current?.stop(),
      audio: (data: ArrayBuffer) => {
        if (!audioStreamerRef.current && !audioInitializedRef.current) {
          initializeAudio().then(() => {
            audioStreamerRef.current?.addPCM16(new Uint8Array(data));
          });
        } else if (audioStreamerRef.current) {
          audioStreamerRef.current.addPCM16(new Uint8Array(data));
        }
      },
    };

    // Register event handlers
    (Object.entries(handlers) as [keyof MultimodalLiveClientEventTypes, Function][])
      .forEach(([event, handler]) => {
        client.on(event, handler as any);
      });

    // Cleanup event handlers
    return () => {
      (Object.entries(handlers) as [keyof MultimodalLiveClientEventTypes, Function][])
        .forEach(([event, handler]) => {
          client.off(event, handler as any);
        });
    };
  }, [client, initializeAudio]);

  // Connection management
  const connect = useCallback(async () => {
    if (!state.config) {
      throw new Error("Configuration is required before connecting");
    }

    try {
      client.disconnect(); // Ensure clean state
      await client.connect(state.config);
      setState(prev => ({ ...prev, connected: true }));
    } catch (error) {
      console.error("Connection failed:", error);
      throw error;
    }
  }, [client, state.config]);

  const disconnect = useCallback(async () => {
    try {
      client.disconnect();
      setState(prev => ({ ...prev, connected: false }));
    } catch (error) {
      console.error("Disconnection failed:", error);
    }
  }, [client]);

  const setConfig = useCallback((newConfig: LiveConfig) => {
    setState(prev => ({ ...prev, config: { ...newConfig, model: "models/gemini-2.0-flash-exp" } }));
  }, []);

  return {
    client,
    config: state.config,
    setConfig,
    connected: state.connected,
    connect,
    disconnect,
    volume: state.volume,
    initializeAudio,
  };
}
