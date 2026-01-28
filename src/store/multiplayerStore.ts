/**
 * Multiplayer Game State Management
 *
 * Zustand store for multiplayer game UI state.
 * Unlike the local gameStore, this doesn't manage the actual game state -
 * that comes from the server via the party hooks.
 *
 * This store manages:
 * - UI state (selected cards, play order, pending suit choice)
 * - Action dispatching (converting UI actions to server messages)
 */

import { create } from "zustand";
import { Card, Suit, cardEquals, isSpecialCard } from "@/engine";
import type { ClientGameState, GameAction } from "@/lib/party/messages";

interface MultiplayerStore {
  // UI state
  selectedCards: Card[];
  playOrder: Card[]; // Cards in the order they will be played
  pendingSuitChoice: boolean;
  activateEffect: boolean; // Toggle for 2/5/10/Jack/Ace effect activation

  // Actions
  selectCard: (card: Card) => void;
  deselectCard: (card: Card) => void;
  clearSelection: () => void;
  reorderPlayCard: (fromIndex: number, toIndex: number) => void;
  toggleActivateEffect: () => void;
  setPendingSuitChoice: (pending: boolean) => void;
  resetUIState: () => void;

  // Action builders - these return GameAction objects to send to server
  buildPlayCardsAction: (chosenSuit?: Suit) => GameAction | null;
  buildDrawAction: () => GameAction;
  buildDeclareLastCardAction: () => GameAction;
  buildResolveResponseAction: () => GameAction;
  buildDeflectResponseAction: (card: Card) => GameAction;
  buildSevenCancelEffectAction: (card: Card) => GameAction;
  buildSevenCancelLastCardAction: (card: Card) => GameAction;
  buildSevenDisputePlayAction: (card: Card) => GameAction;
  buildSevenDisputeAcceptAction: () => GameAction;
  buildJackAcceptAction: () => GameAction;
  buildJackCancelAction: (card: Card) => GameAction;
  buildAceAcceptAction: () => GameAction;
  buildAceCancelAction: (card: Card) => GameAction;

  // Helpers for checking game state
  hasSpecialCardSelected: (playerCount: number) => boolean;
  needsSuitChoice: () => boolean;
}

