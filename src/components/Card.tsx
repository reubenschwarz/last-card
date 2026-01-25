"use client";

import { Card as CardType, isRedSuit } from "@/engine";

interface CardProps {
  card: CardType;
  faceDown?: boolean;
  selected?: boolean;
  selectable?: boolean;
  magnified?: boolean;
  onClick?: () => void;
  size?: "small" | "medium" | "large";
  className?: string;
}

const sizeClasses = {
  small: "w-12 h-16 text-sm",
  medium: "w-16 h-22 text-base",
  large: "w-20 h-28 text-lg",
};

export function Card({
  card,
  faceDown = false,
  selected = false,
  selectable = false,
  magnified = false,
  onClick,
  size = "medium",
  className = "",
}: CardProps) {
  const isRed = isRedSuit(card.suit);
  const suitSymbols: Record<string, string> = {
    hearts: "\u2665",
    diamonds: "\u2666",
    clubs: "\u2663",
    spades: "\u2660",
  };

  const baseClasses = `
    ${sizeClasses[size]}
    rounded-lg border-2
    flex flex-col items-center justify-center
    font-bold transition-all duration-150
    ${selected ? "-translate-y-3 border-yellow-400 shadow-lg shadow-yellow-400/50" : "border-gray-300"}
    ${magnified && !selected ? "scale-125 -translate-y-4 shadow-xl" : ""}
    ${selectable && !faceDown ? "cursor-pointer" : ""}
    ${faceDown ? "cursor-default" : ""}
  `;

  if (faceDown) {
    return (
      <div
        className={`${baseClasses} bg-blue-700 border-blue-900 ${className}`}
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.1) 5px, rgba(255,255,255,0.1) 10px)",
        }}
      >
        <div className="h-4 w-6 rounded bg-white/20"></div>
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} bg-white ${isRed ? "text-red-600" : "text-gray-900"} ${className}`}
      onClick={selectable ? onClick : undefined}
    >
      <span className="text-xs leading-none">{card.rank}</span>
      <span className="text-2xl leading-none">{suitSymbols[card.suit]}</span>
      <span className="text-xs leading-none">{card.rank}</span>
    </div>
  );
}

export function CardBack({
  size = "medium",
  className = "",
  onClick,
  clickable = false,
}: {
  size?: "small" | "medium" | "large";
  className?: string;
  onClick?: () => void;
  clickable?: boolean;
}) {
  return (
    <div
      className={`
        ${sizeClasses[size]}
        rounded-lg border-2 border-blue-900 bg-blue-700
        flex items-center justify-center
        ${clickable ? "cursor-pointer hover:bg-blue-600 hover:scale-105 transition-all" : ""}
        ${className}
      `}
      style={{
        backgroundImage:
          "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.1) 5px, rgba(255,255,255,0.1) 10px)",
      }}
      onClick={clickable ? onClick : undefined}
    >
      <div className="h-6 w-10 rounded bg-white/20"></div>
    </div>
  );
}
