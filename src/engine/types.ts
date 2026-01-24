/**
 * Last Card Game Engine - Core Types
 * Framework-agnostic types for the card game rules
 */

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export interface Card {
  rank: Rank;
  suit: Suit;
}

export interface PlayerState {
  id: number;
  hand: Card[];
  declaredLastCard: boolean; // Has the player declared "Last Card" when they had 2 cards?
  lastCardPenalty: boolean; // Must draw instead of play next turn due to missing declaration
}

export interface PendingEffects {
  forcedDrawCount: number; // Accumulated draw count from 2s and 5s
  skipNextPlayer: boolean; // Next player is skipped (from 10)
}

export interface GameState {
  players: PlayerState[];
  currentPlayerIndex: number;
  drawPile: Card[];
  discardPile: Card[]; // Top of pile is at the end (last element)
  chosenSuit: Suit | null; // Override suit when an Ace was played
  pendingEffects: PendingEffects;
  turnPhase: TurnPhase;
  winner: number | null; // Player ID who won, or null if game ongoing
  lastPlayWasSpecial: boolean; // Used for last card declaration restriction
}

export type TurnPhase =
  | "waiting" // Waiting for handoff confirmation
  | "playing" // Player is choosing a play
  | "must-draw" // Player must draw due to forced draw or last card penalty
  | "declaring-suit" // Player played an Ace and must choose a suit
  | "can-end" // Player has taken an action and can end their turn
  | "game-over"; // Game has ended

export interface Play {
  cards: Card[]; // Cards to play, in order (first = bottom, last = top of discard)
  chosenSuit?: Suit; // Only used when playing an Ace
}

export interface LegalPlay {
  play: Play;
  description: string; // Human-readable description
}

// Utility type for card comparison
export function cardEquals(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

export function cardToString(card: Card): string {
  const suitSymbols: Record<Suit, string> = {
    hearts: "\u2665",
    diamonds: "\u2666",
    clubs: "\u2663",
    spades: "\u2660",
  };
  return `${card.rank}${suitSymbols[card.suit]}`;
}

export function suitToSymbol(suit: Suit): string {
  const suitSymbols: Record<Suit, string> = {
    hearts: "\u2665",
    diamonds: "\u2666",
    clubs: "\u2663",
    spades: "\u2660",
  };
  return suitSymbols[suit];
}

export function isRedSuit(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}
