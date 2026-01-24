"use client";

import { Card as CardType, cardEquals } from "@/engine";
import { Card } from "./Card";

interface HandProps {
  cards: CardType[];
  selectedCards: CardType[];
  onSelectCard: (card: CardType) => void;
  onDeselectCard: (card: CardType) => void;
  disabled?: boolean;
}

export function Hand({
  cards,
  selectedCards,
  onSelectCard,
  onDeselectCard,
  disabled = false,
}: HandProps) {
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
    if (cards.length <= 5) return "ml-0";
    if (cards.length <= 7) return "-ml-6";
    if (cards.length <= 10) return "-ml-8";
    return "-ml-10";
  };

  return (
    <div className="flex justify-center px-4">
      <div className="flex items-end">
        {cards.map((card, index) => (
          <div
            key={`${card.rank}-${card.suit}`}
            className={`${index > 0 ? getOverlap() : ""} transition-all duration-150`}
            style={{ zIndex: index }}
          >
            <Card
              card={card}
              selected={isSelected(card)}
              selectable={!disabled}
              onClick={() => handleCardClick(card)}
              size="large"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
