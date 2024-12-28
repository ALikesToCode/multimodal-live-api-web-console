import { create } from "zustand";
import { StreamingLog } from "../multimodal-live-types";

// Define the store state interface with clear type definitions
interface StoreLoggerState {
  maxLogs: number;
  logs: StreamingLog[];
  log: (streamingLog: StreamingLog) => void;
  clearLogs: () => void;
  setMaxLogs: (n: number) => void;
}

export const useLoggerStore = create<StoreLoggerState>((set, get) => ({
  maxLogs: 500, // Default max logs limit
  logs: [],

  // Optimized log function with improved readability and performance
  log: (streamingLog: StreamingLog) => {
    set((state) => {
      const prevLog = state.logs.at(-1);
      const isLogDuplicate = prevLog && 
        prevLog.type === streamingLog.type && 
        prevLog.message === streamingLog.message;

      if (isLogDuplicate) {
        // Update count for duplicate logs instead of creating new entry
        const updatedLogs = [...state.logs];
        updatedLogs[updatedLogs.length - 1] = {
          ...prevLog,
          count: (prevLog.count || 0) + 1
        };
        return { logs: updatedLogs };
      }

      // Maintain logs within maxLogs limit using efficient slicing
      const newLogs = [
        ...state.logs.slice(-(get().maxLogs - 1)),
        streamingLog
      ];
      
      return { logs: newLogs };
    });
  },

  clearLogs: () => set({ logs: [] }),
  setMaxLogs: (n: number) => set({ maxLogs: n })
}));
