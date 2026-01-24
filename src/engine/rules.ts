/**
 * Last Card Rules Engine
 * Pure functions for game state transitions - no UI dependencies
 */

import { createShuffledDeck } from "./deck";
import {
  Card,
  cardEquals,
  cardToString,
  GameState,
  LegalPlay,
  PendingEffects,
  Play,
  PlayerState,
  Rank,
  Suit,
  TurnPhase,
} from "./types";

const INITIAL_HAND_SIZE = 7;

/**
 * Initialize a new game with the specified number of players
 */
export function initializeGame(
  playerCount: number,
  rng?: () => number
): GameState {
  if (playerCount < 2 || playerCount > 4) {
    throw new Error("Player count must be between 2 and 4");
  }

  const deck = createShuffledDeck(rng);

  // Deal cards to players
  const players: PlayerState[] = [];
  for (let i = 0; i < playerCount; i++) {
    players.push({
      id: i,
      hand: deck.splice(0, INITIAL_HAND_SIZE),
      declaredLastCard: false,
      lastCardPenalty: false,
    });
  }

  // Set up draw pile and flip first card to discard pile
  const firstCard = deck.pop()!;
  const drawPile = deck;
  const discardPile = [firstCard];

  // Determine initial pending effects based on the first card
  const pendingEffects = getEffectsFromCard(firstCard);

  return {
    players,
    currentPlayerIndex: 0,
    drawPile,
    discardPile,
    chosenSuit: null, // No suit override initially (even if first card is Ace)
    pendingEffects,
    turnPhase: "waiting", // Start in waiting phase for hotseat
    winner: null,
    lastPlayWasSpecial: isSpecialCard(firstCard),
  };
}

/**
 * Get the current target card (top of discard pile)
 */
export function getTopCard(state: GameState): Card {
  return state.discardPile[state.discardPile.length - 1];
}

/**
 * Get the effective target suit (considering Ace's chosen suit)
 */
export function getTargetSuit(state: GameState): Suit {
  return state.chosenSuit ?? getTopCard(state).suit;
}

/**
 * Get the effective target rank
 */
export function getTargetRank(state: GameState): Rank {
  return getTopCard(state).rank;
}

/**
 * Check if a card is a special effect card
 */
export function isSpecialCard(card: Card): boolean {
  return card.rank === "2" || card.rank === "5" || card.rank === "10";
}

/**
 * Get pending effects from a card
 */
function getEffectsFromCard(card: Card): PendingEffects {
  const effects: PendingEffects = {
    forcedDrawCount: 0,
    skipNextPlayer: false,
  };

  switch (card.rank) {
    case "2":
      effects.forcedDrawCount = 2;
      break;
    case "5":
      effects.forcedDrawCount = 5;
      break;
    case "10":
      effects.skipNextPlayer = true;
      break;
  }

  return effects;
}

/**
 * Check if a single card can be legally played on another
 * This checks the fundamental rule: suit must match OR rank must match
 */
function canCardBePlayed(
  cardToPlay: Card,
  targetSuit: Suit,
  targetRank: Rank,
  hasForcedDraw: boolean
): boolean {
  // Aces are wild and can be played on anything, UNLESS under forced draw
  if (cardToPlay.rank === "A" && !hasForcedDraw) {
    return true;
  }

  // Normal matching: same suit OR same rank
  return cardToPlay.suit === targetSuit || cardToPlay.rank === targetRank;
}

/**
 * Check if all cards in a set have the same rank
 */
function allSameRank(cards: Card[]): boolean {
  if (cards.length === 0) return true;
  const rank = cards[0].rank;
  return cards.every((c) => c.rank === rank);
}

/**
 * Get all legal plays for the current player
 */
