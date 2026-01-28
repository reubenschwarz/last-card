"use client";

import { useState, useCallback } from "react";
import { customAlphabet } from "nanoid";
import {
  usePlayerIdentity,
  isValidDisplayName,
  getDisplayNameError,
} from "@/lib/player/identity";

// Generate 4-character uppercase room codes
const generateRoomCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 4);

export type MultiplayerMode = "create" | "join" | "quick";

export interface MultiplayerSetupProps {
  /** Called when user wants to proceed with a mode and room code */
  onProceed: (mode: MultiplayerMode, roomCode: string, displayName: string) => void;
  /** Called when user wants to go back to local play */
  onBack?: () => void;
}

/**
 * Multiplayer setup screen with three entry points:
 * - Create Game: Generate a room code and become host
 * - Join by Code: Enter an existing room code
 * - Quick Play: Join a random open game or create one
 */
export function MultiplayerSetup({ onProceed, onBack }: MultiplayerSetupProps) {
  const { displayName: storedName, isLoaded, updateDisplayName } = usePlayerIdentity();

  // Local state for the name input
  const [nameInput, setNameInput] = useState(storedName ?? "");
  const [nameError, setNameError] = useState<string | null>(null);

  // Join by code state
  const [joinCode, setJoinCode] = useState("");
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);

  // Selected mode (for mobile-friendly flow)
  const [selectedMode, setSelectedMode] = useState<MultiplayerMode | null>(null);

  // Validate and save name, then proceed
  const handleProceed = useCallback(
    (mode: MultiplayerMode, roomCode?: string) => {
      // Validate name
      if (!isValidDisplayName(nameInput)) {
        setNameError(getDisplayNameError(nameInput));
        return;
      }
      setNameError(null);

      // Save the name
      updateDisplayName(nameInput);

      // Determine room code based on mode
      let code = roomCode ?? "";
      if (mode === "create") {
        code = generateRoomCode();
      } else if (mode === "quick") {
        // Quick play is handled by the lobby page via matchmaker
        // Just pass empty code, lobby will query matchmaker and generate if needed
        code = "";
      } else if (mode === "join") {
        // Validate join code
        const cleanCode = joinCode.toUpperCase().trim();
        if (cleanCode.length !== 4) {
          setJoinCodeError("Room code must be 4 characters");
          return;
        }
        setJoinCodeError(null);
        code = cleanCode;
      }

      onProceed(mode, code, nameInput.trim());
    },
    [nameInput, joinCode, updateDisplayName, onProceed]
  );

  // Handle join code input
  const handleJoinCodeChange = useCallback((value: string) => {
    // Only allow alphanumeric, max 4 characters
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    setJoinCode(cleaned);
    setJoinCodeError(null);
  }, []);

  // Loading state
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <h1 className="text-5xl font-bold text-white">Last Card</h1>
      <p className="max-w-md text-center text-white/60">
        Play online with friends or random opponents
      </p>

      {/* Display Name Input */}
      <div className="flex w-full max-w-sm flex-col gap-2">
        <label htmlFor="displayName" className="text-sm font-medium text-white/80">
          Your Display Name
        </label>
        <input
          id="displayName"
          type="text"
          value={nameInput}
          onChange={(e) => {
            setNameInput(e.target.value);
            setNameError(null);
          }}
          placeholder="Enter your name..."
          maxLength={20}
          className={`rounded-lg border-2 bg-gray-800 px-4 py-3 text-white placeholder-white/40 outline-none transition-colors ${
            nameError
              ? "border-red-500 focus:border-red-400"
              : "border-gray-700 focus:border-green-500"
          }`}
        />
        {nameError && (
          <p className="text-sm text-red-400">{nameError}</p>
        )}
      </div>

      {/* Mode Selection */}
      {!selectedMode ? (
        <div className="flex w-full max-w-md flex-col gap-4">
          {/* Create Game */}
          <button
            onClick={() => handleProceed("create")}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-green-600 to-green-500 px-8 py-5 text-left shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
          >
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-white">Create Game</h3>
              <p className="mt-1 text-sm text-white/80">
                Start a new room and invite friends
              </p>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-4xl opacity-30">
              +
            </div>
          </button>

          {/* Join by Code */}
          <button
            onClick={() => setSelectedMode("join")}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-5 text-left shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
          >
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-white">Join by Code</h3>
              <p className="mt-1 text-sm text-white/80">
                Enter a room code to join friends
              </p>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-3xl opacity-30">
              #
            </div>
          </button>

          {/* Quick Play */}
          <button
            onClick={() => handleProceed("quick")}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 px-8 py-5 text-left shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
          >
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-white">Quick Play</h3>
              <p className="mt-1 text-sm text-white/80">
                Join a random game or start one
              </p>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-3xl opacity-30">
              ⚡
            </div>
          </button>
        </div>
      ) : (
        /* Join by Code Input */
        <div className="flex w-full max-w-sm flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="roomCode" className="text-sm font-medium text-white/80">
              Room Code
            </label>
            <input
              id="roomCode"
              type="text"
              value={joinCode}
              onChange={(e) => handleJoinCodeChange(e.target.value)}
              placeholder="ABCD"
              maxLength={4}
              autoFocus
              className={`rounded-lg border-2 bg-gray-800 px-4 py-4 text-center text-2xl font-bold uppercase tracking-widest text-white placeholder-white/30 outline-none transition-colors ${
                joinCodeError
                  ? "border-red-500 focus:border-red-400"
                  : "border-gray-700 focus:border-blue-500"
              }`}
            />
            {joinCodeError && (
              <p className="text-sm text-red-400">{joinCodeError}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setSelectedMode(null);
                setJoinCode("");
                setJoinCodeError(null);
              }}
              className="flex-1 rounded-lg bg-gray-700 px-6 py-3 font-medium text-white transition-all hover:bg-gray-600"
            >
              Back
            </button>
            <button
              onClick={() => handleProceed("join")}
              disabled={joinCode.length !== 4}
              className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-bold text-white transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Join Game
            </button>
          </div>
        </div>
      )}

      {/* Back to Local Play */}
      {onBack && !selectedMode && (
        <button
          onClick={onBack}
          className="mt-4 text-white/60 transition-colors hover:text-white"
        >
          ← Back to Local Play
        </button>
      )}
    </div>
  );
}

export default MultiplayerSetup;
