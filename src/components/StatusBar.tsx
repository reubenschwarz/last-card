"use client";

import { Suit, suitToSymbol } from "@/engine";

interface StatusBarProps {
  currentPlayer: number;
  targetSuit: Suit;
  targetRank: string;
  forcedDrawCount: number;
  skipActive: boolean;
}

export function StatusBar({
  currentPlayer,
  targetSuit,
  targetRank,
  forcedDrawCount,
  skipActive,
}: StatusBarProps) {
  const isRedSuit = targetSuit === "hearts" || targetSuit === "diamonds";

  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      {/* Player indicator */}
      <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
        <span className="text-sm text-white/70">Turn:</span>
        <span className="font-bold text-white">Player {currentPlayer + 1}</span>
      </div>

      {/* Target indicator */}
      <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
        <span className="text-sm text-white/70">Target:</span>
        <span className={`font-bold ${isRedSuit ? "text-red-400" : "text-white"}`}>
          {targetRank} {suitToSymbol(targetSuit)}
        </span>
      </div>

      {/* Pending effects */}
      {forcedDrawCount > 0 && (
        <div className="flex items-center gap-2 rounded-full bg-red-600/80 px-4 py-2">
          <span className="font-bold text-white">+{forcedDrawCount} Draw Penalty!</span>
        </div>
      )}

      {skipActive && (
        <div className="flex items-center gap-2 rounded-full bg-orange-600/80 px-4 py-2">
          <span className="font-bold text-white">Skip Next Player!</span>
        </div>
      )}
    </div>
  );
}
