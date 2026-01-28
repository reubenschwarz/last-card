"use client";

import { useEffect, useState } from "react";
import type { ConnectionStatus } from "@/lib/party/hooks";

interface ConnectionOverlayProps {
  status: ConnectionStatus;
  /** How long the player has been disconnected (for showing countdown) */
  disconnectedAt?: number;
  /** Grace period in milliseconds before AI takeover */
  gracePeriodMs?: number;
}

/**
 * Overlay shown when connection to game server is lost.
 * Shows reconnection status and countdown until AI takeover.
 */
export function ConnectionOverlay({
  status,
  disconnectedAt,
  gracePeriodMs = 30000,
}: ConnectionOverlayProps) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Update countdown timer
  useEffect(() => {
    if (status !== "reconnecting" || !disconnectedAt) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const elapsed = Date.now() - disconnectedAt;
      const remaining = Math.max(0, gracePeriodMs - elapsed);
      setTimeRemaining(Math.ceil(remaining / 1000));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [status, disconnectedAt, gracePeriodMs]);

  // Don't show overlay if connected
  if (status === "connected") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="mx-4 flex max-w-md flex-col items-center gap-6 rounded-2xl bg-gray-900 p-8 text-center shadow-2xl">
        {status === "connecting" && (
          <>
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-blue-500" />
            <div className="text-xl font-bold text-white">Connecting...</div>
            <p className="text-white/60">
              Establishing connection to the game server
            </p>
          </>
        )}

        {status === "reconnecting" && (
          <>
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-yellow-500" />
            <div className="text-xl font-bold text-white">Reconnecting...</div>
            <p className="text-white/60">
              Connection lost. Attempting to reconnect...
            </p>
            {timeRemaining !== null && timeRemaining > 0 && (
              <div className="mt-2 rounded-lg bg-yellow-600/20 px-4 py-2">
                <span className="text-sm text-yellow-400">
                  AI will take over in {timeRemaining}s if not reconnected
                </span>
              </div>
            )}
            {timeRemaining === 0 && (
              <div className="mt-2 rounded-lg bg-red-600/20 px-4 py-2">
                <span className="text-sm text-red-400">
                  AI has taken control of your turn
                </span>
              </div>
            )}
          </>
        )}

        {status === "disconnected" && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-700">
              <span className="text-2xl">!</span>
            </div>
            <div className="text-xl font-bold text-white">Disconnected</div>
            <p className="text-white/60">
              You have been disconnected from the game server
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-all hover:bg-blue-500"
            >
              Reconnect
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600/20">
              <span className="text-2xl text-red-500">X</span>
            </div>
            <div className="text-xl font-bold text-white">Connection Error</div>
            <p className="text-white/60">
              Failed to connect to the game server. Please check your connection.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-all hover:bg-blue-500"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default ConnectionOverlay;
