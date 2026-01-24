"use client";

interface HandoffScreenProps {
  playerNumber: number;
  onConfirm: () => void;
}

export function HandoffScreen({ playerNumber, onConfirm }: HandoffScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-medium text-white/60">Pass the device to</h2>
          <h1 className="text-5xl font-bold text-white">Player {playerNumber}</h1>
        </div>

        <p className="max-w-md text-white/50">
          Make sure the previous player is no longer looking at the screen before continuing.
        </p>

        <button
          onClick={onConfirm}
          className="rounded-xl bg-green-600 px-12 py-4 text-xl font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-green-500 hover:shadow-xl"
        >
          I am Player {playerNumber} - Start My Turn
        </button>
      </div>
    </div>
  );
}
