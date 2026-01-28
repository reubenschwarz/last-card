"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { MultiplayerSetup, type MultiplayerMode } from "@/components/MultiplayerSetup";

/**
 * Lobby page for creating/joining multiplayer games.
 * Uses MultiplayerSetup component for the UI.
 */
export default function LobbyPage() {
  const router = useRouter();

  const handleProceed = useCallback(
    (mode: MultiplayerMode, roomCode: string, displayName: string) => {
      // Navigate to the game room
      router.push(`/play/${roomCode}`);
    },
    [router]
  );

  const handleBack = useCallback(() => {
    router.push("/");
  }, [router]);

  return (
    <MultiplayerSetup
      onProceed={handleProceed}
      onBack={handleBack}
    />
  );
}
