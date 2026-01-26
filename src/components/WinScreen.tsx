"use client";

interface WinScreenProps {
  winner: number;
  winnerLabel?: string; // "AI" or "Human"
  onPlayAgain: () => void;
}

export function WinScreen({ winner, winnerLabel, onPlayAgain }: WinScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-yellow-900/90 to-amber-900/90">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-medium text-white/80">Congratulations!</h2>
          <h1 className="text-5xl font-bold text-yellow-300">Player {winner + 1} Wins!</h1>
          {winnerLabel && (
            <p className="text-lg text-white/60">({winnerLabel})</p>
          )}
        </div>

        <div className="text-8xl">🏆</div>

        <button
          onClick={onPlayAgain}
          className="rounded-xl bg-green-600 px-12 py-4 text-xl font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-green-500"
        >
          Play Again
        </button>
      </div>
    </div>
  );
}
