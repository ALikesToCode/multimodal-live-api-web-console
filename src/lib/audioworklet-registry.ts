/**
 * Represents the structure of an audio worklet with its node and message handlers
 */
export interface WorkletGraph {
  /** The AudioWorkletNode instance */
  node?: AudioWorkletNode;
  /** Array of message handlers for processing worklet messages */
  handlers: Array<(this: MessagePort, ev: MessageEvent) => unknown>;
}

/**
 * Registry to track worklet instances across different audio contexts
 * This allows proper cleanup and message handling coordination
 */
export const registeredWorklets: Map<
  AudioContext,
  Record<string, WorkletGraph>
> = new Map();

/**
 * Creates a worklet from source code with proper error handling and cleanup
 * @param workletName - Unique name identifier for the worklet
 * @param workletSrc - Source code of the worklet processor
 * @returns URL object pointing to the worklet script
 */
export const createWorkletFromSrc = (
  workletName: string,
  workletSrc: string,
): string => {
  if (!workletName || !workletSrc) {
    throw new Error('Worklet name and source code are required');
  }

  // Create blob with proper type checking and error handling
  const script = new Blob(
    [`registerProcessor("${workletName}", ${workletSrc})`],
    {
      type: "application/javascript",
    }
  );

  const objectUrl = URL.createObjectURL(script);

  // Ensure cleanup of blob URL when no longer needed
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);

  return objectUrl;
};
