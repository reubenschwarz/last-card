/**
 * Game State Management with Zustand
 * Thin wrapper around the rules engine for React integration
 */

import { create } from "zustand";
import {
  Card,
  GameState,
  Play,
  Suit,
  cardEquals,
  initializeGame,
  getLegalPlays,
  isPlayLegal,
  applyPlay,
  applyForcedDraw,
  applyVoluntaryDraw,
  nextTurn,
  confirmHandoff,
  declareLastCard,
  canDeclareLastCard,
  getTopCard,
  getTargetSuit,
  getTargetRank,
  LegalPlay,
} from "@/engine";

interface GameStore {
  // Core game state
  gameState: GameState | null;

  // UI state
  selectedCards: Card[];
  playOrder: Card[]; // Cards in the order they will be played
  pendingSuitChoice: boolean;

  // Actions
  startGame: (playerCount: number) => void;
  selectCard: (card: Card) => void;
  deselectCard: (card: Card) => void;
  clearSelection: () => void;
  reorderPlayCard: (fromIndex: number, toIndex: number) => void;

  // Game actions
  playSelectedCards: (chosenSuit?: Suit) => void;
  drawCard: () => void;
  endTurn: () => void;
  confirmHandoff: () => void;
  declareLastCard: () => void;

  // Computed helpers
  getCurrentPlayer: () => { id: number; hand: Card[] } | null;
  getOpponentCardCount: () => number;
  getLegalPlays: () => LegalPlay[];
  isSelectionLegal: () => boolean;
  canDeclareLastCard: () => boolean;
  needsSuitChoice: () => boolean;
  getTopCard: () => Card | null;
  getTargetSuit: () => Suit | null;
  getTargetRank: () => string | null;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  selectedCards: [],
  playOrder: [],
  pendingSuitChoice: false,

  startGame: (playerCount: number) => {
    const gameState = initializeGame(playerCount);
    set({
      gameState,
      selectedCards: [],
      playOrder: [],
      pendingSuitChoice: false,
    });
  },

  selectCard: (card: Card) => {
    const { selectedCards, playOrder, gameState } = get();
    if (!gameState) return;

    // Don't allow selecting if already selected
    if (selectedCards.some((c) => cardEquals(c, card))) return;

    // Add to both selected and play order
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

  playSelectedCards: (chosenSuit?: Suit) => {
    const { gameState, playOrder, pendingSuitChoice } = get();
    if (!gameState) return;

    // Check if we need a suit choice for Ace
    const lastCard = playOrder[playOrder.length - 1];
    if (lastCard?.rank === "A" && !chosenSuit && !pendingSuitChoice) {
      set({ pendingSuitChoice: true });
      return;
    }

    const play: Play = {
      cards: playOrder,
      chosenSuit: lastCard?.rank === "A" ? chosenSuit : undefined,
    };

    if (isPlayLegal(gameState, gameState.currentPlayerIndex, play)) {
      const newState = applyPlay(gameState, play);
      set({
        gameState: newState,
        selectedCards: [],
        playOrder: [],
        pendingSuitChoice: false,
      });
    }
  },

  drawCard: () => {
    const { gameState } = get();
    if (!gameState) return;

    let newState: GameState;

    if (gameState.turnPhase === "must-draw") {
      // Forced draw
      newState = applyForcedDraw(gameState);
    } else {
      // Voluntary draw
      newState = applyVoluntaryDraw(gameState);
    }

    set({
      gameState: newState,
      selectedCards: [],
      playOrder: [],
    });
  },

  endTurn: () => {
    const { gameState } = get();
    if (!gameState) return;

    const newState = nextTurn(gameState);
    set({
      gameState: newState,
      selectedCards: [],
      playOrder: [],
    });
  },

  confirmHandoff: () => {
    const { gameState } = get();
    if (!gameState) return;

    const newState = confirmHandoff(gameState);
    set({ gameState: newState });
  },

  declareLastCard: () => {
    const { gameState } = get();
    if (!gameState) return;

    const newState = declareLastCard(gameState);
    set({ gameState: newState });
  },

  getCurrentPlayer: () => {
    const { gameState } = get();
    if (!gameState) return null;

    const player = gameState.players[gameState.currentPlayerIndex];
    return { id: player.id, hand: player.hand };
  },

  getOpponentCardCount: () => {
    const { gameState } = get();
    if (!gameState) return 0;

    // Get the other player's card count (for 2-player game)
    const opponentIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    return gameState.players[opponentIndex].hand.length;
  },

  getLegalPlays: () => {
    const { gameState } = get();
    if (!gameState) return [];
    return getLegalPlays(gameState, gameState.currentPlayerIndex);
  },

  isSelectionLegal: () => {
    const { gameState, playOrder } = get();
    if (!gameState || playOrder.length === 0) return false;

    // Check if the current selection (in play order) forms a legal play
    // For Ace, we accept any suit choice
    const lastCard = playOrder[playOrder.length - 1];
    if (lastCard.rank === "A") {
      // Check with any suit
      return isPlayLegal(gameState, gameState.currentPlayerIndex, {
        cards: playOrder,
        chosenSuit: "hearts",
      });
    }

    return isPlayLegal(gameState, gameState.currentPlayerIndex, { cards: playOrder });
  },

  canDeclareLastCard: () => {
    const { gameState, playOrder } = get();
    if (!gameState || playOrder.length === 0) return false;
    return canDeclareLastCard(gameState, playOrder);
  },

  needsSuitChoice: () => {
    const { pendingSuitChoice } = get();
    return pendingSuitChoice;
  },

  getTopCard: () => {
    const { gameState } = get();
    if (!gameState) return null;
    return getTopCard(gameState);
  },

  getTargetSuit: () => {
    const { gameState } = get();
    if (!gameState) return null;
    return getTargetSuit(gameState);
  },

  getTargetRank: () => {
    const { gameState } = get();
    if (!gameState) return null;
    return getTargetRank(gameState);
  },
}));
