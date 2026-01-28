"use client";

import { useState, useEffect } from "react";
import type { ConnectionStatus as ConnectionStatusType } from "@/lib/party/hooks";

interface ConnectionStatusProps {
  /** Current connection status */
  status: ConnectionStatusType;
  /** Optional latency in milliseconds */
  latencyMs?: number;
  /** Position of the indicator */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Whether to show latency when connected */
  showLatency?: boolean;
}

/**
 * Small connection status indicator for display in corner during online games.
 * Shows colored dot with status text and optional latency.
 */
export function ConnectionStatus({
  status,
  latencyMs,
  position = "top-right",
  showLatency = true,
}: ConnectionStatusProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReconnectingPulse, setShowReconnectingPulse] = useState(false);

  // Pulse animation for reconnecting status
  useEffect(() => {
    if (status === "reconnecting") {
      setShowReconnectingPulse(true);
      const interval = setInterval(() => {
        setShowReconnectingPulse((prev) => !prev);
      }, 500);
      return () => clearInterval(interval);
    } else {
      setShowReconnectingPulse(false);
    }
  }, [status]);

  // Position classes
  const positionClasses = {
    "top-left": "top-3 left-3",
    "top-right": "top-3 right-3",
    "bottom-left": "bottom-3 left-3",
    "bottom-right": "bottom-3 right-3",
  };

  // Status configuration
  const statusConfig = {
    connected: {
      color: "bg-green-500",
      ringColor: "ring-green-500/30",
      label: "Connected",
      textColor: "text-green-400",
    },
    connecting: {
      color: "bg-yellow-500",
      ringColor: "ring-yellow-500/30",
      label: "Connecting",
      textColor: "text-yellow-400",
    },
    reconnecting: {
      color: showReconnectingPulse ? "bg-yellow-500" : "bg-yellow-600",
      ringColor: "ring-yellow-500/30",
      label: "Reconnecting",
      textColor: "text-yellow-400",
    },
    disconnected: {
      color: "bg-red-500",
      ringColor: "ring-red-500/30",
      label: "Disconnected",
      textColor: "text-red-400",
    },
    error: {
      color: "bg-red-500",
      ringColor: "ring-red-500/30",
      label: "Connection Error",
      textColor: "text-red-400",
    },
  };

  const config = statusConfig[status];

  // Latency quality indicator
  const getLatencyQuality = (ms: number) => {
    if (ms < 50) return { label: "Excellent", color: "text-green-400" };
    if (ms < 100) return { label: "Good", color: "text-green-400" };
    if (ms < 200) return { label: "Fair", color: "text-yellow-400" };
    return { label: "Poor", color: "text-red-400" };
  };

  const latencyQuality = latencyMs !== undefined ? getLatencyQuality(latencyMs) : null;

  return (
    <div
      className={`fixed ${positionClasses[position]} z-40`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div
        className={`flex items-center gap-2 rounded-full bg-gray-900/90 backdrop-blur-sm transition-all duration-200 ${
          isExpanded ? "px-3 py-1.5" : "p-1.5"
        }`}
      >
        {/* Status dot */}
        <div className={`relative h-3 w-3 rounded-full ${config.color}`}>
          {/* Animated ring for non-connected states */}
          {status !== "connected" && (
            <div
              className={`absolute inset-0 animate-ping rounded-full ${config.color} opacity-75`}
            />
          )}
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="flex items-center gap-2 pr-1">
            <span className={`text-xs font-medium ${config.textColor}`}>
              {config.label}
            </span>

            {/* Latency display */}
            {showLatency && status === "connected" && latencyMs !== undefined && (
              <span className={`text-xs ${latencyQuality?.color}`}>
                {latencyMs}ms
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ConnectionStatus;
