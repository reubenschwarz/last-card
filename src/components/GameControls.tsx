"use client";

interface GameControlsProps {
  canPlay: boolean;
  canDraw: boolean;
  canEndTurn: boolean;
  canDeclareLastCard: boolean;
  mustDraw: boolean;
  forcedDrawCount: number;
  hasLastCardPenalty: boolean;
  hasDeclaredLastCard: boolean;
  onPlay: () => void;
  onDraw: () => void;
  onEndTurn: () => void;
  onDeclareLastCard: () => void;
}

export function GameControls({
  canPlay,
  canDraw,
  canEndTurn,
  canDeclareLastCard,
  mustDraw,
  forcedDrawCount,
  hasLastCardPenalty,
  hasDeclaredLastCard,
  onPlay,
  onDraw,
  onEndTurn,
  onDeclareLastCard,
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
            : "bg-gray-700 text-gray-400 cursor-not-allowed"
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
            ? "bg-red-600 text-white animate-pulse hover:bg-red-500"
            : canDraw
              ? "bg-amber-600 text-white hover:bg-amber-500 hover:scale-105"
              : "bg-gray-700 text-gray-400 cursor-not-allowed"
        }`}
      >
        {mustDraw
          ? hasLastCardPenalty
            ? "Must Draw 1 (Penalty)"
            : `Must Draw ${forcedDrawCount}`
          : "Draw Card"}
      </button>

      {/* Last Card declaration button */}
      {canDeclareLastCard && !hasDeclaredLastCard && (
        <button
          onClick={onDeclareLastCard}
          className="animate-pulse rounded-lg bg-yellow-500 px-6 py-3 font-bold text-black transition-all hover:scale-105 hover:bg-yellow-400"
        >
          Declare LAST CARD
        </button>
      )}

      {/* Show declared badge */}
      {hasDeclaredLastCard && (
        <span className="rounded-lg bg-green-600 px-4 py-2 font-bold text-white">
          LAST CARD Declared ✓
        </span>
      )}

      {/* End Turn button */}
      <button
        onClick={onEndTurn}
        disabled={!canEndTurn}
        className={`rounded-lg px-6 py-3 font-bold transition-all ${
          canEndTurn
            ? "bg-green-600 text-white hover:bg-green-500 hover:scale-105"
            : "bg-gray-700 text-gray-400 cursor-not-allowed"
        }`}
      >
        End Turn
      </button>
    </div>
  );
}
