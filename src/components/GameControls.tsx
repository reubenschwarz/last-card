"use client";

interface GameControlsProps {
  canPlay: boolean;
  canDraw: boolean;
  mustDraw: boolean;
  forcedDrawCount: number;
  hasLastCardPenalty: boolean;
  onPlay: () => void;
  onDraw: () => void;
}

export function GameControls({
  canPlay,
  canDraw,
  mustDraw,
  forcedDrawCount,
  hasLastCardPenalty,
  onPlay,
  onDraw,
}: GameControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {/* Play button */}
      <button
        onClick={onPlay}
        disabled={!canPlay}
        className={`rounded-lg px-6 py-3 font-bold transition-all ${
          canPlay
            ? "bg-blue-600 text-white hover:bg-blue-500 hover:scale-105"
            : "cursor-not-allowed bg-gray-700 text-gray-400"
        }`}
      >
        Play Selected
      </button>

      {/* Draw button */}
      <button
        onClick={onDraw}
        disabled={!canDraw}
        className={`rounded-lg px-6 py-3 font-bold transition-all ${
          mustDraw
            ? "animate-pulse bg-red-600 text-white hover:bg-red-500"
            : canDraw
              ? "bg-amber-600 text-white hover:bg-amber-500 hover:scale-105"
              : "cursor-not-allowed bg-gray-700 text-gray-400"
        }`}
      >
        {mustDraw
          ? hasLastCardPenalty
            ? "Must Draw 1 (Penalty)"
            : `Must Draw ${forcedDrawCount}`
          : "Draw Card"}
      </button>
    </div>
  );
}

// Separate component for the unobtrusive "Last Card" button
interface LastCardButtonProps {
  onClick: () => void;
  declared: boolean;
}

export function LastCardButton({ onClick, declared }: LastCardButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={declared}
      className={`rounded px-2 py-1 text-xs font-medium transition-all ${
        declared
          ? "cursor-not-allowed bg-green-800 text-green-300"
          : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
      }`}
    >
      {declared ? "Last Card ✓" : "Last Card"}
    </button>
  );
}
