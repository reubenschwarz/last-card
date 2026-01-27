/**
 * Game State Management with Zustand
 * Thin wrapper around the rules engine for React integration
 */

import { create } from "zustand";
import {
  Card,
  GameState,
  Play,
  PlayerType,
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
  // Response phase functions
  isInResponsePhase,
  getRespondingPlayer,
  getLegalDeflections,
  getLegalCancels,
  canCancel,
  applyResolve,
  applyDeflect,
  applyCancel,
  isSpecialCard,
  // Seven Dispute functions
  isInSevenDispute,
  canPlaySevenCancelEffect,
  canPlaySevenCancelLastCard,
  getLegalSevenCancelsEffect,
  getLegalSevenCancelsLastCard,
  getLegalSevenDisputePlays,
  canPlaySevenDispute,
  applySevenCancelEffect,
  applySevenCancelLastCard,
  applySevenDisputePlay,
  applySevenDisputeAccept,
  getSevenDisputeStatusMessage,
  // Jack response functions
  isInJackResponse,
  canRespondToJack,
  getLegalJackCancels,
  canCancelJack,
  applyJackAccept,
  applyJackCancel,
  // Ace response functions
  isInAceResponse,
  canRespondToAce,
  getLegalAceCancels,
  canCancelAce,
  applyAceAccept,
  applyAceCancel,
} from "@/engine";

interface GameStore {
  // Core game state
  gameState: GameState | null;

  // UI state
  selectedCards: Card[];
  playOrder: Card[]; // Cards in the order they will be played
  pendingSuitChoice: boolean;
  activateEffect: boolean; // Toggle for 2/5/10 effect activation

  // Actions
  startGame: (playerCount: number) => void;
  startGameWithTypes: (playerCount: number, playerTypes: PlayerType[]) => void;
  executeAiTurn: () => void; // Execute AI player's turn
  selectCard: (card: Card) => void;
  deselectCard: (card: Card) => void;
  clearSelection: () => void;
  reorderPlayCard: (fromIndex: number, toIndex: number) => void;
  toggleActivateEffect: () => void;

  // Game actions
  playSelectedCards: (chosenSuit?: Suit) => void;
  drawCard: () => void;
  confirmHandoff: () => void;
  declareLastCard: () => void;

  // Response phase actions
  resolveResponse: () => void;
  deflectResponse: (card: Card) => void;
  cancelResponse: (card: Card) => void;

  // Seven Dispute actions
  playSevenCancelEffect: (card: Card) => void;
  playSevenCancelLastCard: (card: Card) => void;
  playSevenDispute: (card: Card) => void;
  acceptSevenDispute: () => void;

  // Jack response actions
  acceptJackResponse: () => void;
  cancelJackResponse: (card: Card) => void;

  // Ace response actions
  acceptAceResponse: () => void;
  cancelAceResponse: (card: Card) => void;

  // Computed helpers
  getCurrentPlayer: () => { id: number; hand: Card[] } | null;
  getLegalPlays: () => LegalPlay[];
  isSelectionLegal: () => boolean;
  needsSuitChoice: () => boolean;
  getTopCard: () => Card | null;
  getTargetSuit: () => Suit | null;
  getTargetRank: () => string | null;

  // Response phase helpers
  isInResponsePhase: () => boolean;
  getRespondingPlayer: () => { id: number; hand: Card[] } | null;
  getLegalDeflections: () => Card[];
  getLegalCancels: () => Card[];
  canCancel: () => boolean;
  hasSpecialCardSelected: () => boolean;

  // Seven Dispute helpers
  isInSevenDispute: () => boolean;
  canPlaySevenCancelEffect: () => boolean;
  canPlaySevenCancelLastCard: () => boolean;
  getLegalSevenCancelsEffect: () => Card[];
  getLegalSevenCancelsLastCard: () => Card[];
  getLegalSevenDisputePlays: () => Card[];
  canPlaySevenDispute: () => boolean;
  getSevenDisputeStatusMessage: () => string | null;
  getSevenDisputeResponder: () => { id: number; hand: Card[] } | null;

