import "./audio-pulse.scss";
import React, { useEffect, useRef, useMemo, memo } from "react";
import c from "classnames";

// Constants for better maintainability and performance
const LINE_COUNT = 3;
const MAX_HEIGHT = 24;
const BASE_HEIGHT = 4;
const UPDATE_INTERVAL = 100;
const ANIMATION_DELAY_FACTOR = 133;
const MIDDLE_LINE_MULTIPLIER = 400;
const SIDE_LINE_MULTIPLIER = 60;

export type AudioPulseProps = {
  active: boolean;
  volume: number; // 0-1 range
  hover?: boolean;
};

function AudioPulse({ active, volume, hover }: AudioPulseProps) {
  const lines = useRef<HTMLDivElement[]>([]);
  
  // Memoize the line elements array to prevent unnecessary re-renders
  const lineElements = useMemo(
    () => Array(LINE_COUNT).fill(null),
    []
  );

  useEffect(() => {
    let animationFrameId: number;
    let isActive = true;

    const updateLines = () => {
      if (!isActive) return;

      lines.current.forEach((line, i) => {
        if (!line) return;
        
        // Calculate height based on position (middle line is taller)
        const multiplier = i === 1 ? MIDDLE_LINE_MULTIPLIER : SIDE_LINE_MULTIPLIER;
        const height = Math.min(
          MAX_HEIGHT,
          BASE_HEIGHT + volume * multiplier
        );
        
        line.style.height = `${height}px`;
      });

      animationFrameId = requestAnimationFrame(updateLines);
    };

    updateLines();

    return () => {
      isActive = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [volume]);

  return (
    <div 
      className={c("audioPulse", { active, hover })}
      aria-label="Audio visualization"
      role="presentation"
    >
      {lineElements.map((_, i) => (
        <div
          key={i}
          ref={(el) => (lines.current[i] = el!)}
          style={{ animationDelay: `${i * ANIMATION_DELAY_FACTOR}ms` }}
          className="audioPulse__line"
        />
      ))}
    </div>
  );
}

// Prevent unnecessary re-renders if props haven't changed
export default memo(AudioPulse);
