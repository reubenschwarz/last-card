"use client";

import { Suit, suitToSymbol } from "@/engine";

interface SuitChooserProps {
  onChoose: (suit: Suit) => void;
  onCancel: () => void;
}

const suits: Suit[] = ["hearts", "diamonds", "clubs", "spades"];

export function SuitChooser({ onChoose, onCancel }: SuitChooserProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="rounded-xl bg-gray-800 p-6 shadow-2xl">
        <h2 className="mb-4 text-center text-xl font-bold text-white">Choose a Suit</h2>
        <div className="grid grid-cols-2 gap-3">
          {suits.map((suit) => {
            const isRed = suit === "hearts" || suit === "diamonds";
            return (
              <button
                key={suit}
                onClick={() => onChoose(suit)}
                className={`flex flex-col items-center gap-1 rounded-lg px-6 py-4 text-3xl font-bold transition-all hover:scale-105 ${
                  isRed
                    ? "bg-red-600 text-white hover:bg-red-500"
                    : "bg-gray-700 text-white hover:bg-gray-600"
                }`}
              >
                <span className="text-4xl">{suitToSymbol(suit)}</span>
                <span className="text-sm capitalize">{suit}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={onCancel}
          className="mt-4 w-full rounded-lg bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-500"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