  // Jack response helpers
  isInJackResponse: () => boolean;
  canRespondToJack: () => boolean;
  getLegalJackCancels: () => Card[];
  canCancelJack: () => boolean;
  getJackResponder: () => { id: number; hand: Card[] } | null;

  // Ace response helpers
  isInAceResponse: () => boolean;
  canRespondToAce: () => boolean;
  getLegalAceCancels: () => Card[];
  canCancelAce: () => boolean;
  getAceResponder: () => { id: number; hand: Card[] } | null;

  // Direction helper
  getDirection: () => "CW" | "CCW" | null;

  // AI and player type helpers
  isActivePlayerAi: () => boolean; // Check if the player who needs to act is AI
  getActivePlayerIndex: () => number | null; // Get index of player who needs to act
  getPlayerType: (index: number) => PlayerType | null;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  selectedCards: [],
  playOrder: [],
  pendingSuitChoice: false,
  activateEffect: true,

  startGame: (playerCount: number) => {
    const gameState = initializeGame(playerCount);
    set({
      gameState,
      selectedCards: [],
      playOrder: [],
      pendingSuitChoice: false,
      activateEffect: true,
    });
  },

  startGameWithTypes: (playerCount: number, playerTypes: PlayerType[]) => {
    const gameState = initializeGame(playerCount, undefined, playerTypes);
    set({
      gameState,
      selectedCards: [],
      playOrder: [],
      pendingSuitChoice: false,
      activateEffect: true,
    });
  },