export const useMultiplayerStore = create<MultiplayerStore>((set, get) => ({
  selectedCards: [],
  playOrder: [],
  pendingSuitChoice: false,
  activateEffect: true,

  selectCard: (card: Card) => {
    const { selectedCards, playOrder } = get();
    // Don't allow selecting if already selected
    if (selectedCards.some((c) => cardEquals(c, card))) return;

    set({
      selectedCards: [...selectedCards, card],
      playOrder: [...playOrder, card],
    });
  },

  deselectCard: (card: Card) => {
    const { selectedCards, playOrder } = get();
    set({
      selectedCards: selectedCards.filter((c) => !cardEquals(c, card)),
      playOrder: playOrder.filter((c) => !cardEquals(c, card)),
    });
  },

  clearSelection: () => {
    set({ selectedCards: [], playOrder: [], pendingSuitChoice: false });
  },

  reorderPlayCard: (fromIndex: number, toIndex: number) => {
    const { playOrder } = get();
    const newOrder = [...playOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    set({ playOrder: newOrder });
  },

  toggleActivateEffect: () => {
    set((state) => ({ activateEffect: !state.activateEffect }));
  },

  setPendingSuitChoice: (pending: boolean) => {
    set({ pendingSuitChoice: pending });
  },

  resetUIState: () => {
    set({
      selectedCards: [],
      playOrder: [],
      pendingSuitChoice: false,
      activateEffect: true,
    });
  },

  // Action builders
  buildPlayCardsAction: (chosenSuit?: Suit) => {
    const { playOrder, activateEffect, pendingSuitChoice } = get();
    if (playOrder.length === 0) return null;

    const lastCard = playOrder[playOrder.length - 1];

    // Check if we need a suit choice for Ace
    if (lastCard?.rank === "A" && activateEffect && !chosenSuit && !pendingSuitChoice) {
      set({ pendingSuitChoice: true });
      return null;
    }

    const hasSpecialEffect = playOrder.some(isSpecialCard);
    const isJackPlay = playOrder.length === 1 && lastCard?.rank === "J";
    const isAcePlay = playOrder.length === 1 && lastCard?.rank === "A";

    return {
      action: "play_cards" as const,
      cards: playOrder,
      chosenSuit: isAcePlay && activateEffect ? chosenSuit : undefined,
      activateEffect: hasSpecialEffect || isJackPlay || isAcePlay ? activateEffect : undefined,
    };
  },

  buildDrawAction: () => ({ action: "draw" as const }),

  buildDeclareLastCardAction: () => ({ action: "declare_last_card" as const }),

  buildResolveResponseAction: () => ({ action: "resolve_response" as const }),

  buildDeflectResponseAction: (card: Card) => ({
    action: "deflect_response" as const,
    card,
  }),

  buildSevenCancelEffectAction: (card: Card) => ({
    action: "seven_cancel_effect" as const,
    card,
  }),

  buildSevenCancelLastCardAction: (card: Card) => ({
    action: "seven_cancel_last_card" as const,
    card,
  }),

  buildSevenDisputePlayAction: (card: Card) => ({
    action: "seven_dispute_play" as const,
    card,
  }),

  buildSevenDisputeAcceptAction: () => ({ action: "seven_dispute_accept" as const }),

  buildJackAcceptAction: () => ({ action: "jack_accept" as const }),

  buildJackCancelAction: (card: Card) => ({
    action: "jack_cancel" as const,
    card,
  }),

  buildAceAcceptAction: () => ({ action: "ace_accept" as const }),

  buildAceCancelAction: (card: Card) => ({
    action: "ace_cancel" as const,
    card,
  }),

  // Helpers
  hasSpecialCardSelected: (playerCount: number) => {
    const { playOrder } = get();
    // Check for 2, 5, 10 (always special)
    if (playOrder.some(isSpecialCard)) return true;
    // Check for Jack (special in 3+ player games)
    if (playerCount >= 3 && playOrder.some((c) => c.rank === "J")) return true;
    // Check for Ace (special - suit change)
    if (playOrder.some((c) => c.rank === "A")) return true;
    return false;
  },

  needsSuitChoice: () => {
    return get().pendingSuitChoice;
  },
}));

// =============================================================================
// Helper functions for working with ClientGameState
// =============================================================================

/**
 * Get the player's own state from the game state
 */
export function getMyPlayerState(gameState: ClientGameState, myPlayerId: string) {
  return gameState.players.find((p) => p.id === myPlayerId);
}

/**
 * Get opponent player states (everyone except me)
 */
export function getOpponentStates(gameState: ClientGameState, myPlayerId: string) {
  return gameState.players.filter((p) => p.id !== myPlayerId);
}

/**
 * Check if it's the player's turn
 */
export function isMyTurn(gameState: ClientGameState, myPlayerId: string): boolean {
  return gameState.currentPlayerId === myPlayerId;
}

/**
 * Check if the player is responding to an effect
 */
export function isMyResponseTurn(gameState: ClientGameState, myPlayerId: string): boolean {
  return gameState.respondingPlayerId === myPlayerId;
}

/**
 * Check if the player is in a seven dispute
 * Note: sevenDispute.responderPlayerId is a number index from the engine, need to map it
 */
export function isMySevenDisputeTurn(gameState: ClientGameState, myPlayerId: string): boolean {
  if (!gameState.sevenDispute) return false;
  const responderIndex = gameState.sevenDispute.responderPlayerId;
  const responder = gameState.players[responderIndex];
  return responder?.id === myPlayerId;
}

/**
 * Check if the player is responding to a Jack
 */
export function isMyJackResponseTurn(gameState: ClientGameState, myPlayerId: string): boolean {
  return gameState.jackResponse?.responderPlayerId === myPlayerId;
}

/**
 * Check if the player is responding to an Ace
 */
export function isMyAceResponseTurn(gameState: ClientGameState, myPlayerId: string): boolean {
  return gameState.aceResponse?.responderPlayerId === myPlayerId;
}

/**
 * Check if the game is over
 */
export function isGameOver(gameState: ClientGameState): boolean {
  return gameState.winnerId !== null;
}

/**
 * Get the winner's player state
 */
export function getWinner(gameState: ClientGameState) {
  if (!gameState.winnerId) return null;
  return gameState.players.find((p) => p.id === gameState.winnerId);
}

/**
 * Check if a card can legally be played (basic check - suit/rank match)
 */
export function canCardBePlayed(card: Card, gameState: ClientGameState): boolean {
  const targetSuit = gameState.effectiveSuit;
  const targetRank = gameState.topCard.rank;

  // Aces cannot match other Aces by rank
  if (card.rank === "A" && targetRank === "A") {
    return card.suit === targetSuit;
  }

  return card.suit === targetSuit || card.rank === targetRank;
}

/**
 * Get legal deflection cards from a player's hand during response phase
 */
export function getLegalDeflections(hand: Card[], gameState: ClientGameState): Card[] {
  if (gameState.responsePhase !== "responding" || !gameState.responseChainRank) {
    return [];
  }
  return hand.filter((c) => c.rank === gameState.responseChainRank);
}

/**
 * Get legal 7s for canceling effects during response phase
 */
export function getLegalSevenCancels(hand: Card[], gameState: ClientGameState): Card[] {
  if (gameState.responsePhase !== "responding") {
    return [];
  }
  // Need a 7 of the same suit as the top card
  return hand.filter((c) => c.rank === "7" && c.suit === gameState.topCard.suit);
}

/**
 * Get legal 7s for challenging a last card declaration
 */
export function getLegalSevenChallenges(hand: Card[], gameState: ClientGameState): Card[] {
  if (!gameState.lastCardClaim) {
    return [];
  }
  // Need a 7 of the same suit as the top card
  return hand.filter((c) => c.rank === "7" && c.suit === gameState.topCard.suit);
}

/**
 * Get legal cards for responding to a seven dispute
 */
export function getLegalSevenDisputePlays(hand: Card[], gameState: ClientGameState): Card[] {
  if (!gameState.sevenDispute) {
    return [];
  }
  // Need a 7 of the top card's suit (the suit of the card that triggered the dispute)
  return hand.filter((c) => c.rank === "7" && c.suit === gameState.topCard.suit);
}

/**
 * Get legal cards for canceling a Jack response
 */
export function getLegalJackCancels(hand: Card[], gameState: ClientGameState): Card[] {
  if (!gameState.jackResponse) {
    return [];
  }
  // Can cancel with 7 of Jack's suit or any Jack
  return hand.filter(
    (c) =>
      (c.rank === "7" && c.suit === gameState.jackResponse?.jackSuit) ||
      c.rank === "J"
  );
}

/**
 * Get legal cards for canceling an Ace response
 */
export function getLegalAceCancels(hand: Card[], gameState: ClientGameState): Card[] {
  if (!gameState.aceResponse) {
    return [];
  }
  // Can only cancel with 7 of Ace's suit
  return hand.filter(
    (c) => c.rank === "7" && c.suit === gameState.aceResponse?.aceSuit
  );
}
