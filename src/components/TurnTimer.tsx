"use client";

import { useEffect, useState } from "react";

interface TurnTimerProps {
  /** Remaining time in milliseconds */
  remainingMs: number;
  /** Timer phase (turn or response) */
  phase: "turn" | "response";
  /** Whether this timer is for the current player */
  isMyTimer: boolean;
  /** Warning threshold in milliseconds */
  warningThresholdMs?: number;
}

/**
 * Turn timer display component.
 * Shows countdown with visual warning when time is running low.
 */
export function TurnTimer({
  remainingMs,
  phase,
  isMyTimer,
  warningThresholdMs = 10000,
}: TurnTimerProps) {
  const [displaySeconds, setDisplaySeconds] = useState(Math.ceil(remainingMs / 1000));

  // Update display when remainingMs changes
  useEffect(() => {
    setDisplaySeconds(Math.ceil(remainingMs / 1000));
  }, [remainingMs]);

  // Local countdown for smoother display between server updates
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplaySeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [remainingMs]); // Reset interval when server sends new time

  const isWarning = remainingMs <= warningThresholdMs;
  const isCritical = remainingMs <= 5000;

  // Determine colors based on state
  let bgColor = "bg-gray-700";
  let textColor = "text-white";
  let borderColor = "border-gray-600";

  if (isCritical) {
    bgColor = "bg-red-600";
    textColor = "text-white";
    borderColor = "border-red-500";
  } else if (isWarning) {
    bgColor = "bg-yellow-600";
    textColor = "text-white";
    borderColor = "border-yellow-500";
  } else if (isMyTimer) {
    bgColor = "bg-blue-600";
    textColor = "text-white";
    borderColor = "border-blue-500";
  }

  // Progress bar width
  const maxTime = phase === "response" ? 15 : 30;
  const progressPercent = Math.min(100, (displaySeconds / maxTime) * 100);

  return (
    <div
      className={`relative overflow-hidden rounded-lg border-2 ${borderColor} ${bgColor} px-4 py-2 ${
        isCritical ? "animate-pulse" : ""
      }`}
    >
      {/* Progress bar background */}
      <div
        className="absolute inset-0 bg-black/20"
        style={{ width: `${100 - progressPercent}%`, right: 0 }}
      />

      {/* Content */}
      <div className={`relative flex items-center gap-3 ${textColor}`}>
        {/* Timer icon */}
        <svg
          className={`h-5 w-5 ${isCritical ? "animate-spin" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>

        {/* Time display */}
        <div className="flex flex-col">
          <span className="text-lg font-bold tabular-nums">
            {displaySeconds}s
          </span>
          <span className="text-xs opacity-80">
            {isMyTimer ? "Your turn" : phase === "response" ? "Response" : "Turn"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default TurnTimer;
