"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePlayerIdentity } from "@/lib/player/identity";
import { useGameRoom } from "@/lib/party/hooks";
import { Lobby } from "@/components/Lobby";
import { ConnectionOverlay } from "@/components/ConnectionOverlay";

/**
 * Game room page.
 * Handles joining a room by code and displaying the appropriate UI
 * based on room status (lobby vs playing).
 */
export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.code as string)?.toUpperCase() ?? "";

  const { playerId, displayName, isLoaded, needsDisplayName } = usePlayerIdentity();

  // Redirect to lobby page if no display name set
  useEffect(() => {
    if (isLoaded && needsDisplayName) {
      router.push("/lobby");
    }
  }, [isLoaded, needsDisplayName, router]);

  // Don't render game room until we have player identity
  if (!isLoaded || !playerId || !displayName) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <GameRoom
      roomCode={roomCode}
      playerId={playerId}
      displayName={displayName}
    />
  );
}

interface GameRoomProps {
  roomCode: string;
  playerId: string;
  displayName: string;
}

/**
 * Inner component that handles the game room connection.
 * Separated to ensure hooks are only called with valid props.
 */
function GameRoom({ roomCode, playerId, displayName }: GameRoomProps) {
  const router = useRouter();

  const {
    connectionStatus,
    disconnectedAt,
    room,
    leave,
    setName: _setName,
    configureGame,
    startGame,
    addAI,
    removeAI,
    kickPlayer,
    playAction: _playAction,
    clearError,
  } = useGameRoom({
    roomCode,
    playerId,
    displayName,
    autoJoin: true,
  });

  const handleLeave = () => {
    leave();
    router.push("/lobby");
  };

  // Show connection overlay for connection issues (but not during initial connect before joining)
  const showConnectionOverlay =
    connectionStatus === "connecting" ||
    connectionStatus === "reconnecting" ||
    connectionStatus === "error" ||
    connectionStatus === "disconnected";

  // For initial connection before we have any room data, show full-screen overlay
  if (showConnectionOverlay && !room.myPlayerId) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-900 to-gray-800">
        <ConnectionOverlay
          status={connectionStatus}
          disconnectedAt={disconnectedAt ?? undefined}
        />
      </div>
    );
  }

  // Show lobby while waiting for game to start
  if (room.status === "lobby") {
    return (
      <>
        <Lobby
          code={room.code || roomCode}
          players={room.players}
          myPlayerId={room.myPlayerId}
          isHost={room.isHost}
          config={room.config}
          error={room.error}
          onConfigureGame={configureGame}
          onStartGame={startGame}
          onAddAI={addAI}
          onRemoveAI={removeAI}
          onKickPlayer={kickPlayer}
          onLeave={handleLeave}
          onClearError={clearError}
        />
        {showConnectionOverlay && (
          <ConnectionOverlay
            status={connectionStatus}
            disconnectedAt={disconnectedAt ?? undefined}
          />
        )}
      </>
    );
  }

  // Show game state when playing
  if (room.status === "playing" && room.gameState) {
    // TODO: Integrate with multiplayer game board
    // For now, show a placeholder
    return (
      <>
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-gray-900 to-gray-800">
          <div className="text-2xl font-bold text-white">Game In Progress</div>
          <div className="text-white/60">
            Multiplayer game view coming soon...
          </div>
          <div className="rounded-lg bg-gray-800 p-4 text-sm text-white/60">
            <pre>{JSON.stringify(room.gameState, null, 2).slice(0, 500)}...</pre>
          </div>
          <button
            onClick={handleLeave}
            className="rounded-lg bg-red-600 px-6 py-3 font-medium text-white transition-all hover:bg-red-500"
          >
            Leave Game
          </button>
        </div>
        {showConnectionOverlay && (
          <ConnectionOverlay
            status={connectionStatus}
            disconnectedAt={disconnectedAt ?? undefined}
          />
        )}
      </>
    );
  }

  // Show game ended state
  if (room.status === "ended") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-3xl font-bold text-white">Game Over</div>
        <button
          onClick={() => router.push("/lobby")}
          className="rounded-lg bg-green-600 px-8 py-4 font-bold text-white transition-all hover:bg-green-500"
        >
          Play Again
        </button>
      </div>
    );
  }

  // Fallback
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="text-white/60">Loading room...</div>
    </div>
  );
}
