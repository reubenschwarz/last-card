"use client";

import { useState } from "react";
import { Card as CardType, cardEquals, Rank, Suit } from "@/engine";
import { Card } from "./Card";

interface HandProps {
  cards: CardType[];
  selectedCards: CardType[];
  onSelectCard: (card: CardType) => void;
  onDeselectCard: (card: CardType) => void;
  disabled?: boolean;
}

// Rank order for sorting (A high, then K, Q, J, 10-2)
const RANK_ORDER: Record<Rank, number> = {
  A: 14,
  K: 13,
  Q: 12,
  J: 11,
  "10": 10,
  "9": 9,
  "8": 8,
  "7": 7,
  "6": 6,
  "5": 5,
  "4": 4,
  "3": 3,
  "2": 2,
};

// Suit order for sorting within same rank
const SUIT_ORDER: Record<Suit, number> = {
  spades: 4,
  hearts: 3,
  diamonds: 2,
  clubs: 1,
};

// Sort cards: group by rank first, then by suit within each rank
function sortCards(cards: CardType[]): CardType[] {
  return [...cards].sort((a, b) => {
    // First sort by rank (descending - high cards first)
    const rankDiff = RANK_ORDER[b.rank] - RANK_ORDER[a.rank];
    if (rankDiff !== 0) return rankDiff;
    // Then by suit (descending)
    return SUIT_ORDER[b.suit] - SUIT_ORDER[a.suit];
  });
}

export function Hand({
  cards,
  selectedCards,
  onSelectCard,
  onDeselectCard,
  disabled = false,
}: HandProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const sortedCards = sortCards(cards);

  const isSelected = (card: CardType) => selectedCards.some((c) => cardEquals(c, card));

  const handleCardClick = (card: CardType) => {
    if (disabled) return;

    if (isSelected(card)) {
      onDeselectCard(card);
    } else {
      onSelectCard(card);
    }
  };

  // Calculate overlap based on number of cards
  const getOverlap = () => {
    if (sortedCards.length <= 5) return -8;
    if (sortedCards.length <= 7) return -24;
    if (sortedCards.length <= 10) return -32;
    if (sortedCards.length <= 15) return -40;
    return -48;
  };

  const overlap = getOverlap();

  return (
    <div className="flex justify-center px-4">
      <div className="flex items-end">
        {sortedCards.map((card, index) => {
          const isHovered = hoveredIndex === index;
          // When hovering, bring card to front (high z-index)
          const zIndex = isHovered ? 100 : index;

          return (
            <div
              key={`${card.rank}-${card.suit}`}
              className="transition-all duration-150"
              style={{
                marginLeft: index > 0 ? overlap : 0,
                zIndex,
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <Card
                card={card}
                selected={isSelected(card)}
                selectable={!disabled}
                onClick={() => handleCardClick(card)}
                size="large"
                magnified={isHovered}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
