"use client";

import { CardBack } from "./Card";

interface OpponentAreaProps {
  cardCount: number;
  playerName: string;
  hasLastCardDeclared?: boolean;
}

export function OpponentArea({ cardCount, playerName, hasLastCardDeclared }: OpponentAreaProps) {
  // Display up to 7 card backs, then just show count
  const displayCount = Math.min(cardCount, 7);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-white/80">{playerName}</span>
        <span className="rounded bg-white/20 px-2 py-0.5 text-xs font-bold text-white">
          {cardCount} {cardCount === 1 ? "card" : "cards"}
        </span>
        {hasLastCardDeclared && cardCount === 1 && (
          <span className="animate-pulse rounded bg-yellow-500 px-2 py-0.5 text-xs font-bold text-black">
            LAST CARD!
          </span>
        )}
      </div>
      <div className="flex">
        {Array.from({ length: displayCount }).map((_, index) => (
          <div key={index} className={index > 0 ? "-ml-10" : ""} style={{ zIndex: index }}>
            <CardBack size="medium" />
          </div>
        ))}
        {cardCount > 7 && (
          <div className="ml-2 flex items-center">
            <span className="text-xs text-white/60">+{cardCount - 7} more</span>
          </div>
        )}
      </div>
    </div>
  );
}