export function getLegalPlays(state: GameState, playerId: number): LegalPlay[] {
  const player = state.players[playerId];
  if (!player) return [];

  const targetSuit = getTargetSuit(state);
  const targetRank = getTargetRank(state);
  const hasForcedDraw = state.pendingEffects.forcedDrawCount > 0;
  const hand = player.hand;

  const legalPlays: LegalPlay[] = [];

  // If forced to draw, no plays are legal
  if (hasForcedDraw || player.lastCardPenalty) {
    return [];
  }

  // Going out constraint: final play must be a single card
  const wouldGoOut = (cardCount: number) => hand.length - cardCount === 0;

  // Generate all possible single card plays
  for (const card of hand) {
    if (canCardBePlayed(card, targetSuit, targetRank, hasForcedDraw)) {
      if (!wouldGoOut(1) || hand.length === 1) {
        const play: Play = { cards: [card] };
        if (card.rank === "A") {
          // For Aces, generate all 4 suit choices
          for (const suit of ["hearts", "diamonds", "clubs", "spades"] as Suit[]) {
            legalPlays.push({
              play: { ...play, chosenSuit: suit },
              description: `Play ${cardToString(card)} and choose ${suit}`,
            });
          }
        } else {
          legalPlays.push({
            play,
            description: `Play ${cardToString(card)}`,
          });
        }
      }
    }
  }

  // Generate multi-card plays (same rank combinations)
  // Group cards by rank
  const byRank = new Map<Rank, Card[]>();
  for (const card of hand) {
    const group = byRank.get(card.rank) || [];
    group.push(card);
    byRank.set(card.rank, group);
  }

  // For each rank with multiple cards, generate all valid orderings
  for (const [, cards] of byRank) {
    if (cards.length < 2) continue;

    // Generate all permutations for sets of 2, 3, or 4 cards of the same rank
    for (let size = 2; size <= Math.min(cards.length, 4); size++) {
      // Skip if this would let us go out (final play must be single card)
      if (wouldGoOut(size)) continue;

      // Generate all combinations of 'size' cards from this rank group
      const combinations = getCombinations(cards, size);

      for (const combo of combinations) {
        // Generate all permutations of this combination
        const permutations = getPermutations(combo);

        for (const perm of permutations) {
          // The first card must match the target (either by suit or by rank)
          const first = perm[0];
          const firstMatchesSuit = first.suit === targetSuit;
          const firstMatchesRank = first.rank === targetRank;

          if (!firstMatchesSuit && !firstMatchesRank) continue;

          // All same-rank cards, so sequence is always valid
          // Add as a legal play
          const lastCard = perm[perm.length - 1];
          if (lastCard.rank === "A") {
            for (const suit of ["hearts", "diamonds", "clubs", "spades"] as Suit[]) {
              legalPlays.push({
                play: { cards: perm, chosenSuit: suit },
                description: `Play ${perm.map(cardToString).join(", ")} and choose ${suit}`,
              });
            }
          } else {
            legalPlays.push({
              play: { cards: perm },
              description: `Play ${perm.map(cardToString).join(", ")}`,
            });
          }
        }
      }
    }
  }

  // Generate mixed-rank multi-card plays (suit runs)
  // These are sequences where suit stays the same
  const bySuit = new Map<Suit, Card[]>();
  for (const card of hand) {
    const group = bySuit.get(card.suit) || [];
    group.push(card);
    bySuit.set(card.suit, group);
  }

  for (const [, cards] of bySuit) {
    if (cards.length < 2) continue;

    // We can play multiple cards of the same suit if:
    // 1. First card matches target (suit or rank)
    // 2. All subsequent cards can follow (same suit, so always valid)
    const firstCanStart = cards.some(
      (c) => c.suit === targetSuit || c.rank === targetRank || c.rank === "A"
    );
    if (!firstCanStart) continue;

    // Generate combinations of 2+ cards from this suit
    for (let size = 2; size <= Math.min(cards.length, 4); size++) {
      if (wouldGoOut(size)) continue;

      const combinations = getCombinations(cards, size);

      for (const combo of combinations) {
        // For same-suit plays, we need the first card to match the target
        // Generate permutations and filter
        const permutations = getPermutations(combo);

        for (const perm of permutations) {
          const first = perm[0];
          const firstMatchesSuit = first.suit === targetSuit;
          const firstMatchesRank = first.rank === targetRank;
          const firstIsAce = first.rank === "A";

          if (!firstMatchesSuit && !firstMatchesRank && !firstIsAce) continue;

          // All same suit, so always a valid sequence
          // Skip if duplicates already handled by same-rank logic
          if (allSameRank(perm)) continue;

          const lastCard = perm[perm.length - 1];
          if (lastCard.rank === "A") {
            for (const chosenSuit of ["hearts", "diamonds", "clubs", "spades"] as Suit[]) {
              legalPlays.push({
                play: { cards: perm, chosenSuit },
                description: `Play ${perm.map(cardToString).join(", ")} and choose ${chosenSuit}`,
              });
            }
          } else {
            legalPlays.push({
              play: { cards: perm },
              description: `Play ${perm.map(cardToString).join(", ")}`,
            });
          }
        }
      }
    }
  }

  // Deduplicate plays (same cards in same order)
  const seen = new Set<string>();
  return legalPlays.filter((lp) => {
    const key =
      lp.play.cards.map((c) => `${c.rank}${c.suit}`).join(",") + (lp.play.chosenSuit || "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Get all combinations of k elements from an array
 */
function getCombinations<T>(array: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > array.length) return [];

  const result: T[][] = [];

  function recurse(start: number, current: T[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < array.length; i++) {
      current.push(array[i]);
      recurse(i + 1, current);
      current.pop();
    }
  }

  recurse(0, []);
  return result;
}

/**
 * Get all permutations of an array
 */
function getPermutations<T>(array: T[]): T[][] {
  if (array.length <= 1) return [array];

  const result: T[][] = [];

  function permute(arr: T[], start: number) {
    if (start === arr.length - 1) {
      result.push([...arr]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      [arr[start], arr[i]] = [arr[i], arr[start]];
      permute(arr, start + 1);
      [arr[start], arr[i]] = [arr[i], arr[start]];
    }
  }

  permute([...array], 0);
  return result;
}

/**
 * Check if a specific play is legal
 */
export function isPlayLegal(state: GameState, playerId: number, play: Play): boolean {
  const legalPlays = getLegalPlays(state, playerId);
  return legalPlays.some(
    (lp) =>
      lp.play.cards.length === play.cards.length &&
      lp.play.cards.every((c, i) => cardEquals(c, play.cards[i])) &&
      lp.play.chosenSuit === play.chosenSuit
  );
}

/**
 * Apply a play to the game state
 */
export function applyPlay(state: GameState, play: Play): GameState {
  const playerId = state.currentPlayerIndex;
  const player = state.players[playerId];

  // Remove played cards from hand
  const newHand = [...player.hand];
  for (const card of play.cards) {
    const idx = newHand.findIndex((c) => cardEquals(c, card));
    if (idx !== -1) {
      newHand.splice(idx, 1);
    }
  }

  // Add cards to discard pile
  const newDiscardPile = [...state.discardPile, ...play.cards];

  // Calculate new pending effects from played cards
  let newForcedDraw = 0;
  let newSkip = false;

  for (const card of play.cards) {
    switch (card.rank) {
      case "2":
        newForcedDraw += 2;
        break;
      case "5":
        newForcedDraw += 5;
        break;
      case "10":
        newSkip = true;
        break;
    }
  }

  // Determine if this play has special effects (for last card declaration restriction)
  const hasSpecialEffect = newForcedDraw > 0 || newSkip;

  // Update player state
  const newPlayers = state.players.map((p, i) =>
    i === playerId
      ? {
          ...p,
          hand: newHand,
          // Reset last card penalty since they played
          lastCardPenalty: false,
        }
      : p
  );

  // Check for win
  const winner = newHand.length === 0 ? playerId : null;

  // Determine chosen suit for Ace plays
  const lastCard = play.cards[play.cards.length - 1];
  const newChosenSuit = lastCard.rank === "A" ? (play.chosenSuit ?? null) : null;

  return {
    ...state,
    players: newPlayers,
    discardPile: newDiscardPile,
    chosenSuit: newChosenSuit,
    pendingEffects: {
      forcedDrawCount: newForcedDraw,
      skipNextPlayer: newSkip,
    },
    turnPhase: winner !== null ? "game-over" : "can-end",
    winner,
    lastPlayWasSpecial: hasSpecialEffect,
  };
}

/**
 * Draw cards from the draw pile, recycling discard pile if needed
 */
export function applyDraw(state: GameState, count: number): GameState {
  const playerId = state.currentPlayerIndex;
  let drawPile = [...state.drawPile];
  let discardPile = [...state.discardPile];
  const drawnCards: Card[] = [];

  for (let i = 0; i < count; i++) {
    // Check if we need to recycle the discard pile
    if (drawPile.length === 0) {
      if (discardPile.length <= 1) {
        // No cards to draw - discard only has top card or is empty
        // Log this edge case (in a real app, this would trigger a UI notification)
        break;
      }

      // Keep the top card, shuffle the rest into draw pile
      const topCard = discardPile[discardPile.length - 1];
      const toShuffle = discardPile.slice(0, -1);

      // Shuffle using Fisher-Yates
      for (let j = toShuffle.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [toShuffle[j], toShuffle[k]] = [toShuffle[k], toShuffle[j]];
      }

      drawPile = toShuffle;
      discardPile = [topCard];
    }

    // Draw a card
    const card = drawPile.pop();
    if (card) {
      drawnCards.push(card);
    }
  }

  // Add drawn cards to player's hand
  const newPlayers = state.players.map((p, i) =>
    i === playerId
      ? {
          ...p,
          hand: [...p.hand, ...drawnCards],
          lastCardPenalty: false, // Clear penalty after drawing
        }
      : p
  );

  return {
    ...state,
    players: newPlayers,
    drawPile,
    discardPile,
    pendingEffects: {
      ...state.pendingEffects,
      forcedDrawCount: 0, // Clear forced draw after drawing
    },
    turnPhase: "can-end",
  };
}

/**
 * Apply a voluntary single draw (when player chooses to draw instead of play)
 */
export function applyVoluntaryDraw(state: GameState): GameState {
  return applyDraw(state, 1);
}

/**
 * Apply forced draw (from 2s/5s or last card penalty)
 */
export function applyForcedDraw(state: GameState): GameState {
  const player = state.players[state.currentPlayerIndex];
  const count = player.lastCardPenalty ? 1 : state.pendingEffects.forcedDrawCount;
  return applyDraw(state, count);
}

/**
 * Advance to the next player's turn
 */
export function nextTurn(state: GameState): GameState {
  if (state.winner !== null) {
    return state;
  }

  const playerCount = state.players.length;
  let nextIndex = (state.currentPlayerIndex + 1) % playerCount;

  // Apply skip if pending
  if (state.pendingEffects.skipNextPlayer) {
    nextIndex = (nextIndex + 1) % playerCount;
  }

  // Check if the current player needs a last card penalty
  // (had 2 cards before their play, now has 1, didn't declare)
  const currentPlayer = state.players[state.currentPlayerIndex];
  const needsLastCardPenalty =
    currentPlayer.hand.length === 1 &&
    !currentPlayer.declaredLastCard &&
    !state.lastPlayWasSpecial;

  // Update players with any new penalties
  const newPlayers = state.players.map((p, i) => {
    if (i === state.currentPlayerIndex && needsLastCardPenalty) {
      return { ...p, lastCardPenalty: true };
    }
    // Reset declaredLastCard for next turn
    if (i === state.currentPlayerIndex) {
      return { ...p, declaredLastCard: false };
    }
    return p;
  });

  // Determine turn phase for next player
  const nextPlayer = newPlayers[nextIndex];
  let turnPhase: TurnPhase = "waiting";

  // If next player has forced draw or penalty, they must draw
  if (state.pendingEffects.forcedDrawCount > 0 || nextPlayer.lastCardPenalty) {
    turnPhase = "must-draw";
  }

  return {
    ...state,
    players: newPlayers,
    currentPlayerIndex: nextIndex,
    pendingEffects: {
      forcedDrawCount: state.pendingEffects.forcedDrawCount, // Preserve until they draw
      skipNextPlayer: false, // Skip is consumed
    },
    turnPhase,
    lastPlayWasSpecial: false,
  };
}

/**
 * Confirm handoff and start the player's turn
 */
export function confirmHandoff(state: GameState): GameState {
  const player = state.players[state.currentPlayerIndex];

  // Determine the correct turn phase
  let turnPhase: TurnPhase;

  if (state.pendingEffects.forcedDrawCount > 0 || player.lastCardPenalty) {
    turnPhase = "must-draw";
  } else {
    turnPhase = "playing";
  }

  return {
    ...state,
    turnPhase,
  };
}

/**
 * Declare "Last Card" - must be called when player will have 1 card remaining
 */
export function declareLastCard(state: GameState): GameState {
  const playerId = state.currentPlayerIndex;

  return {
    ...state,
    players: state.players.map((p, i) =>
      i === playerId ? { ...p, declaredLastCard: true } : p
    ),
  };
}

/**
 * Check if the current player can declare "Last Card"
 * - They must be about to play cards that will leave them with exactly 1 card
 * - The play must not be a special effect play (2, 5, 10)
 * - They haven't already declared this turn
 */
export function canDeclareLastCard(
  state: GameState,
  selectedCards: Card[]
): boolean {
  const player = state.players[state.currentPlayerIndex];

  // Must have exactly 2 cards (will have 1 after playing 1)
  // Or more cards with a multi-card play that leaves 1
  if (player.hand.length - selectedCards.length !== 1) {
    return false;
  }

  // Haven't already declared
  if (player.declaredLastCard) {
    return false;
  }

  // Check if any selected card is a special effect card (2, 5, 10)
  const hasSpecialCard = selectedCards.some(
    (c) => c.rank === "2" || c.rank === "5" || c.rank === "10"
  );
  if (hasSpecialCard) {
    return false;
  }

  return true;
}

/**
 * Check if the current player must declare last card before ending turn
 */
export function mustDeclareLastCard(state: GameState): boolean {
  const player = state.players[state.currentPlayerIndex];
  return (
    player.hand.length === 1 &&
    !player.declaredLastCard &&
    !state.lastPlayWasSpecial &&
    state.turnPhase === "can-end"
  );
}

/**
 * Get the number of cards that can be drawn (accounting for draw pile exhaustion)
 */
export function getDrawableCount(state: GameState): number {
  const totalAvailable =
    state.drawPile.length + Math.max(0, state.discardPile.length - 1);
  return totalAvailable;
}

/**
 * Check if the game is in a drawable state
 */
export function canDraw(state: GameState): boolean {
  if (state.turnPhase === "game-over") return false;
  if (state.turnPhase === "can-end") return false; // Already took action
  if (state.turnPhase === "declaring-suit") return false;
  return getDrawableCount(state) > 0 || state.pendingEffects.forcedDrawCount > 0;
}

/**
 * Utility to get the current game status message
 */
export function getStatusMessage(state: GameState): string {
  if (state.winner !== null) {
    return `Player ${state.winner + 1} wins!`;
  }

  const player = state.players[state.currentPlayerIndex];
  const playerName = `Player ${state.currentPlayerIndex + 1}`;

  if (state.turnPhase === "waiting") {
    return `Pass to ${playerName}`;
  }

  if (state.turnPhase === "must-draw") {
    if (player.lastCardPenalty) {
      return `${playerName} must draw 1 (missed Last Card declaration)`;
    }
    return `${playerName} must draw ${state.pendingEffects.forcedDrawCount}`;
  }

  if (state.turnPhase === "declaring-suit") {
    return `${playerName}: Choose a suit`;
  }

  if (state.turnPhase === "can-end") {
    return `${playerName}: End your turn`;
  }

  return `${playerName}'s turn`;
}
