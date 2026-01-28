"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { MultiplayerSetup, type MultiplayerMode } from "@/components/MultiplayerSetup";
import { findAvailableRoom } from "@/lib/party/matchmaker";
import { customAlphabet } from "nanoid";

// Generate 4-character uppercase room codes (same as MultiplayerSetup)
const generateRoomCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 4);

/**
 * Lobby page for creating/joining multiplayer games.
 * Uses MultiplayerSetup component for the UI.
 */
export default function LobbyPage() {
  const router = useRouter();
  const [isSearching, setIsSearching] = useState(false);

  const handleProceed = useCallback(
    async (mode: MultiplayerMode, roomCode: string, displayName: string) => {
      if (mode === "quick") {
        // Quick Play: query matchmaker for an available room
        setIsSearching(true);
        try {
          const availableRoom = await findAvailableRoom();
          if (availableRoom) {
            // Found an available room, join it
            router.push(`/play/${availableRoom.code}`);
          } else {
            // No rooms available, create a new public one
            const newCode = generateRoomCode();
            router.push(`/play/${newCode}?public=true`);
          }
        } catch (error) {
          console.error("[Lobby] Error finding room:", error);
          // On error, create a new room
          const newCode = generateRoomCode();
          router.push(`/play/${newCode}?public=true`);
        } finally {
          setIsSearching(false);
        }
      } else {
        // Create or Join: navigate directly to the room
        router.push(`/play/${roomCode}`);
      }
    },
    [router]
  );

  const handleBack = useCallback(() => {
    router.push("/");
  }, [router]);

  if (isSearching) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
        <p className="text-lg text-white">Finding a game...</p>
      </div>
    );
  }

  return (
    <MultiplayerSetup
      onProceed={handleProceed}
      onBack={handleBack}
    />
  );
}
