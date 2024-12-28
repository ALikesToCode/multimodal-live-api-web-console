import type {
  Content,
  FunctionCall,
  GenerationConfig,
  GenerativeContentBlob,
  Part,
  Tool,
} from "@google/generative-ai";

/**
 * Core type definitions and type guards for multimodal live interactions.
 * This module provides a comprehensive type system for handling real-time 
 * communication between client and server, including setup, content streaming,
 * tool calls, and responses.
 */

// Type Definitions

/* Outgoing Message Types */

/**
 * Configuration for initializing a live session
 * @property model - The AI model identifier
 * @property systemInstruction - Optional initial system prompt
 * @property generationConfig - Optional generation parameters
 * @property tools - Optional array of available tools
 */
export interface LiveConfig {
  model: string;
  multimodalEnabled?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  systemInstruction?: { parts: Part[] };
  generationConfig?: Partial<LiveGenerationConfig>;
  tools?: Array<Tool | { googleSearch: {} } | { codeExecution: {} }>;
}

/**
 * Extended generation configuration with support for multiple modalities
 */
export type LiveGenerationConfig = GenerationConfig & {
  responseModalities: "text" | "audio" | "image";
  speechConfig?: {
    voiceConfig?: {
      prebuiltVoiceConfig?: {
        voiceName: "Puck" | "Charon" | "Kore" | "Fenrir" | "Aoede" | string;
      };
    };
  };
};

/**
 * Union type for all possible outgoing messages
 */
export type LiveOutgoingMessage =
  | SetupMessage
  | ClientContentMessage
  | RealtimeInputMessage
  | ToolResponseMessage;

export type SetupMessage = {
  setup: LiveConfig;
};

export type ClientContentMessage = {
  clientContent: {
    turns: Content[];
    turnComplete: boolean;
  };
};

export type RealtimeInputMessage = {
  realtimeInput: {
    mediaChunks: GenerativeContentBlob[];
  };
};

export type ToolResponseMessage = {
  toolResponse: {
    functionResponses: LiveFunctionResponse[];
  };
};

export type ToolResponse = ToolResponseMessage["toolResponse"];

export type LiveFunctionResponse = {
  response: object;
  id: string;
};

/* Incoming Message Types */

/**
 * Union type for all possible incoming messages
 */
export type LiveIncomingMessage =
  | ToolCallCancellationMessage
  | ToolCallMessage
  | ServerContentMessage
  | SetupCompleteMessage;

export type SetupCompleteMessage = { setupComplete: {} };

export type ServerContentMessage = {
  serverContent: ServerContent;
};

export type ServerContent = ModelTurn | TurnComplete | Interrupted;

export type ModelTurn = {
  modelTurn: {
    parts: Part[];
  };
};

export type TurnComplete = { turnComplete: boolean };

export type Interrupted = { interrupted: true };

export type ToolCallCancellationMessage = {
  toolCallCancellation: {
    ids: string[];
  };
};

export type ToolCallCancellation = ToolCallCancellationMessage["toolCallCancellation"];

export type ToolCallMessage = {
  toolCall: ToolCall;
};

export type LiveFunctionCall = FunctionCall & {
  id: string;
};

export type ToolCall = {
  functionCalls: LiveFunctionCall[];
};

/* Logging Types */

export type StreamingLog = {
  date: Date;
  type: string;
  count?: number;
  message: string | LiveOutgoingMessage | LiveIncomingMessage;
};

// Type Guards with Enhanced Error Checking

/**
 * Helper function to safely check object properties
 */
const prop = (value: unknown, propName: string, kind: string = "object"): boolean => {
  return value !== null && typeof value === "object" && propName in value && typeof (value as any)[propName] === kind;
};

// Outgoing Message Type Guards
export const isSetupMessage = (value: unknown): value is SetupMessage =>
  prop(value, "setup");

export const isClientContentMessage = (value: unknown): value is ClientContentMessage =>
  prop(value, "clientContent");

export const isRealtimeInputMessage = (value: unknown): value is RealtimeInputMessage =>
  prop(value, "realtimeInput");

export const isToolResponseMessage = (value: unknown): value is ToolResponseMessage =>
  prop(value, "toolResponse");

// Incoming Message Type Guards
export const isSetupCompleteMessage = (value: unknown): value is SetupCompleteMessage =>
  prop(value, "setupComplete");

export const isServerContenteMessage = (value: unknown): value is ServerContentMessage =>
  prop(value, "serverContent");

export const isToolCallMessage = (value: unknown): value is ToolCallMessage =>
  prop(value, "toolCall");

export const isToolCallCancellationMessage = (value: unknown): value is ToolCallCancellationMessage =>
  prop(value, "toolCallCancellation") && isToolCallCancellation((value as any).toolCallCancellation);

export const isModelTurn = (value: unknown): value is ModelTurn =>
  value !== null && typeof value === "object" && "modelTurn" in value;

export const isTurnComplete = (value: unknown): value is TurnComplete =>
  value !== null && typeof value === "object" && "turnComplete" in value && typeof (value as TurnComplete).turnComplete === "boolean";

export const isInterrupted = (value: unknown): value is Interrupted =>
  value !== null && typeof value === "object" && "interrupted" in value;

/**
 * Type guard for ToolCall validation
 */
export function isToolCall(value: unknown): value is ToolCall {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.functionCalls) && candidate.functionCalls.every(isLiveFunctionCall);
}

/**
 * Type guard for ToolResponse validation
 */
export function isToolResponse(value: unknown): value is ToolResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.functionResponses) && candidate.functionResponses.every(isLiveFunctionResponse);
}

/**
 * Type guard for LiveFunctionCall validation
 */
export function isLiveFunctionCall(value: unknown): value is LiveFunctionCall {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.id === "string" &&
    typeof candidate.args === "object" &&
    candidate.args !== null
  );
}

/**
 * Type guard for LiveFunctionResponse validation
 */
export function isLiveFunctionResponse(value: unknown): value is LiveFunctionResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.response === "object" && typeof candidate.id === "string";
}

/**
 * Type guard for ToolCallCancellation validation
 */
export const isToolCallCancellation = (value: unknown): value is ToolCallCancellation =>
  value !== null && typeof value === "object" && Array.isArray((value as any).ids);