  executeAiTurn: () => {
    const { gameState } = get();
    if (!gameState || gameState.winner !== null) return;

    // Get the active player who needs to act
    let activeIndex: number;
    if (isInSevenDispute(gameState) && gameState.sevenDispute) {
      activeIndex = gameState.sevenDispute.responderPlayerId;
    } else if (isInJackResponse(gameState) && gameState.jackResponse) {
      activeIndex = gameState.jackResponse.responderPlayerId;
    } else if (isInAceResponse(gameState) && gameState.aceResponse) {
      activeIndex = gameState.aceResponse.responderPlayerId;
    } else if (isInResponsePhase(gameState) && gameState.respondingPlayerIndex !== null) {
      activeIndex = gameState.respondingPlayerIndex;
    } else {
      activeIndex = gameState.currentPlayerIndex;
    }

    const activePlayer = gameState.players[activeIndex];
    if (activePlayer.playerType !== "ai") return;

    let newState = gameState;

    // Handle Seven Dispute phase
    if (isInSevenDispute(gameState) && gameState.sevenDispute) {
      const legalSevens = getLegalSevenDisputePlays(gameState, activeIndex);
      if (legalSevens.length > 0) {
        // AI plays a 7 to continue dispute
        newState = applySevenDisputePlay(gameState, legalSevens[0]);
      } else {
        // AI accepts the dispute outcome
        newState = applySevenDisputeAccept(gameState);
        // After EFFECT dispute with cancelled=true, the turn should advance
        if (newState.turnPhase === "can-end" && newState.winner === null) {
          newState = nextTurn(newState);
        }
      }
      set({ gameState: newState });
      return;
    }

    // Handle Jack Response phase
    if (isInJackResponse(gameState) && gameState.jackResponse) {
      const cancels = getLegalJackCancels(gameState, activeIndex);
      if (cancels.length > 0) {
        // AI cancels with first available card (7 of Jack's suit or another Jack)
        newState = applyJackCancel(gameState, cancels[0]);
      } else {
        // AI accepts direction flip
        newState = applyJackAccept(gameState);
      }
      set({ gameState: newState });
      return;
    }

    // Handle Ace Response phase
    if (isInAceResponse(gameState) && gameState.aceResponse) {
      const cancels = getLegalAceCancels(gameState, activeIndex);
      if (cancels.length > 0) {
        // AI cancels with 7 of Ace's suit
        newState = applyAceCancel(gameState, cancels[0]);
      } else {
        // AI accepts suit change
        newState = applyAceAccept(gameState);
      }
      set({ gameState: newState });
      return;
    }

    // Handle Response Phase (2/5/10 deflection)
    if (isInResponsePhase(gameState) && gameState.respondingPlayerIndex !== null) {
      // Check for 7 cancel option first
      const sevenCancels = getLegalSevenCancelsEffect(gameState, activeIndex);
      if (sevenCancels.length > 0) {
        // AI plays 7 to cancel effect
        newState = applySevenCancelEffect(gameState, sevenCancels[0]);
        set({ gameState: newState });
        return;
      }

      // Check for deflection
      const deflections = getLegalDeflections(gameState);
      if (deflections.length > 0) {
        // AI deflects with first available card
        newState = applyDeflect(gameState, deflections[0]);
        set({ gameState: newState });
        return;
      }

      // No deflection possible - resolve
      newState = applyResolve(gameState);
      set({ gameState: newState });
      return;
    }

    // Handle waiting phase - AI confirms handoff
    if (gameState.turnPhase === "waiting") {
      newState = confirmHandoff(gameState);
      set({ gameState: newState });
      return;
    }

    // Handle must-draw phase
    if (gameState.turnPhase === "must-draw") {
      newState = applyForcedDraw(gameState);
      newState = nextTurn(newState);
      set({ gameState: newState, selectedCards: [], playOrder: [] });
      return;
    }

    // Handle 7 challenge for Last Card (before normal play)
    if (canPlaySevenCancelLastCard(gameState, activeIndex)) {
      const sevenCancels = getLegalSevenCancelsLastCard(gameState, activeIndex);
      if (sevenCancels.length > 0) {
        // AI challenges with 50% probability (simple baseline)
        if (Math.random() < 0.5) {
          newState = applySevenCancelLastCard(gameState, sevenCancels[0]);
          set({ gameState: newState });
          return;
        }
      }
    }

    // Normal playing phase
    if (gameState.turnPhase === "playing") {
      const legalPlays = getLegalPlays(gameState, activeIndex);

      if (legalPlays.length > 0) {
        // AI prefers playing over drawing
        // Pick a deterministic play: prefer smallest hand reduction, then alphabetical order
        // For simplicity, just pick the first legal single-card play, or first overall
        const singleCardPlays = legalPlays.filter((p) => p.play.cards.length === 1);
        const chosenPlay = singleCardPlays.length > 0 ? singleCardPlays[0] : legalPlays[0];

        // Check if AI should declare Last Card
        if (canDeclareLastCard(gameState, chosenPlay.play.cards)) {
          newState = declareLastCard(gameState);
        }

        // Apply the play
        newState = applyPlay(newState, chosenPlay.play);

        // Auto-end turn if no response phase, Jack response, or Ace response
        if (
          newState.winner === null &&
          newState.responsePhase !== "responding" &&
          !isInJackResponse(newState) &&
          !isInAceResponse(newState)
        ) {
          newState = nextTurn(newState);
        }

        set({ gameState: newState, selectedCards: [], playOrder: [], activateEffect: true });
      } else {
        // No legal plays - draw
        newState = applyVoluntaryDraw(gameState);
        newState = nextTurn(newState);
        set({ gameState: newState, selectedCards: [], playOrder: [] });
      }
    }
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

  toggleActivateEffect: () => {
    set((state) => ({ activateEffect: !state.activateEffect }));
  },

  playSelectedCards: (chosenSuit?: Suit) => {
    const { gameState, playOrder, pendingSuitChoice, activateEffect } = get();
    if (!gameState) return;

    // Check if we need a suit choice for Ace (only if activation is ON)
    const lastCard = playOrder[playOrder.length - 1];
    if (lastCard?.rank === "A" && activateEffect && !chosenSuit && !pendingSuitChoice) {
      set({ pendingSuitChoice: true });
      return;
    }

    // Check if play contains special cards (2, 5, 10)
    const hasSpecialEffect = playOrder.some(isSpecialCard);

    // Check if play is a Jack (activation matters for 3+ players)
    const isJackPlay = playOrder.length === 1 && lastCard?.rank === "J";
    const isAcePlay = playOrder.length === 1 && lastCard?.rank === "A";

    const play: Play = {
      cards: playOrder,
      // For Ace: only set chosenSuit if activation is ON
      chosenSuit: isAcePlay && activateEffect ? chosenSuit : undefined,
      // Activation affects: 2/5/10 effects, Jack direction (3+ players), Ace suit change
      activateEffect:
        hasSpecialEffect || (isJackPlay && gameState.players.length >= 3) || isAcePlay
          ? activateEffect
          : undefined,
    };

    if (isPlayLegal(gameState, gameState.currentPlayerIndex, play)) {
      let newState = applyPlay(gameState, play);

      // Auto-end turn after playing (unless game is over or entering response/Jack/Ace phase)
      if (
        newState.winner === null &&
        newState.responsePhase !== "responding" &&
        !isInJackResponse(newState) &&
        !isInAceResponse(newState)
      ) {
        newState = nextTurn(newState);
      }

      set({
        gameState: newState,
        selectedCards: [],
        playOrder: [],
        pendingSuitChoice: false,
        activateEffect: true, // Reset activation toggle
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

    // Auto-end turn after drawing
    newState = nextTurn(newState);

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

  // Response phase actions
  resolveResponse: () => {
    const { gameState } = get();
    if (!gameState || !isInResponsePhase(gameState)) return;

    const newState = applyResolve(gameState);
    set({ gameState: newState });
  },

  deflectResponse: (card: Card) => {
    const { gameState } = get();
    if (!gameState || !isInResponsePhase(gameState)) return;

    const newState = applyDeflect(gameState, card);

    // If game ended due to this deflection, just update state
    // Otherwise, handoff screen will be shown to next responder
    set({ gameState: newState });
  },

  cancelResponse: (card: Card) => {
    const { gameState } = get();
    if (!gameState || !isInResponsePhase(gameState)) return;

    const newState = applyCancel(gameState, card);
    set({ gameState: newState });
  },

  // Seven Dispute actions
  playSevenCancelEffect: (card: Card) => {
    const { gameState } = get();
    if (!gameState) return;

    const newState = applySevenCancelEffect(gameState, card);
    set({ gameState: newState });
  },

  playSevenCancelLastCard: (card: Card) => {
    const { gameState } = get();
    if (!gameState) return;

    const newState = applySevenCancelLastCard(gameState, card);
    set({ gameState: newState });
  },

  playSevenDispute: (card: Card) => {
    const { gameState } = get();
    if (!gameState || !isInSevenDispute(gameState)) return;

    const newState = applySevenDisputePlay(gameState, card);
    set({ gameState: newState });
  },

  acceptSevenDispute: () => {
    const { gameState } = get();
    if (!gameState || !isInSevenDispute(gameState)) return;

    let newState = applySevenDisputeAccept(gameState);

    // After EFFECT dispute with cancelled=true, the turn should advance
    // because both players have played their cards (original 2/5/10 and the 7 cancel)
    if (newState.turnPhase === "can-end" && newState.winner === null) {
      newState = nextTurn(newState);
    }

    set({ gameState: newState });
  },

  getCurrentPlayer: () => {
    const { gameState } = get();
    if (!gameState) return null;

    const player = gameState.players[gameState.currentPlayerIndex];
    return { id: player.id, hand: player.hand };
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

  // Response phase helpers
  isInResponsePhase: () => {
    const { gameState } = get();
    if (!gameState) return false;
    return isInResponsePhase(gameState);
  },

  getRespondingPlayer: () => {
    const { gameState } = get();
    if (!gameState) return null;
    const player = getRespondingPlayer(gameState);
    if (!player) return null;
    return { id: player.id, hand: player.hand };
  },

  getLegalDeflections: () => {
    const { gameState } = get();
    if (!gameState) return [];
    return getLegalDeflections(gameState);
  },

  getLegalCancels: () => {
    const { gameState } = get();
    if (!gameState) return [];
    return getLegalCancels(gameState);
  },

  canCancel: () => {
    const { gameState } = get();
    if (!gameState) return false;
    return canCancel(gameState);
  },

  hasSpecialCardSelected: () => {
    const { playOrder } = get();
    return playOrder.some(isSpecialCard);
  },

  // Seven Dispute helpers
  isInSevenDispute: () => {
    const { gameState } = get();
    if (!gameState) return false;
    return isInSevenDispute(gameState);
  },

  canPlaySevenCancelEffect: () => {
    const { gameState } = get();
    if (!gameState) return false;
    if (!gameState.respondingPlayerIndex) return false;
    return canPlaySevenCancelEffect(gameState, gameState.respondingPlayerIndex);
  },

  canPlaySevenCancelLastCard: () => {
    const { gameState } = get();
    if (!gameState) return false;
    return canPlaySevenCancelLastCard(gameState, gameState.currentPlayerIndex);
  },

  getLegalSevenCancelsEffect: () => {
    const { gameState } = get();
    if (!gameState || gameState.respondingPlayerIndex === null) return [];
    return getLegalSevenCancelsEffect(gameState, gameState.respondingPlayerIndex);
  },

  getLegalSevenCancelsLastCard: () => {
    const { gameState } = get();
    if (!gameState) return [];
    return getLegalSevenCancelsLastCard(gameState, gameState.currentPlayerIndex);
  },

  getLegalSevenDisputePlays: () => {
    const { gameState } = get();
    if (!gameState || !gameState.sevenDispute) return [];
    return getLegalSevenDisputePlays(gameState, gameState.sevenDispute.responderPlayerId);
  },

  canPlaySevenDispute: () => {
    const { gameState } = get();
    if (!gameState || !gameState.sevenDispute) return false;
    return canPlaySevenDispute(gameState, gameState.sevenDispute.responderPlayerId);
  },

  getSevenDisputeStatusMessage: () => {
    const { gameState } = get();
    if (!gameState) return null;
    return getSevenDisputeStatusMessage(gameState);
  },

  getSevenDisputeResponder: () => {
    const { gameState } = get();
    if (!gameState || !gameState.sevenDispute) return null;
    const player = gameState.players[gameState.sevenDispute.responderPlayerId];
    return { id: player.id, hand: player.hand };
  },

  // AI and player type helpers
  isActivePlayerAi: () => {
    const { gameState } = get();
    if (!gameState) return false;

    let activeIndex: number;
    if (isInSevenDispute(gameState) && gameState.sevenDispute) {
      activeIndex = gameState.sevenDispute.responderPlayerId;
    } else if (isInJackResponse(gameState) && gameState.jackResponse) {
      activeIndex = gameState.jackResponse.responderPlayerId;
    } else if (isInAceResponse(gameState) && gameState.aceResponse) {
      activeIndex = gameState.aceResponse.responderPlayerId;
    } else if (isInResponsePhase(gameState) && gameState.respondingPlayerIndex !== null) {
      activeIndex = gameState.respondingPlayerIndex;
    } else {
      activeIndex = gameState.currentPlayerIndex;
    }

    return gameState.players[activeIndex].playerType === "ai";
  },

  getActivePlayerIndex: () => {
    const { gameState } = get();
    if (!gameState) return null;

    if (isInSevenDispute(gameState) && gameState.sevenDispute) {
      return gameState.sevenDispute.responderPlayerId;
    } else if (isInJackResponse(gameState) && gameState.jackResponse) {
      return gameState.jackResponse.responderPlayerId;
    } else if (isInAceResponse(gameState) && gameState.aceResponse) {
      return gameState.aceResponse.responderPlayerId;
    } else if (isInResponsePhase(gameState) && gameState.respondingPlayerIndex !== null) {
      return gameState.respondingPlayerIndex;
    } else {
      return gameState.currentPlayerIndex;
    }
  },

  getPlayerType: (index: number) => {
    const { gameState } = get();
    if (!gameState || index < 0 || index >= gameState.players.length) return null;
    return gameState.players[index].playerType;
  },

  // Jack response helpers
  isInJackResponse: () => {
    const { gameState } = get();
    if (!gameState) return false;
    return isInJackResponse(gameState);
  },

  canRespondToJack: () => {
    const { gameState } = get();
    if (!gameState || !gameState.jackResponse) return false;
    return canRespondToJack(gameState, gameState.jackResponse.responderPlayerId);
  },

  getLegalJackCancels: () => {
    const { gameState } = get();
    if (!gameState || !gameState.jackResponse) return [];
    return getLegalJackCancels(gameState, gameState.jackResponse.responderPlayerId);
  },

  canCancelJack: () => {
    const { gameState } = get();
    if (!gameState || !gameState.jackResponse) return false;
    return canCancelJack(gameState, gameState.jackResponse.responderPlayerId);
  },

  getJackResponder: () => {
    const { gameState } = get();
    if (!gameState || !gameState.jackResponse) return null;
    const player = gameState.players[gameState.jackResponse.responderPlayerId];
    return { id: player.id, hand: player.hand };
  },

  // Ace response helpers
  isInAceResponse: () => {
    const { gameState } = get();
    if (!gameState) return false;
    return isInAceResponse(gameState);
  },

  canRespondToAce: () => {
    const { gameState } = get();
    if (!gameState || !gameState.aceResponse) return false;
    return canRespondToAce(gameState, gameState.aceResponse.responderPlayerId);
  },

  getLegalAceCancels: () => {
    const { gameState } = get();
    if (!gameState || !gameState.aceResponse) return [];
    return getLegalAceCancels(gameState, gameState.aceResponse.responderPlayerId);
  },

  canCancelAce: () => {
    const { gameState } = get();
    if (!gameState || !gameState.aceResponse) return false;
    return canCancelAce(gameState, gameState.aceResponse.responderPlayerId);
  },

  getAceResponder: () => {
    const { gameState } = get();
    if (!gameState || !gameState.aceResponse) return null;
    const player = gameState.players[gameState.aceResponse.responderPlayerId];
    return { id: player.id, hand: player.hand };
  },

  // Direction helper
  getDirection: () => {
    const { gameState } = get();
    if (!gameState) return null;
    return gameState.direction;
  },

  // Jack response actions
  acceptJackResponse: () => {
    const { gameState } = get();
    if (!gameState || !isInJackResponse(gameState)) return;
    const newState = applyJackAccept(gameState);
    set({ gameState: newState, selectedCards: [], playOrder: [] });
  },

  cancelJackResponse: (card: Card) => {
    const { gameState } = get();
    if (!gameState || !isInJackResponse(gameState)) return;
    const newState = applyJackCancel(gameState, card);
    set({ gameState: newState, selectedCards: [], playOrder: [] });
  },

  // Ace response actions
  acceptAceResponse: () => {
    const { gameState } = get();
    if (!gameState || !isInAceResponse(gameState)) return;
    const newState = applyAceAccept(gameState);
    set({ gameState: newState, selectedCards: [], playOrder: [] });
  },

  cancelAceResponse: (card: Card) => {
    const { gameState } = get();
    if (!gameState || !isInAceResponse(gameState)) return;
    const newState = applyAceCancel(gameState, card);
    set({ gameState: newState, selectedCards: [], playOrder: [] });
  },
}));
