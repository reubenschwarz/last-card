/**
 * Multiplayer Message Protocol Types
 *
 * Defines all messages exchanged between clients and the Partykit server.
 * Messages are JSON-serialized with a `type` discriminator.
 */

import type { Card, GameState, Play, Suit, PlayerType } from "@/engine/types";

// =============================================================================
// Common Types
// =============================================================================

/**
 * Player info as seen by other players (no private data like hand)
 */
export interface PublicPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isConnected: boolean;
  isAI: boolean;
  cardCount?: number; // Number of cards in hand (during game)
}

/**
 * Lobby configuration set by the host
 */
export interface LobbyConfig {
  maxPlayers: 2 | 3 | 4;
  aiSlots: number; // Number of AI players to add
  isPublic: boolean; // Whether the game appears in quick play
}

/**
 * Room status
 */
export type RoomStatus = "lobby" | "playing" | "ended";

// =============================================================================
// Client → Server Messages
// =============================================================================

/**
 * Join a game room
 */
export interface JoinMessage {
  type: "join";
  payload: {
    playerId: string;
    name: string;
  };
}

/**
 * Update display name
 */
export interface SetNameMessage {
  type: "set_name";
  payload: {
    name: string;
  };
}

/**
 * Configure game settings (host only)
 */
export interface ConfigureGameMessage {
  type: "configure_game";
  payload: {
    maxPlayers?: 2 | 3 | 4;
    aiSlots?: number;
    isPublic?: boolean;
  };
}

/**
 * Start the game (host only)
 */
export interface StartGameMessage {
  type: "start_game";
  payload: Record<string, never>; // Empty payload
}

/**
 * Perform a game action
 */
export interface PlayActionMessage {
  type: "play_action";
  payload: GameAction;
}

/**
 * Leave the game room
 */
export interface LeaveGameMessage {
  type: "leave";
  payload: Record<string, never>; // Empty payload
}

/**
 * Kick a player (host only)
 */
export interface KickPlayerMessage {
  type: "kick_player";
  payload: {
    playerId: string;
  };
}

/**
 * Add an AI player to the lobby (host only)
 */
export interface AddAIMessage {
  type: "add_ai";
  payload: Record<string, never>; // Empty payload
}

/**
 * Remove an AI player from the lobby (host only)
 */
export interface RemoveAIMessage {
  type: "remove_ai";
  payload: {
    aiPlayerId: string;
  };
}

/**
 * All possible client → server messages
 */
export type ClientMessage =
  | JoinMessage
  | SetNameMessage
  | ConfigureGameMessage
  | StartGameMessage
  | PlayActionMessage
  | LeaveGameMessage
  | KickPlayerMessage
  | AddAIMessage
  | RemoveAIMessage;

// =============================================================================
// Game Actions (part of PlayActionMessage)
// =============================================================================

/**
 * Play cards from hand
 */
export interface PlayCardsAction {
  action: "play_cards";
  cards: Card[];
  chosenSuit?: Suit; // For Ace
  activateEffect?: boolean; // For 2/5/10/Jack/Ace
}

/**
 * Draw a card (voluntary or forced)
 */
export interface DrawCardAction {
  action: "draw";
}

/**
 * End turn (after playing or drawing)
 */
export interface EndTurnAction {
  action: "end_turn";
}

/**
 * Declare "Last Card"
 */
export interface DeclareLastCardAction {
  action: "declare_last_card";
}

/**
 * Response phase: resolve (accept the effect)
 */
export interface ResolveResponseAction {
  action: "resolve_response";
}

/**
 * Response phase: deflect with a card
 */
export interface DeflectResponseAction {
  action: "deflect_response";
  card: Card;
}

/**
 * Response phase: cancel with a 7
 */
export interface CancelResponseAction {
  action: "cancel_response";
  card: Card;
}

/**
 * Seven dispute: play a 7 to toggle cancellation
 */
export interface SevenDisputePlayAction {
  action: "seven_dispute_play";
  card: Card;
}

/**
 * Seven dispute: accept current outcome
 */
export interface SevenDisputeAcceptAction {
  action: "seven_dispute_accept";
}

/**
 * Jack response: accept direction change
 */
export interface JackAcceptAction {
  action: "jack_accept";
}

/**
 * Jack response: cancel with 7 or Jack
 */
export interface JackCancelAction {
  action: "jack_cancel";
  card: Card;
}

/**
 * Ace response: accept suit change
 */
export interface AceAcceptAction {
  action: "ace_accept";
}

/**
 * Ace response: cancel with 7
 */
export interface AceCancelAction {
  action: "ace_cancel";
  card: Card;
}

/**
 * Seven cancel: cancel a pending effect with a 7
 */
export interface SevenCancelEffectAction {
  action: "seven_cancel_effect";
  card: Card;
}

/**
 * Seven cancel: challenge a last card declaration with a 7
 */
export interface SevenCancelLastCardAction {
  action: "seven_cancel_last_card";
  card: Card;
}

/**
 * All possible game actions
 */
export type GameAction =
  | PlayCardsAction
  | DrawCardAction
  | EndTurnAction
  | DeclareLastCardAction
  | ResolveResponseAction
  | DeflectResponseAction
  | CancelResponseAction
  | SevenDisputePlayAction
  | SevenDisputeAcceptAction
  | JackAcceptAction
  | JackCancelAction
  | AceAcceptAction
  | AceCancelAction
  | SevenCancelEffectAction
  | SevenCancelLastCardAction;

// =============================================================================
// Server → Client Messages
// =============================================================================

