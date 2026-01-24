"use client";

import { Card as CardType } from "@/engine";
import { Card } from "./Card";

interface OrderStripProps {
  cards: CardType[];
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export function OrderStrip({ cards, onReorder }: OrderStripProps) {
  if (cards.length < 2) return null;

  const moveUp = (index: number) => {
    if (index > 0) {
      onReorder(index, index - 1);
    }
  };

  const moveDown = (index: number) => {
    if (index < cards.length - 1) {
      onReorder(index, index + 1);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg bg-black/30 p-3">
      <span className="text-xs font-medium text-white/70">Play Order (left = first, right = last/top)</span>
      <div className="flex items-center gap-2">
        {cards.map((card, index) => (
          <div key={`order-${card.rank}-${card.suit}`} className="flex flex-col items-center gap-1">
            <Card card={card} size="small" />
            <div className="flex gap-1">
              <button
                onClick={() => moveUp(index)}
                disabled={index === 0}
                className="rounded bg-white/20 px-2 py-0.5 text-xs text-white transition-colors hover:bg-white/30 disabled:opacity-30 disabled:hover:bg-white/20"
              >
                ←
              </button>
              <button
                onClick={() => moveDown(index)}
                disabled={index === cards.length - 1}
                className="rounded bg-white/20 px-2 py-0.5 text-xs text-white transition-colors hover:bg-white/30 disabled:opacity-30 disabled:hover:bg-white/20"
              >
                →
              </button>
            </div>
            <span className="text-xs text-white/50">
              {index === 0 ? "First" : index === cards.length - 1 ? "Top" : `#${index + 1}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
