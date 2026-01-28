"use client";

import { useCallback } from "react";
import type { PublicPlayer, LobbyConfig } from "@/lib/party/messages";

export interface LobbyProps {
  /** Room code to display */
  code: string;
  /** Players in the lobby */
  players: PublicPlayer[];
  /** Current player's ID */
  myPlayerId: string | null;
  /** Whether current player is host */
  isHost: boolean;
  /** Lobby configuration */
  config: LobbyConfig;
  /** Error message to display */
  error: string | null;
  /** Configure game settings (host only) */
  onConfigureGame: (config: Partial<LobbyConfig>) => void;
  /** Start the game (host only) */
  onStartGame: () => void;
  /** Add an AI player (host only) */
  onAddAI: () => void;
  /** Remove an AI player (host only) */
  onRemoveAI: (aiPlayerId: string) => void;
  /** Kick a player (host only) */
  onKickPlayer: (playerId: string) => void;
  /** Leave the lobby */
  onLeave: () => void;
  /** Clear error */
  onClearError: () => void;
}

export function Lobby({
  code,
  players,
  myPlayerId,
  isHost,
  config,
  error,
  onConfigureGame,
  onStartGame,
  onAddAI,
  onRemoveAI,
  onKickPlayer,
  onLeave,
  onClearError,
}: LobbyProps) {
  const humanPlayers = players.filter((p) => !p.isAI);
  const aiPlayers = players.filter((p) => p.isAI);
  const totalPlayers = players.length;
  const canStart = totalPlayers >= 2 && totalPlayers <= config.maxPlayers;
  const canAddAI = totalPlayers < config.maxPlayers;

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(code);
  }, [code]);

  const handleMaxPlayersChange = useCallback(
    (maxPlayers: 2 | 3 | 4) => {
      onConfigureGame({ maxPlayers });
    },
    [onConfigureGame]
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      {/* Title */}
      <h1 className="text-4xl font-bold text-white">Game Lobby</h1>

      {/* Game Code */}
      <div className="flex flex-col items-center gap-2">
        <div className="text-sm font-medium text-white/60">Share this code with friends</div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gray-700 px-8 py-4 font-mono text-4xl font-bold tracking-widest text-white">
            {code}
          </div>
          <button
            onClick={handleCopyCode}
            className="rounded-lg bg-gray-600 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-gray-500"
            title="Copy to clipboard"
          >
            Copy
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg bg-red-600/80 px-4 py-3">
          <span className="text-white">{error}</span>
          <button
            onClick={onClearError}
            className="text-white/80 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Players List */}
      <div className="w-full max-w-md">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-medium text-white">
            Players ({totalPlayers}/{config.maxPlayers})
          </div>
          {isHost && (
            <div className="flex gap-2">
              {([2, 3, 4] as const).map((num) => (
                <button
                  key={num}
                  onClick={() => handleMaxPlayersChange(num)}
                  disabled={totalPlayers > num}
                  className={`rounded px-3 py-1 text-sm font-medium transition-all ${
                    config.maxPlayers === num
                      ? "bg-green-600 text-white"
                      : totalPlayers > num
                        ? "cursor-not-allowed bg-gray-700 text-white/30"
                        : "bg-gray-700 text-white/70 hover:bg-gray-600"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {/* Human Players */}
          {humanPlayers.map((player) => (
            <div
              key={player.id}
              className="flex items-center justify-between rounded-lg bg-gray-800 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {/* Connection indicator */}
                <div
                  className={`h-3 w-3 rounded-full ${
                    player.isConnected ? "bg-green-500" : "bg-yellow-500"
                  }`}
                  title={player.isConnected ? "Connected" : "Reconnecting..."}
                />
                <span className="font-medium text-white">{player.name}</span>
                {player.isHost && (
                  <span className="rounded bg-yellow-600 px-2 py-0.5 text-xs font-medium text-white">
                    Host
                  </span>
                )}
                {player.id === myPlayerId && (
                  <span className="rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                    You
                  </span>
                )}
              </div>
              {/* Kick button (host only, can't kick self) */}
              {isHost && player.id !== myPlayerId && (
                <button
                  onClick={() => onKickPlayer(player.id)}
                  className="rounded bg-red-600/50 px-3 py-1 text-sm text-white transition-all hover:bg-red-600"
                >
                  Kick
                </button>
              )}
            </div>
          ))}

          {/* AI Players */}
          {aiPlayers.map((player) => (
            <div
              key={player.id}
              className="flex items-center justify-between rounded-lg bg-gray-800 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-purple-500" />
                <span className="font-medium text-white">{player.name}</span>
                <span className="rounded bg-purple-600 px-2 py-0.5 text-xs font-medium text-white">
                  AI
                </span>
              </div>
              {/* Remove AI button (host only) */}
              {isHost && (
                <button
                  onClick={() => onRemoveAI(player.id)}
                  className="rounded bg-gray-600 px-3 py-1 text-sm text-white transition-all hover:bg-gray-500"
                >
                  Remove
                </button>
              )}
            </div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: config.maxPlayers - totalPlayers }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex items-center justify-between rounded-lg border-2 border-dashed border-gray-700 px-4 py-3"
            >
              <span className="text-white/40">Waiting for player...</span>
              {/* Add AI button (host only, in first empty slot) */}
              {isHost && i === 0 && canAddAI && (
                <button
                  onClick={onAddAI}
                  className="rounded bg-purple-600 px-3 py-1 text-sm text-white transition-all hover:bg-purple-500"
                >
                  + Add AI
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        {isHost ? (
          <>
            <button
              onClick={onStartGame}
              disabled={!canStart}
              className={`rounded-xl px-8 py-4 text-xl font-bold transition-all ${
                canStart
                  ? "bg-green-600 text-white shadow-lg hover:scale-105 hover:bg-green-500"
                  : "cursor-not-allowed bg-gray-700 text-white/40"
              }`}
            >
              Start Game
            </button>
            <button
              onClick={onLeave}
              className="rounded-xl bg-gray-700 px-6 py-4 font-bold text-white transition-all hover:bg-gray-600"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={onLeave}
            className="rounded-xl bg-red-600 px-8 py-4 text-xl font-bold text-white transition-all hover:bg-red-500"
          >
            Leave Lobby
          </button>
        )}
      </div>

      {/* Status message */}
      {!canStart && (
        <div className="text-sm text-white/60">
          {totalPlayers < 2
            ? "Need at least 2 players to start"
            : `Maximum ${config.maxPlayers} players allowed`}
        </div>
      )}
    </div>
  );
}