/**
 * Current room/lobby state (sent on connect and after changes)
 */
export interface RoomStateMessage {
  type: "room_state";
  payload: {
    code: string;
    status: RoomStatus;
    players: PublicPlayer[];
    hostId: string | null;
    config: LobbyConfig;
  };
}

/**
 * Join was successful
 */
export interface JoinSuccessMessage {
  type: "join_success";
  payload: {
    playerId: string;
    isHost: boolean;
    reconnected: boolean;
  };
}

/**
 * A player joined the room
 */
export interface PlayerJoinedMessage {
  type: "player_joined";
  payload: {
    player: PublicPlayer;
    players: PublicPlayer[];
    hostId: string | null;
  };
}

/**
 * A player left the room
 */
export interface PlayerLeftMessage {
  type: "player_left";
  payload: {
    playerId: string;
    playerName: string;
    newHostId: string | null;
    reason: "left" | "kicked" | "disconnected";
  };
}

/**
 * A player's info was updated (e.g., name change)
 */
export interface PlayerUpdatedMessage {
  type: "player_updated";
  payload: {
    playerId: string;
    name?: string;
    isConnected?: boolean;
  };
}

/**
 * Game has started
 */
export interface GameStartedMessage {
  type: "game_started";
  payload: {
    gameState: ClientGameState;
  };
}

/**
 * Full game state update (sent to each player with their private view)
 */
export interface GameStateMessage {
  type: "game_state";
  payload: {
    gameState: ClientGameState;
  };
}

/**
 * Game state update after an action
 */
export interface StateUpdateMessage {
  type: "state_update";
  payload: {
    gameState: ClientGameState;
    lastAction?: {
      playerId: string;
      action: GameAction;
    };
  };
}

/**
 * Game has ended
 */
export interface GameEndedMessage {
  type: "game_ended";
  payload: {
    winnerId: string;
    winnerName: string;
    finalState: ClientGameState;
  };
}

/**
 * Error message
 */
export interface ErrorMessage {
  type: "error";
  payload: {
    code?: string;
    message: string;
  };
}

/**
 * Turn timer update
 */
export interface TimerUpdateMessage {
  type: "timer_update";
  payload: {
    playerId: string;
    remainingMs: number;
    phase: "turn" | "response";
  };
}

/**
 * All possible server → client messages
 */
export type ServerMessage =
  | RoomStateMessage
  | JoinSuccessMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | PlayerUpdatedMessage
  | GameStartedMessage
  | GameStateMessage
  | StateUpdateMessage
  | GameEndedMessage
  | ErrorMessage
  | TimerUpdateMessage;

// =============================================================================
// Client Game State (what the client sees)
// =============================================================================

/**
 * Player state as seen by a specific client
 * - For self: includes full hand
 * - For others: hand is hidden, only card count shown
 */
export interface ClientPlayerState {
  id: string;
  name: string;
  isAI: boolean;
  isConnected: boolean;
  cardCount: number;
  hand?: Card[]; // Only present for the viewing player
  declaredLastCard: boolean;
  lastCardPenalty: boolean;
}

/**
 * Game state from a specific player's perspective
 * This is derived from the full GameState but with hidden info removed
 */
export interface ClientGameState {
  // Player states (with hand hidden for opponents)
  players: ClientPlayerState[];

  // Current turn info
  currentPlayerId: string;
  turnPhase: GameState["turnPhase"];

  // Discard pile (visible to all)
  topCard: Card;
  discardPileCount: number;
  drawPileCount: number;

  // Effective suit (for Ace override)
  effectiveSuit: Suit;

  // Pending effects
  pendingEffects: GameState["pendingEffects"];

  // Direction (for 3+ player games)
  direction: GameState["direction"];

  // Response phase state
  responsePhase: GameState["responsePhase"];
  responseChainRank: GameState["responseChainRank"];
  respondingPlayerId: string | null;

  // Seven dispute state
  sevenDispute: GameState["sevenDispute"] | null;
  lastCardClaim: {
    playerId: string;
    turnNumberCreated: number;
  } | null;

  // Jack/Ace response windows
  jackResponse: {
    jackPlayerId: string;
    responderPlayerId: string;
    jackSuit: Suit;
  } | null;
  aceResponse: {
    acePlayerId: string;
    responderPlayerId: string;
    aceSuit: Suit;
    chosenSuit: Suit;
  } | null;

  // Game result
  winnerId: string | null;

  // Turn tracking
  turnNumber: number;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Type guard to check if a message is a client message
 */
export function isClientMessage(msg: unknown): msg is ClientMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const { type } = msg as { type?: string };
  return [
    "join",
    "set_name",
    "configure_game",
    "start_game",
    "play_action",
    "leave",
    "kick_player",
    "add_ai",
    "remove_ai",
  ].includes(type ?? "");
}

/**
 * Type guard to check if a message is a server message
 */
export function isServerMessage(msg: unknown): msg is ServerMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const { type } = msg as { type?: string };
  return [
    "room_state",
    "join_success",
    "player_joined",
    "player_left",
    "player_updated",
    "game_started",
    "game_state",
    "state_update",
    "game_ended",
    "error",
    "timer_update",
  ].includes(type ?? "");
}

/**
 * Parse a JSON message string into a typed message
 */
export function parseMessage(data: string): ClientMessage | ServerMessage | null {
  try {
    const msg = JSON.parse(data);
    if (isClientMessage(msg) || isServerMessage(msg)) {
      return msg;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Serialize a message to JSON string
 */
export function serializeMessage(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg);
}
