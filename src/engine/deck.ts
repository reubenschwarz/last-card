/**
 * Deck utilities for Last Card
 */

import { Card, Rank, Suit } from "./types";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

/**
 * Creates a fresh, unshuffled 52-card deck
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/**
 * Shuffles an array in place using Fisher-Yates algorithm
 * @param array The array to shuffle
 * @param rng Optional random number generator (returns 0-1), defaults to Math.random
 */
export function shuffle<T>(array: T[], rng: () => number = Math.random): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Creates a seeded random number generator for deterministic shuffling
 * Uses a simple linear congruential generator
 */
export function createSeededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * Creates and shuffles a new deck
 */
export function createShuffledDeck(rng?: () => number): Card[] {
  return shuffle(createDeck(), rng);
}
