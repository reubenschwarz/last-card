/**
 * Last Card Rules Engine
 * Pure functions for game state transitions - no UI dependencies
 */

import { createShuffledDeck } from "./deck";
import {
  AceResponse,
  Card,
  cardEquals,
  cardToString,
  GameState,
  JackResponse,
  LastCardClaim,
  LegalPlay,
  PendingEffects,
  Play,
  PlayDirection,
  PlayerState,
  PlayerType,
  Rank,
  SevenDispute,
  SpecialRank,
  Suit,
  TurnPhase,
} from "./types";

const INITIAL_HAND_SIZE = 7;

/**
 * Get the next player index respecting the current direction of play
 */
export function getNextPlayerIndex(state: GameState, fromIndex: number): number {
  const playerCount = state.players.length;
  if (state.direction === "CCW") {
    return (fromIndex - 1 + playerCount) % playerCount;
  }
  return (fromIndex + 1) % playerCount;
}

/**
 * Initialize a new game with the specified number of players
 * @param playerCount Number of players (2-4)
 * @param rng Optional seeded RNG for deterministic tests
 * @param playerTypes Optional array of player types; defaults to all "human"
 */
export function initializeGame(
  playerCount: number,
  rng?: () => number,
  playerTypes?: PlayerType[]
): GameState {
  if (playerCount < 2 || playerCount > 4) {
    throw new Error("Player count must be between 2 and 4");
  }

  // Default all players to human if not specified
  const types = playerTypes ?? Array(playerCount).fill("human" as PlayerType);
  if (types.length !== playerCount) {
    throw new Error("playerTypes array length must match playerCount");
  }

  const deck = createShuffledDeck(rng);

  // Deal cards to players
  const players: PlayerState[] = [];
  for (let i = 0; i < playerCount; i++) {
    players.push({
      id: i,
      hand: deck.splice(0, INITIAL_HAND_SIZE),
      playerType: types[i],
      declaredLastCard: false,
      lastCardPenalty: false,
    });
  }

  // Set up draw pile and flip first card to discard pile
  const firstCard = deck.pop()!;
  const drawPile = deck;
  const discardPile = [firstCard];

  // First card has NO special effects - player plays normally
  // (no forced draw from 2/5, no skip from 10, ace uses its own suit)
  const pendingEffects: PendingEffects = {
    forcedDrawCount: 0,
    skipNextPlayer: false,
  };

  return {
    players,
    currentPlayerIndex: 0,
    drawPile,
    discardPile,
    chosenSuit: null, // No suit override initially - ace uses its own suit
    pendingEffects,
    turnPhase: "waiting", // Start in waiting phase for hotseat
    winner: null,
    lastPlayWasSpecial: false, // First card doesn't count as special play
    // Direction of play (starts clockwise)
    direction: "CW" as PlayDirection,
    // Right of Reply state
    responsePhase: null,
    responseChainRank: null,
    respondingPlayerIndex: null,
    // Seven Dispute state
    sevenDispute: null,
    lastCardClaim: null,
    turnNumber: 0,
    // Jack and Ace response windows
    jackResponse: null,
    aceResponse: null,
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
 * Check if a single card can be legally played on another
 * This checks the fundamental rule: suit must match OR rank must match
 * Note: Aces are NOT wild - they follow the same rules as other cards,
 * except Ace-on-Ace is always allowed regardless of suit.
 */
function canCardBePlayed(
  cardToPlay: Card,
  targetSuit: Suit,
  targetRank: Rank,
  _hasForcedDraw: boolean
): boolean {
  // Ace-on-Ace is always legal (regardless of suit)
  if (cardToPlay.rank === "A" && targetRank === "A") {
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

  // Check if activation is enabled (default true)
  const shouldActivate = play.activateEffect !== false;

  // Calculate new pending effects from played cards (only if activated)
  let newForcedDraw = 0;
  let newSkip = false;
  let responseChainRank: SpecialRank | null = null;

  if (shouldActivate) {
    for (const card of play.cards) {
      switch (card.rank) {
        case "2":
          newForcedDraw += 2;
          responseChainRank = "2";
          break;
        case "5":
          newForcedDraw += 5;
          responseChainRank = "5";
          break;
        case "10":
          newSkip = true;
          responseChainRank = "10";
          break;
      }
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

  // Determine if we enter response phase (for 2/5/10 effects)
  const nextPlayerIndex = getNextPlayerIndex(state, playerId);
  const shouldEnterResponsePhase = hasSpecialEffect && winner === null;

  if (shouldEnterResponsePhase) {
    // Enter response phase - next player can respond
    return {
      ...state,
      players: newPlayers,
      discardPile: newDiscardPile,
      chosenSuit: newChosenSuit,
      pendingEffects: {
        forcedDrawCount: newForcedDraw,
        skipNextPlayer: newSkip,
      },
      turnPhase: "can-end", // Original player's turn ends
      winner,
      lastPlayWasSpecial: hasSpecialEffect,
      responsePhase: "responding",
      responseChainRank,
      respondingPlayerIndex: nextPlayerIndex,
      // Preserve seven dispute state
      sevenDispute: state.sevenDispute,
      lastCardClaim: state.lastCardClaim,
      turnNumber: state.turnNumber,
      // Preserve Jack/Ace response windows
      jackResponse: state.jackResponse,
      aceResponse: state.aceResponse,
    };
  }

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
    responsePhase: null,
    responseChainRank: null,
    respondingPlayerIndex: null,
    // Preserve seven dispute state
    sevenDispute: state.sevenDispute,
    lastCardClaim: state.lastCardClaim,
    turnNumber: state.turnNumber,
    // Preserve Jack/Ace response windows
    jackResponse: state.jackResponse,
    aceResponse: state.aceResponse,
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
    // Preserve seven dispute state
    sevenDispute: state.sevenDispute,
    lastCardClaim: state.lastCardClaim,
    turnNumber: state.turnNumber,
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

  let nextIndex = getNextPlayerIndex(state, state.currentPlayerIndex);

  // Apply skip if pending
  if (state.pendingEffects.skipNextPlayer) {
    nextIndex = getNextPlayerIndex(state, nextIndex);
  }

  // Increment turn number
  const newTurnNumber = state.turnNumber + 1;

  // Check if lastCardClaim has expired (only valid for one turn after creation)
  let newLastCardClaim = state.lastCardClaim;
  if (newLastCardClaim && newTurnNumber > newLastCardClaim.turnNumberCreated + 1) {
    newLastCardClaim = null;
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
    // Direction is preserved (not cleared)
    // Clear response phase when advancing turn
    responsePhase: null,
    responseChainRank: null,
    respondingPlayerIndex: null,
    // Seven dispute state
    sevenDispute: null, // Clear any dispute when turn ends
    lastCardClaim: newLastCardClaim,
    turnNumber: newTurnNumber,
    // Clear Jack and Ace response windows when turn ends
    jackResponse: null,
    aceResponse: null,
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
    // Create a lastCardClaim so opponent can challenge with a 7
    lastCardClaim: {
      playerId,
      turnNumberCreated: state.turnNumber,
    },
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

  if (state.responsePhase === "responding" && state.respondingPlayerIndex !== null) {
    const responderName = `Player ${state.respondingPlayerIndex + 1}`;
    if (state.responseChainRank === "10") {
      return `${responderName}: Respond to skip or resolve`;
    }
    return `${responderName}: Respond to +${state.pendingEffects.forcedDrawCount} or resolve`;
  }

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

// ============================================
// Right of Reply - Response Phase Functions
// ============================================

/**
 * Check if we're in a response phase
 */
export function isInResponsePhase(state: GameState): boolean {
  return state.responsePhase === "responding" && state.respondingPlayerIndex !== null;
}

/**
 * Get the player who must respond (or null if not in response phase)
 */
export function getRespondingPlayer(state: GameState): PlayerState | null {
  if (!isInResponsePhase(state) || state.respondingPlayerIndex === null) {
    return null;
  }
  return state.players[state.respondingPlayerIndex];
}

/**
 * Get legal deflection cards for the responding player
 * For 2/5 chains: can deflect with same rank
 * For 10 chains: can deflect with another 10
 */
export function getLegalDeflections(state: GameState): Card[] {
  if (!isInResponsePhase(state) || state.respondingPlayerIndex === null) {
    return [];
  }

  const responder = state.players[state.respondingPlayerIndex];
  const chainRank = state.responseChainRank;

  if (!chainRank) return [];

  // Can only deflect with the same rank as the chain
  return responder.hand.filter((card) => card.rank === chainRank);
}

/**
 * Check if a cancel is possible
 * Only the same rank can cancel: 2 cancels 2, 5 cancels 5, 10 cancels 10
 * This is effectively the same as deflection now.
 */
export function canCancel(state: GameState): boolean {
  // Cancel is now the same as deflect - same rank only
  return getLegalDeflections(state).length > 0;
}

/**
 * Get legal cancel cards (same rank as the chain)
 * Only same rank can cancel: 2 cancels 2, 5 cancels 5, 10 cancels 10
 */
export function getLegalCancels(state: GameState): Card[] {
  // Cancel cards are the same as deflection cards - same rank only
  return getLegalDeflections(state);
}

/**
 * Apply "Resolve" - accept the pending effects
 * The responding player accepts the draw/skip and becomes the current player
 */
export function applyResolve(state: GameState): GameState {
  if (!isInResponsePhase(state) || state.respondingPlayerIndex === null) {
    return state;
  }

  const respondingIndex = state.respondingPlayerIndex;

  // End response phase and make the responding player the current player
  // They will face the pending effects
  return {
    ...state,
    currentPlayerIndex: respondingIndex,
    turnPhase: state.pendingEffects.forcedDrawCount > 0 ? "must-draw" : "waiting",
    responsePhase: null,
    responseChainRank: null,
    respondingPlayerIndex: null,
    // Skip is consumed when resolving a 10 response
    pendingEffects: {
      ...state.pendingEffects,
      skipNextPlayer: false,
    },
  };
}

/**
 * Apply "Deflect" - play a matching card to pass the effect to the next player
 * For 2s/5s: adds to the draw count
 * For 10s: passes the skip to the next player
 */
export function applyDeflect(state: GameState, card: Card): GameState {
  if (!isInResponsePhase(state) || state.respondingPlayerIndex === null) {
    return state;
  }

  const respondingIndex = state.respondingPlayerIndex;
  const responder = state.players[respondingIndex];
  const chainRank = state.responseChainRank;

  // Verify the card is a legal deflection
  if (card.rank !== chainRank) {
    return state;
  }

  // Remove the card from responder's hand
  const newHand = responder.hand.filter((c) => !cardEquals(c, card));

  // Add card to discard pile
  const newDiscardPile = [...state.discardPile, card];

  // Update pending effects
  let newForcedDraw = state.pendingEffects.forcedDrawCount;
  if (card.rank === "2") {
    newForcedDraw += 2;
  } else if (card.rank === "5") {
    newForcedDraw += 5;
  }

  // Update players
  const newPlayers = state.players.map((p, i) =>
    i === respondingIndex ? { ...p, hand: newHand } : p
  );

  // Check for win (if responder played their last card)
  const winner = newHand.length === 0 ? respondingIndex : null;

  if (winner !== null) {
    return {
      ...state,
      players: newPlayers,
      discardPile: newDiscardPile,
      pendingEffects: {
        forcedDrawCount: newForcedDraw,
        skipNextPlayer: chainRank === "10",
      },
      winner,
      turnPhase: "game-over",
      responsePhase: null,
      responseChainRank: null,
      respondingPlayerIndex: null,
    };
  }

  // Calculate next responding player (respects direction)
  const nextRespondingIndex = getNextPlayerIndex(state, respondingIndex);

  return {
    ...state,
    players: newPlayers,
    discardPile: newDiscardPile,
    pendingEffects: {
      forcedDrawCount: newForcedDraw,
      skipNextPlayer: chainRank === "10",
    },
    // Continue response phase with next player
    responsePhase: "responding",
    responseChainRank: chainRank,
    respondingPlayerIndex: nextRespondingIndex,
  };
}

/**
 * Apply "Cancel" - play a card of the same rank to cancel/deflect
 * Only same rank can cancel: 2 cancels 2, 5 cancels 5, 10 cancels 10
 * This is now effectively the same as deflect.
 */
export function applyCancel(state: GameState, card: Card): GameState {
  // Cancel is now the same as deflect - delegate to applyDeflect
  return applyDeflect(state, card);
}

// ============================================
// Seven Dispute - 7-Cancel Mechanic Functions
// ============================================

/**
 * Check if we're in an active seven dispute
 */
export function isInSevenDispute(state: GameState): boolean {
  return state.sevenDispute !== null;
}

/**
 * Get the effective suit for 7-cancel matching
 * (matches chosenSuit if Ace was played, otherwise top card's suit)
 */
function getEffectiveSuitForSevenCancel(state: GameState): Suit {
  return state.chosenSuit ?? getTopCard(state).suit;
}

/**
 * Check if a player can initiate a 7-cancel (Type A: cancel pending effect)
 * Only available during response phase when there's a pending effect
 */
export function canPlaySevenCancelEffect(state: GameState, playerId: number): boolean {
  // Must be in response phase
  if (!isInResponsePhase(state)) return false;
  // Must be the responding player
  if (state.respondingPlayerIndex !== playerId) return false;
  // Must have a pending effect to cancel
  if (state.pendingEffects.forcedDrawCount === 0 && !state.pendingEffects.skipNextPlayer) {
    return false;
  }
  // Check if player has a 7 matching the effective suit
  const effectiveSuit = getEffectiveSuitForSevenCancel(state);
  const player = state.players[playerId];
  return player.hand.some((c) => c.rank === "7" && c.suit === effectiveSuit);
}

/**
 * Check if a player can initiate a 7-cancel (Type B: cancel Last Card claim)
 * Only available on opponent's turn immediately after the claim was made
 */
export function canPlaySevenCancelLastCard(state: GameState, playerId: number): boolean {
  // Must have an active lastCardClaim
  if (!state.lastCardClaim) return false;
  // Must be on the turn immediately after the claim (turnNumber == claim.turnNumberCreated + 1)
  if (state.turnNumber !== state.lastCardClaim.turnNumberCreated + 1) return false;
  // Must be the current player (opponent of the claimer)
  if (state.currentPlayerIndex !== playerId) return false;
  // Must not be the claimer themselves
  if (state.lastCardClaim.playerId === playerId) return false;
  // Check if player has a 7 matching the effective suit
  const effectiveSuit = getEffectiveSuitForSevenCancel(state);
  const player = state.players[playerId];
  return player.hand.some((c) => c.rank === "7" && c.suit === effectiveSuit);
}

/**
 * Get legal 7 cards for canceling a pending effect (Type A)
 */
export function getLegalSevenCancelsEffect(state: GameState, playerId: number): Card[] {
  if (!canPlaySevenCancelEffect(state, playerId)) return [];
  const effectiveSuit = getEffectiveSuitForSevenCancel(state);
  const player = state.players[playerId];
  return player.hand.filter((c) => c.rank === "7" && c.suit === effectiveSuit);
}

/**
 * Get legal 7 cards for canceling a Last Card claim (Type B)
 */
export function getLegalSevenCancelsLastCard(state: GameState, playerId: number): Card[] {
  if (!canPlaySevenCancelLastCard(state, playerId)) return [];
  const effectiveSuit = getEffectiveSuitForSevenCancel(state);
  const player = state.players[playerId];
  return player.hand.filter((c) => c.rank === "7" && c.suit === effectiveSuit);
}

/**
 * Apply a 7 to cancel a pending effect (Type A)
 * Opens a Seven Dispute where opponent can counter-cancel
 */
export function applySevenCancelEffect(state: GameState, card: Card): GameState {
  if (!isInResponsePhase(state) || state.respondingPlayerIndex === null) {
    return state;
  }

  const respondingIndex = state.respondingPlayerIndex;
  const responder = state.players[respondingIndex];

  // Verify the card is a 7 matching the effective suit
  const effectiveSuit = getEffectiveSuitForSevenCancel(state);
  if (card.rank !== "7" || card.suit !== effectiveSuit) {
    return state;
  }

  // Remove the 7 from responder's hand
  const newHand = responder.hand.filter((c) => !cardEquals(c, card));

  // Add card to discard pile
  const newDiscardPile = [...state.discardPile, card];

  // Update players
  const newPlayers = state.players.map((p, i) =>
    i === respondingIndex ? { ...p, hand: newHand } : p
  );

  // Check for immediate win (if responder played their last card)
  const winner = newHand.length === 0 ? respondingIndex : null;

  if (winner !== null) {
    return {
      ...state,
      players: newPlayers,
      discardPile: newDiscardPile,
      winner,
      turnPhase: "game-over",
      responsePhase: null,
      responseChainRank: null,
      respondingPlayerIndex: null,
      sevenDispute: null,
      chosenSuit: null, // Clear suit override after 7
    };
  }

  // Identify the original attacker (who must resolve if not cancelled)
  // In 2-player, this is the other player; in N-player, it's the next in direction
  const attackerIndex = getNextPlayerIndex(state, respondingIndex);

  // Create Seven Dispute state
  const sevenDispute: SevenDispute = {
    kind: "EFFECT",
    effectSnapshot: {
      drawAmount: state.pendingEffects.forcedDrawCount,
      skip: state.pendingEffects.skipNextPlayer,
      responsiblePlayerId: attackerIndex, // Original attacker resolves if cancelled
    },
    cancelled: true, // First 7 cancels the effect
    responderPlayerId: attackerIndex, // Other player can counter
  };

  return {
    ...state,
    players: newPlayers,
    discardPile: newDiscardPile,
    chosenSuit: null, // Clear suit override after 7
    // Keep pending effects snapshot'd but paused during dispute
    pendingEffects: state.pendingEffects,
    turnPhase: "playing", // Keep active during dispute
    responsePhase: null, // Exit normal response phase
    responseChainRank: null,
    respondingPlayerIndex: null,
    sevenDispute,
  };
}

/**
 * Apply a 7 to cancel a Last Card claim (Type B)
 * Opens a Seven Dispute where the claimer can counter
 */
export function applySevenCancelLastCard(state: GameState, card: Card): GameState {
  if (!state.lastCardClaim) return state;

  const playerId = state.currentPlayerIndex;
  const player = state.players[playerId];

  // Verify the card is a 7 matching the effective suit
  const effectiveSuit = getEffectiveSuitForSevenCancel(state);
  if (card.rank !== "7" || card.suit !== effectiveSuit) {
    return state;
  }

  // Remove the 7 from player's hand
  const newHand = player.hand.filter((c) => !cardEquals(c, card));

  // Add card to discard pile
  const newDiscardPile = [...state.discardPile, card];

  // Update players
  const newPlayers = state.players.map((p, i) =>
    i === playerId ? { ...p, hand: newHand } : p
  );

  // Check for immediate win
  const winner = newHand.length === 0 ? playerId : null;

  if (winner !== null) {
    return {
      ...state,
      players: newPlayers,
      discardPile: newDiscardPile,
      winner,
      turnPhase: "game-over",
      sevenDispute: null,
      lastCardClaim: null,
      chosenSuit: null,
    };
  }

  // Create Seven Dispute state
  const sevenDispute: SevenDispute = {
    kind: "LAST_CARD",
    lastCardClaimPlayerId: state.lastCardClaim.playerId,
    cancelled: true, // First 7 cancels the claim
    responderPlayerId: state.lastCardClaim.playerId, // Claimer can counter
  };

  return {
    ...state,
    players: newPlayers,
    discardPile: newDiscardPile,
    chosenSuit: null, // Clear suit override after 7
    turnPhase: "playing",
    sevenDispute,
    // Keep lastCardClaim until dispute resolves
  };
}

/**
 * Get legal 7 cards during an active Seven Dispute (any 7 is valid)
 */
export function getLegalSevenDisputePlays(state: GameState, playerId: number): Card[] {
  if (!state.sevenDispute) return [];
  if (state.sevenDispute.responderPlayerId !== playerId) return [];

  const player = state.players[playerId];
  return player.hand.filter((c) => c.rank === "7");
}

/**
 * Check if a player can play a 7 during a Seven Dispute
 */
export function canPlaySevenDispute(state: GameState, playerId: number): boolean {
  return getLegalSevenDisputePlays(state, playerId).length > 0;
}

/**
 * Apply playing a 7 during an active Seven Dispute (toggles cancelled)
 */
export function applySevenDisputePlay(state: GameState, card: Card): GameState {
  if (!state.sevenDispute) return state;

  const responderId = state.sevenDispute.responderPlayerId;
  const responder = state.players[responderId];

  // Verify the card is a 7 (any suit - during dispute, suit doesn't need to match)
  if (card.rank !== "7") {
    return state;
  }

  // Remove the 7 from responder's hand
  const newHand = responder.hand.filter((c) => !cardEquals(c, card));

  // Add card to discard pile
  const newDiscardPile = [...state.discardPile, card];

  // Update players
  const newPlayers = state.players.map((p, i) =>
    i === responderId ? { ...p, hand: newHand } : p
  );

  // Check for immediate win
  const winner = newHand.length === 0 ? responderId : null;

  if (winner !== null) {
    return {
      ...state,
      players: newPlayers,
      discardPile: newDiscardPile,
      winner,
      turnPhase: "game-over",
      sevenDispute: null,
      lastCardClaim: null,
      chosenSuit: null,
    };
  }

  // Toggle cancelled and switch responder (respects direction)
  const nextResponderId = getNextPlayerIndex(state, responderId);

  return {
    ...state,
    players: newPlayers,
    discardPile: newDiscardPile,
    chosenSuit: null,
    sevenDispute: {
      ...state.sevenDispute,
      cancelled: !state.sevenDispute.cancelled,
      responderPlayerId: nextResponderId,
    },
  };
}

/**
 * Accept the current outcome of a Seven Dispute
 */
export function applySevenDisputeAccept(state: GameState): GameState {
  if (!state.sevenDispute) return state;

  const dispute = state.sevenDispute;

  if (dispute.kind === "EFFECT") {
    if (dispute.cancelled) {
      // Effect was cancelled - original attacker's turn continues normally
      // Clear pending effects
      return {
        ...state,
        pendingEffects: {
          forcedDrawCount: 0,
          skipNextPlayer: false,
        },
        turnPhase: "can-end",
        sevenDispute: null,
      };
    } else {
      // Effect NOT cancelled - responder must face the original effect
      // The responsible player (original attacker who played 2/5/10) is not affected
      // The current responder must take the effect
      const responderId = dispute.responderPlayerId;
      return {
        ...state,
        currentPlayerIndex: responderId,
        pendingEffects: dispute.effectSnapshot
          ? {
              forcedDrawCount: dispute.effectSnapshot.drawAmount,
              skipNextPlayer: dispute.effectSnapshot.skip,
            }
          : state.pendingEffects,
        turnPhase: state.pendingEffects.forcedDrawCount > 0 ? "must-draw" : "waiting",
        sevenDispute: null,
      };
    }
  } else if (dispute.kind === "LAST_CARD") {
    if (dispute.cancelled) {
      // Last Card claim was cancelled - player loses their protection
      const claimerId = dispute.lastCardClaimPlayerId!;
      const newPlayers = state.players.map((p, i) =>
        i === claimerId ? { ...p, declaredLastCard: false } : p
      );
      return {
        ...state,
        players: newPlayers,
        sevenDispute: null,
        lastCardClaim: null,
        turnPhase: "playing", // Continue current player's turn
      };
    } else {
      // Last Card claim NOT cancelled - claim remains valid
      return {
        ...state,
        sevenDispute: null,
        turnPhase: "playing", // Continue current player's turn
      };
    }
  }

  return state;
}

/**
 * Get status message for Seven Dispute state
 */
export function getSevenDisputeStatusMessage(state: GameState): string | null {
  if (!state.sevenDispute) return null;

  const dispute = state.sevenDispute;
  const responderName = `Player ${dispute.responderPlayerId + 1}`;
  const statusWord = dispute.cancelled ? "CANCELLED" : "NOT CANCELLED";

  if (dispute.kind === "EFFECT") {
    const effectDesc =
      dispute.effectSnapshot?.skip
        ? "Skip"
        : `+${dispute.effectSnapshot?.drawAmount || 0}`;
    return `7 Dispute (${effectDesc} ${statusWord}) - ${responderName}: Play 7 or Accept`;
  } else {
    return `7 Dispute (Last Card ${statusWord}) - ${responderName}: Play 7 or Accept`;
  }
}
