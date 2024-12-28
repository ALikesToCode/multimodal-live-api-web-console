import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { useEffect, useRef, useState, memo, useCallback } from "react";
import vegaEmbed, { type EmbedOptions } from "vega-embed";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { ToolCall } from "../../multimodal-live-types";

// Define constants to avoid magic strings and improve maintainability
const ALTAIR_FUNCTION_NAME = "render_altair";
const DEFAULT_MODEL = "models/gemini-2.0-flash-exp";
const DEFAULT_VOICE = "Aoede";
const TOOL_RESPONSE_DELAY = 200;

// Separated function declaration for better organization
const declaration: FunctionDeclaration = {
  name: ALTAIR_FUNCTION_NAME,
  description: "Displays an altair graph in json format.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      json_graph: {
        type: SchemaType.STRING,
        description: "JSON STRING representation of the graph to render. Must be a string, not a json object",
      },
    },
    required: ["json_graph"],
  },
};

// Vega embed options for consistent styling
const vegaEmbedOptions: EmbedOptions = {
  actions: true, // Enable export and other actions
  theme: 'ggplot2', // Using a supported theme
  renderer: 'canvas' // Better performance than SVG for most cases
};

function AltairComponent() {
  const [jsonString, setJSONString] = useState<string>("");
  const { client, setConfig } = useLiveAPIContext();
  const embedRef = useRef<HTMLDivElement>(null);

  // Configure the API client
  useEffect(() => {
    setConfig({
      model: DEFAULT_MODEL,
      generationConfig: {
        responseModalities: "audio",
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: DEFAULT_VOICE } },
        },
      },
      systemInstruction: {
        parts: [
          {
            text: 'You are my helpful assistant. Any time I ask you for a graph call the "render_altair" function I have provided you. Dont ask for additional information just make your best judgement.',
          },
        ],
      },
      tools: [
        { googleSearch: {} },
        { functionDeclarations: [declaration] },
      ],
    });
  }, [setConfig]);

  // Handle tool calls more efficiently with useCallback
  const handleToolCall = useCallback((toolCall: ToolCall) => {
    console.log('Tool call received:', toolCall);
    
    const functionCall = toolCall.functionCalls.find(
      (fc) => fc.name === ALTAIR_FUNCTION_NAME
    );

    if (functionCall) {
      const graphData = (functionCall.args as { json_graph: string }).json_graph;
      setJSONString(graphData);
    }

    if (toolCall.functionCalls.length) {
      setTimeout(() => {
        client.sendToolResponse({
          functionResponses: toolCall.functionCalls.map((fc) => ({
            response: { output: { success: true }}, // Fixed typo in 'success'
            id: fc.id,
          })),
        });
      }, TOOL_RESPONSE_DELAY);
    }
  }, [client]);

  // Set up event listeners
  useEffect(() => {
    client.on("toolcall", handleToolCall);
    return () => {
      client.off("toolcall", handleToolCall);
    };
  }, [client, handleToolCall]);

  // Render the visualization
  useEffect(() => {
    if (!embedRef.current || !jsonString) return;

    try {
      const graphData = JSON.parse(jsonString);
      vegaEmbed(embedRef.current, graphData, vegaEmbedOptions)
        .catch(error => console.error('Error rendering visualization:', error));
    } catch (error) {
      console.error('Error parsing JSON:', error);
    }
  }, [jsonString]);

  return (
    <div 
      className="vega-embed" 
      ref={embedRef}
      style={{ width: '100%', height: '100%' }} // Ensure responsive sizing
    />
  );
}

// Memoize the component to prevent unnecessary re-renders
export const Altair = memo(AltairComponent);
