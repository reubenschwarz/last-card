"use client";

import { Card as CardType, Suit, suitToSymbol } from "@/engine";
import { Card, CardBack } from "./Card";

interface PlayAreaProps {
  topCard: CardType | null;
  drawPileCount: number;
  chosenSuit: Suit | null;
  onDrawClick?: () => void;
  canDraw: boolean;
}

export function PlayArea({
  topCard,
  drawPileCount,
  chosenSuit,
  onDrawClick,
  canDraw,
}: PlayAreaProps) {
  return (
    <div className="flex items-center justify-center gap-12">
      {/* Draw pile */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-medium text-white/60">Draw Pile</span>
        <div className="relative">
          {drawPileCount > 2 && (
            <div className="absolute -bottom-1 -right-1">
              <CardBack size="large" className="opacity-60" />
            </div>
          )}
          {drawPileCount > 1 && (
            <div className="absolute -bottom-0.5 -right-0.5">
              <CardBack size="large" className="opacity-80" />
            </div>
          )}
          <CardBack size="large" onClick={onDrawClick} clickable={canDraw} />
        </div>
        <span className="text-xs text-white/50">{drawPileCount} cards</span>
      </div>

      {/* Discard pile */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-medium text-white/60">Discard Pile</span>
        {topCard ? (
          <Card card={topCard} size="large" />
        ) : (
          <div className="flex h-28 w-20 items-center justify-center rounded-lg border-2 border-dashed border-white/30">
            <span className="text-xs text-white/30">Empty</span>
          </div>
        )}
        {/* Show chosen suit indicator when Ace was played */}
        {chosenSuit && topCard?.rank === "A" && (
          <div
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${
              chosenSuit === "hearts" || chosenSuit === "diamonds"
                ? "bg-red-600 text-white"
                : "bg-gray-800 text-white"
            }`}
          >
            <span>Must play</span>
            <span className="text-lg">{suitToSymbol(chosenSuit)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
