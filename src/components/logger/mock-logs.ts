import type { StreamingLog } from "../../multimodal-live-types";

// Helper function to create a timestamp for consistent dates in mock data
const createTimestamp = (offsetSeconds: number = 0) => {
  const base = new Date('2024-01-01T00:00:00Z');
  return new Date(base.getTime() + offsetSeconds * 1000);
};

// Helper to create streaming logs with consistent structure
const createStreamingLog = (type: StreamingLog['type'], message: any, offsetSeconds: number = 0): StreamingLog => ({
  date: createTimestamp(offsetSeconds),
  type,
  message
});

// Generate audio buffer logs with realistic sizes
const createAudioLogs = (count: number, startOffset: number = 0): StreamingLog[] =>
  Array.from({ length: count }, (_, i) => 
    createStreamingLog(
      'server.audio',
      `buffer (${11250 + Math.floor(Math.random() * 1000)})`, // Varying buffer sizes
      startOffset + i
    )
  );

// Generate realtime input logs
const createRealtimeLogs = (count: number, startOffset: number = 0): StreamingLog[] =>
  Array.from({ length: count }, (_, i) =>
    createStreamingLog('client.realtimeInput', 'audio', startOffset + i)
  );

// Main mock logs with realistic conversation flow
export const mockLogs: StreamingLog[] = [
  // Initial connection
  createStreamingLog('client.open', 'connected to socket', 0),

  // First interaction
  ...createRealtimeLogs(10, 1),
  ...createAudioLogs(10, 11),

  // Server responses showing different states
  createStreamingLog('receive.content', {
    serverContent: { interrupted: true }
  }, 21),
  
  createStreamingLog('receive.content', {
    serverContent: { turnComplete: true }
  }, 22),

  // Second interaction
  ...createRealtimeLogs(10, 23),
  ...createAudioLogs(20, 33),

  // Complex response with multiple text parts
  createStreamingLog('receive.content', {
    serverContent: {
      modelTurn: {
        parts: [
          { text: "I understand you're asking about woodchucks." },
          { text: "Let me help you with that question." }
        ]
      }
    }
  }, 53),

  // User question
  createStreamingLog('client.send', {
    clientContent: {
      turns: [{
        role: 'User',
        parts: [{
          text: 'How much wood could a woodchuck chuck if a woodchuck could chuck wood'
        }]
      }],
      turnComplete: true
    }
  }, 54),

  // Tool interaction sequence
  createStreamingLog('server.toolCall', {
    toolCall: {
      functionCalls: [
        {
          id: 'photo-capture-123',
          name: 'take_photo',
          args: {}
        },
        {
          id: 'camera-movement-456',
          name: 'move_camera',
          args: { x: 20, y: 4 }
        }
      ]
    }
  }, 55),

  createStreamingLog('server.toolCallCancellation', {
    toolCallCancellation: {
      ids: ['cancelled-call-1', 'cancelled-call-2']
    }
  }, 56),

  createStreamingLog('client.toolResponse', {
    toolResponse: {
      functionResponses: [{
        id: 'photo-capture-123',
        response: { success: true }
      }]
    }
  }, 57)
];
