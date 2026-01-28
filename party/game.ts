import type * as Party from "partykit/server";

// Import game engine (these will be bundled by partykit)
import {
  initializeGame,
  applyPlay,
  applyDraw,
  applyForcedDraw,
  applyVoluntaryDraw,
  nextTurn,
  confirmHandoff,
  declareLastCard,
  isPlayLegal,
  getLegalPlays,
  getTopCard,
  getTargetSuit,
  applyResolve,
  applyDeflect,
  applyCancel,
  applySevenCancelEffect,
  applySevenCancelLastCard,
  applySevenDisputePlay,
  applySevenDisputeAccept,
  applyJackAccept,
  applyJackCancel,
  applyAceAccept,
  applyAceCancel,
  isInResponsePhase,
  isInSevenDispute,
  isInJackResponse,
  isInAceResponse,
} from "../src/engine/rules";

import type {
  GameState,
  Card,
  Suit,
  Play,
  PlayerType,
} from "../src/engine/types";

import type {
  ClientMessage,
  ServerMessage,
  GameAction,
  ClientGameState,
  ClientPlayerState,
  PublicPlayer,
  LobbyConfig,
  RoomStatus,
} from "../src/lib/party/messages";

// =============================================================================
// Types
// =============================================================================

/**
 * Player in the room (human or AI)
 */
interface RoomPlayer {
  id: string;
  name: string;
  connectionId: string | null; // null for AI players
  isAI: boolean;
  isConnected: boolean;
  joinedAt: number;
  // Maps to game engine player index when game is active
  gameIndex?: number;
  // Disconnection tracking for reconnection grace period
  disconnectedAt?: number;
  // Whether this player was originally human but taken over by AI
  aiTakeover?: boolean;
}

/**
 * Reconnection grace period in milliseconds (30 seconds)
 */
const RECONNECTION_GRACE_PERIOD_MS = 30 * 1000;

/**
 * Turn timer configuration
 */
const TURN_TIMER_MS = 30 * 1000; // 30 seconds for normal turns
const RESPONSE_TIMER_MS = 15 * 1000; // 15 seconds for response phases
const TIMER_WARNING_MS = 10 * 1000; // Warning at 10 seconds remaining
const TIMER_UPDATE_INTERVAL_MS = 1000; // Send updates every second

/**
 * Active timer state
 */
interface TimerState {
  playerId: string;
  playerIndex: number;
  startedAt: number;
  durationMs: number;
  phase: "turn" | "response";
  timeoutId: ReturnType<typeof setTimeout> | null;
  intervalId: ReturnType<typeof setInterval> | null;
}

/**
 * Full room state
 */
interface RoomState {
  code: string;
  players: RoomPlayer[];
  hostId: string | null;
  status: RoomStatus;
  config: LobbyConfig;
  createdAt: number;
  // Game state (only set when status === "playing")
  gameState: GameState | null;
  // Map player IDs to game indices
  playerIdToIndex: Map<string, number>;
  indexToPlayerId: Map<number, string>;
  // Turn timer state
  timer: TimerState | null;
}

// =============================================================================
// Game Room Server
// =============================================================================

/**
 * Last Card Game Room Server
 *
 * Handles WebSocket connections for multiplayer game rooms.
 * Manages lobby, game state, and AI players.
 */
export default class GameRoom implements Party.Server {
  state: RoomState;

  constructor(readonly room: Party.Room) {
    this.state = {
      code: room.id,
      players: [],
      hostId: null,
      status: "lobby",
      config: {
        maxPlayers: 4,
        aiSlots: 0,
        isPublic: true,
      },
      timer: null,
      createdAt: Date.now(),
      gameState: null,
      playerIdToIndex: new Map(),
      indexToPlayerId: new Map(),
    };
  }

  // ===========================================================================
  // Connection Handlers
  // ===========================================================================

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`[${this.state.code}] Connection: ${conn.id}`);
    this.sendRoomState(conn);
  }

  onClose(conn: Party.Connection) {
    console.log(`[${this.state.code}] Disconnection: ${conn.id}`);

    const player = this.state.players.find((p) => p.connectionId === conn.id);
    if (!player) return;

    if (this.state.status === "lobby") {
      // In lobby: remove the player
      this.removePlayer(player.id, "disconnected");
    } else {
      // In game: mark as disconnected but keep in game
      player.isConnected = false;
      player.connectionId = null;
      player.disconnectedAt = Date.now();

      this.broadcastPlayerUpdate(player.id, { isConnected: false });

      // Start reconnection timer - AI takes over after grace period
      this.startReconnectionTimer(player.id);
    }
  }

  /**
   * Start a timer for player reconnection.
   * If they don't reconnect within the grace period, AI takes over.
   */
  private startReconnectionTimer(playerId: string) {
    setTimeout(() => {
      const player = this.state.players.find((p) => p.id === playerId);
      if (!player) return;

      // Check if still disconnected
      if (!player.isConnected && !player.aiTakeover) {
        console.log(`[${this.state.code}] Player ${playerId} timed out, AI takeover`);
        this.handleAITakeover(playerId);
      }
    }, RECONNECTION_GRACE_PERIOD_MS);
  }

  /**
   * Convert a disconnected human player to AI control.
   */
  private handleAITakeover(playerId: string) {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player || player.isConnected) return;

    // Mark as AI takeover (original player can still reconnect and reclaim)
    player.aiTakeover = true;

    // Notify other players
    this.broadcast({
      type: "player_updated",
      payload: {
        playerId,
        isConnected: false,
        // Client can use this to show "AI takeover" indicator
      },
    });

    // If it's this player's turn, execute AI action
    if (this.state.status === "playing" && this.state.gameState) {
      this.checkAndExecuteAITurn();
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message) as ClientMessage;
      this.handleMessage(data, sender);
    } catch (error) {
      console.error(`[${this.state.code}] Error processing message:`, error);
      this.sendError(sender, "Invalid message format");
    }
  }

  // ===========================================================================
  // Message Router
  // ===========================================================================

  private handleMessage(msg: ClientMessage, conn: Party.Connection) {
    switch (msg.type) {
      case "join":
        this.handleJoin(conn, msg.payload);
        break;
      case "set_name":
        this.handleSetName(conn, msg.payload);
        break;
      case "configure_game":
        this.handleConfigureGame(conn, msg.payload);
        break;
      case "start_game":
        this.handleStartGame(conn);
        break;
      case "play_action":
        this.handlePlayAction(conn, msg.payload);
        break;
      case "leave":
        this.handleLeave(conn);
        break;
      case "kick_player":
        this.handleKickPlayer(conn, msg.payload);
        break;
      case "add_ai":
        this.handleAddAI(conn);
        break;
      case "remove_ai":
        this.handleRemoveAI(conn, msg.payload);
        break;
      default:
        console.log(`[${this.state.code}] Unknown message type`);
    }
  }

  // ===========================================================================
  // Lobby Handlers
  // ===========================================================================

  private handleJoin(
    conn: Party.Connection,
    payload: { playerId: string; name: string }
  ) {
    const { playerId, name } = payload;

    // Check for reconnection
    const existingPlayer = this.state.players.find((p) => p.id === playerId);
    if (existingPlayer) {
      const wasAITakeover = existingPlayer.aiTakeover;

      existingPlayer.connectionId = conn.id;
      existingPlayer.isConnected = true;
      existingPlayer.disconnectedAt = undefined;
      existingPlayer.aiTakeover = false; // Reclaim from AI

      console.log(`[${this.state.code}] Player ${playerId} reconnected${wasAITakeover ? ' (reclaimed from AI)' : ''}`);

      this.send(conn, {
        type: "join_success",
        payload: {
          playerId,
          isHost: this.state.hostId === playerId,
          reconnected: true,
        },
      });

      // Send current room state
      this.sendRoomState(conn);

      // Send current game state if in game
      if (this.state.status === "playing" && this.state.gameState) {
        this.sendGameState(conn, playerId);
      }

      this.broadcastPlayerUpdate(playerId, { isConnected: true });
      return;
    }

    // Check capacity
    const humanCount = this.state.players.filter((p) => !p.isAI).length;
    if (humanCount >= this.state.config.maxPlayers) {
      this.sendError(conn, "Room is full");
      return;
    }

    // Check if game started
    if (this.state.status === "playing") {
      this.sendError(conn, "Game already in progress");
      return;
    }

    // Add new player
    const newPlayer: RoomPlayer = {
      id: playerId,
      name: name || `Player ${this.state.players.length + 1}`,
      connectionId: conn.id,
      isAI: false,
      isConnected: true,
      joinedAt: Date.now(),
    };

    this.state.players.push(newPlayer);

    // First player becomes host
    if (!this.state.hostId) {
      this.state.hostId = playerId;
    }

    this.send(conn, {
      type: "join_success",
      payload: {
        playerId,
        isHost: this.state.hostId === playerId,
        reconnected: false,
      },
    });

    this.broadcast({
      type: "player_joined",
      payload: {
        player: this.toPublicPlayer(newPlayer),
        players: this.state.players.map((p) => this.toPublicPlayer(p)),
        hostId: this.state.hostId,
      },
    });
  }

  private handleSetName(conn: Party.Connection, payload: { name: string }) {
    const player = this.getPlayerByConnection(conn);
    if (!player) return;

    player.name = payload.name;
    this.broadcastPlayerUpdate(player.id, { name: player.name });
  }

  private handleConfigureGame(
    conn: Party.Connection,
    payload: Partial<LobbyConfig>
  ) {
    const player = this.getPlayerByConnection(conn);
    if (!player || player.id !== this.state.hostId) {
      this.sendError(conn, "Only host can configure game");
      return;
    }

    if (this.state.status !== "lobby") {
      this.sendError(conn, "Cannot configure during game");
      return;
    }

    // Update config
    if (payload.maxPlayers !== undefined) {
      this.state.config.maxPlayers = payload.maxPlayers;
    }
    if (payload.aiSlots !== undefined) {
      this.state.config.aiSlots = payload.aiSlots;
    }
    if (payload.isPublic !== undefined) {
      this.state.config.isPublic = payload.isPublic;
    }

    // Broadcast updated room state
    this.broadcastRoomState();
  }

  private handleAddAI(conn: Party.Connection) {
    const player = this.getPlayerByConnection(conn);
    if (!player || player.id !== this.state.hostId) {
      this.sendError(conn, "Only host can add AI");
      return;
    }

    if (this.state.status !== "lobby") {
      this.sendError(conn, "Cannot add AI during game");
      return;
    }

    const totalPlayers = this.state.players.length;
    if (totalPlayers >= this.state.config.maxPlayers) {
      this.sendError(conn, "Room is full");
      return;
    }

    const aiCount = this.state.players.filter((p) => p.isAI).length;
    const aiPlayer: RoomPlayer = {
      id: `ai_${Date.now()}_${aiCount}`,
      name: `AI ${aiCount + 1}`,
      connectionId: null,
      isAI: true,
      isConnected: true, // AI is always "connected"
      joinedAt: Date.now(),
    };

    this.state.players.push(aiPlayer);

    this.broadcast({
      type: "player_joined",
      payload: {
        player: this.toPublicPlayer(aiPlayer),
        players: this.state.players.map((p) => this.toPublicPlayer(p)),
        hostId: this.state.hostId,
      },
    });
  }

  private handleRemoveAI(
    conn: Party.Connection,
    payload: { aiPlayerId: string }
  ) {
    const player = this.getPlayerByConnection(conn);
    if (!player || player.id !== this.state.hostId) {
      this.sendError(conn, "Only host can remove AI");
      return;
    }

    const aiPlayer = this.state.players.find(
      (p) => p.id === payload.aiPlayerId && p.isAI
    );
    if (!aiPlayer) {
      this.sendError(conn, "AI player not found");
      return;
    }

    this.removePlayer(aiPlayer.id, "kicked");
  }

  private handleKickPlayer(
    conn: Party.Connection,
    payload: { playerId: string }
  ) {
    const player = this.getPlayerByConnection(conn);
    if (!player || player.id !== this.state.hostId) {
      this.sendError(conn, "Only host can kick players");
      return;
    }

    if (payload.playerId === this.state.hostId) {
      this.sendError(conn, "Cannot kick yourself");
      return;
    }

    this.removePlayer(payload.playerId, "kicked");
  }

  private handleLeave(conn: Party.Connection) {
    const player = this.getPlayerByConnection(conn);
    if (!player) return;

    this.removePlayer(player.id, "left");
    conn.close();
  }

  private removePlayer(
    playerId: string,
    reason: "left" | "kicked" | "disconnected"
  ) {
    const index = this.state.players.findIndex((p) => p.id === playerId);
    if (index === -1) return;

    const player = this.state.players[index];
    this.state.players.splice(index, 1);

    // Reassign host if needed
    let newHostId = this.state.hostId;
    if (this.state.hostId === playerId) {
      const humans = this.state.players.filter((p) => !p.isAI);
      newHostId = humans.length > 0 ? humans[0].id : null;
      this.state.hostId = newHostId;
    }

    this.broadcast({
      type: "player_left",
      payload: {
        playerId,
        playerName: player.name,
        newHostId,
        reason,
      },
    });
  }

  // ===========================================================================
  // Game Start
  // ===========================================================================

  private handleStartGame(conn: Party.Connection) {
    const player = this.getPlayerByConnection(conn);
    if (!player || player.id !== this.state.hostId) {
      this.sendError(conn, "Only host can start game");
      return;
    }

    if (this.state.status !== "lobby") {
      this.sendError(conn, "Game already started");
      return;
    }

    const totalPlayers = this.state.players.length;
    if (totalPlayers < 2) {
      this.sendError(conn, "Need at least 2 players");
      return;
    }

    // Build player type array and ID mappings
    const playerTypes: PlayerType[] = [];
    this.state.playerIdToIndex.clear();
    this.state.indexToPlayerId.clear();

    this.state.players.forEach((p, i) => {
      playerTypes.push(p.isAI ? "ai" : "human");
      this.state.playerIdToIndex.set(p.id, i);
      this.state.indexToPlayerId.set(i, p.id);
      p.gameIndex = i;
    });

    // Initialize game state
    this.state.gameState = initializeGame(totalPlayers, undefined, playerTypes);
    this.state.status = "playing";

    // Auto-confirm handoff for first player (skip waiting phase)
    this.state.gameState = confirmHandoff(this.state.gameState);

    // Broadcast game started with initial state
    this.broadcastGameStarted();

    // If first player is AI, execute their turn, otherwise start timer
    this.checkAndExecuteAITurn();
    this.startTurnTimer();
  }

  // ===========================================================================
  // Game Action Handling
  // ===========================================================================

  private handlePlayAction(conn: Party.Connection, action: GameAction) {
    const player = this.getPlayerByConnection(conn);
    if (!player || !this.state.gameState) {
      this.sendError(conn, "Invalid state");
      return;
    }

    const playerIndex = this.state.playerIdToIndex.get(player.id);
    if (playerIndex === undefined) {
      this.sendError(conn, "Player not in game");
      return;
    }

    // Validate it's this player's turn (or they're the responder)
    if (!this.canPlayerAct(playerIndex)) {
      this.sendError(conn, "Not your turn");
      return;
    }

    // Stop the current timer since player is taking action
    this.stopTimer();

    const result = this.executeAction(playerIndex, action);
    if (!result.success) {
      this.sendError(conn, result.error || "Invalid action");
      // Restart timer if action failed
      this.startTurnTimer();
      return;
    }

    // Broadcast updated state
    this.broadcastStateUpdate(action, player.id);

    // Check for game end
    if (this.state.gameState?.winner !== null) {
      this.handleGameEnd();
      return;
    }

    // Check if AI needs to act, then start timer for next player
    this.checkAndExecuteAITurn();
    this.startTurnTimer();
  }

  private canPlayerAct(playerIndex: number): boolean {
    const gs = this.state.gameState;
    if (!gs) return false;

    // Current player can act
    if (gs.currentPlayerIndex === playerIndex) return true;

    // Responder in response phase
    if (isInResponsePhase(gs) && gs.respondingPlayerIndex === playerIndex) {
      return true;
    }

    // Responder in seven dispute
    if (isInSevenDispute(gs) && gs.sevenDispute?.responderPlayerId === playerIndex) {
      return true;
    }

    // Responder in Jack response
    if (isInJackResponse(gs) && gs.jackResponse?.responderPlayerId === playerIndex) {
      return true;
    }

    // Responder in Ace response
    if (isInAceResponse(gs) && gs.aceResponse?.responderPlayerId === playerIndex) {
      return true;
    }

    return false;
  }

  private executeAction(
    playerIndex: number,
    action: GameAction
  ): { success: boolean; error?: string } {
    let gs = this.state.gameState;
    if (!gs) return { success: false, error: "No game state" };

    try {
      switch (action.action) {
        case "play_cards": {
          const play: Play = {
            cards: action.cards,
            chosenSuit: action.chosenSuit,
            activateEffect: action.activateEffect,
          };
          if (!isPlayLegal(gs, playerIndex, play)) {
            return { success: false, error: "Illegal play" };
          }
          gs = applyPlay(gs, play);

          // Auto-advance turn if no response phase
          if (
            !isInResponsePhase(gs) &&
            !isInJackResponse(gs) &&
            !isInAceResponse(gs) &&
            gs.winner === null
          ) {
            gs = nextTurn(gs);
            gs = confirmHandoff(gs);
          }
          break;
        }

        case "draw": {
          if (gs.pendingEffects.forcedDrawCount > 0 || gs.players[playerIndex].lastCardPenalty) {
            gs = applyForcedDraw(gs);
          } else {
            gs = applyVoluntaryDraw(gs);
          }
          // Auto-advance turn after drawing
          gs = nextTurn(gs);
          gs = confirmHandoff(gs);
          break;
        }

        case "end_turn": {
          gs = nextTurn(gs);
          gs = confirmHandoff(gs);
          break;
        }

        case "declare_last_card": {
          gs = declareLastCard(gs);
          break;
        }

        case "resolve_response": {
          gs = applyResolve(gs);
          gs = confirmHandoff(gs);
          break;
        }

        case "deflect_response": {
          gs = applyDeflect(gs, action.card);
          break;
        }

        case "cancel_response": {
          gs = applyCancel(gs, action.card);
          break;
        }

        case "seven_cancel_effect": {
          gs = applySevenCancelEffect(gs, action.card);
          break;
        }

        case "seven_cancel_last_card": {
          gs = applySevenCancelLastCard(gs, action.card);
          break;
        }

        case "seven_dispute_play": {
          gs = applySevenDisputePlay(gs, action.card);
          break;
        }

        case "seven_dispute_accept": {
          gs = applySevenDisputeAccept(gs);
          if (!isInSevenDispute(gs)) {
            gs = nextTurn(gs);
            gs = confirmHandoff(gs);
          }
          break;
        }

        case "jack_accept": {
          gs = applyJackAccept(gs);
          gs = confirmHandoff(gs);
          break;
        }

        case "jack_cancel": {
          gs = applyJackCancel(gs, action.card);
          gs = confirmHandoff(gs);
          break;
        }

        case "ace_accept": {
          gs = applyAceAccept(gs);
          gs = confirmHandoff(gs);
          break;
        }

        case "ace_cancel": {
          gs = applyAceCancel(gs, action.card);
          break;
        }

        default:
          return { success: false, error: "Unknown action" };
      }

      this.state.gameState = gs;
      return { success: true };
    } catch (error) {
      console.error(`[${this.state.code}] Action error:`, error);
      return { success: false, error: "Action failed" };
    }
  }

  // ===========================================================================
  // AI Logic
  // ===========================================================================

  private checkAndExecuteAITurn() {
    const gs = this.state.gameState;
    if (!gs || gs.winner !== null) return;

    // Determine who needs to act
    let actingIndex: number | null = null;

    if (isInResponsePhase(gs) && gs.respondingPlayerIndex !== null) {
      actingIndex = gs.respondingPlayerIndex;
    } else if (isInSevenDispute(gs) && gs.sevenDispute) {
      actingIndex = gs.sevenDispute.responderPlayerId;
    } else if (isInJackResponse(gs) && gs.jackResponse) {
      actingIndex = gs.jackResponse.responderPlayerId;
    } else if (isInAceResponse(gs) && gs.aceResponse) {
      actingIndex = gs.aceResponse.responderPlayerId;
    } else {
      actingIndex = gs.currentPlayerIndex;
    }

    const actingPlayerId = this.state.indexToPlayerId.get(actingIndex);
    const actingPlayer = this.state.players.find((p) => p.id === actingPlayerId);

    // Execute AI turn if player is AI or has been taken over by AI
    if (!actingPlayer?.isAI && !actingPlayer?.aiTakeover) return;

    // Execute AI turn with a small delay for realism
    setTimeout(() => this.executeAITurn(actingIndex), 500);
  }

  private executeAITurn(playerIndex: number) {
    const gs = this.state.gameState;
    if (!gs || gs.winner !== null) return;

    const playerId = this.state.indexToPlayerId.get(playerIndex);
    if (!playerId) return;

    let action: GameAction | null = null;

    // Handle different game phases
    if (isInResponsePhase(gs) && gs.respondingPlayerIndex === playerIndex) {
      action = this.getAIResponseAction(playerIndex);
    } else if (isInSevenDispute(gs) && gs.sevenDispute?.responderPlayerId === playerIndex) {
      action = { action: "seven_dispute_accept" };
    } else if (isInJackResponse(gs) && gs.jackResponse?.responderPlayerId === playerIndex) {
      action = { action: "jack_accept" };
    } else if (isInAceResponse(gs) && gs.aceResponse?.responderPlayerId === playerIndex) {
      action = { action: "ace_accept" };
    } else if (gs.currentPlayerIndex === playerIndex) {
      action = this.getAINormalAction(playerIndex);
    }

    if (!action) return;

    const result = this.executeAction(playerIndex, action);
    if (result.success) {
      this.broadcastStateUpdate(action, playerId);

      if (this.state.gameState?.winner !== null) {
        this.handleGameEnd();
      } else {
        // Continue checking for AI turns
        this.checkAndExecuteAITurn();
      }
    }
  }

  private getAINormalAction(playerIndex: number): GameAction {
    const gs = this.state.gameState!;
    const player = gs.players[playerIndex];

    // Must draw if forced
    if (gs.pendingEffects.forcedDrawCount > 0 || player.lastCardPenalty) {
      return { action: "draw" };
    }

    // Get legal plays
    const legalPlays = getLegalPlays(gs, playerIndex);

    if (legalPlays.length > 0) {
      // Prefer single card plays
      const singlePlays = legalPlays.filter((lp) => lp.play.cards.length === 1);
      const play = singlePlays.length > 0 ? singlePlays[0].play : legalPlays[0].play;

      return {
        action: "play_cards",
        cards: play.cards,
        chosenSuit: play.chosenSuit,
        activateEffect: play.activateEffect,
      };
    }

    // No legal plays, must draw
    return { action: "draw" };
  }

  private getAIResponseAction(playerIndex: number): GameAction {
    const gs = this.state.gameState!;

    // Simple AI: always resolve (doesn't deflect)
    // Could be enhanced to deflect if AI has matching cards
    return { action: "resolve_response" };
  }

  // ===========================================================================
  // Turn Timer Management
  // ===========================================================================

  /**
   * Start the turn timer for the current active player.
   * Should be called after each state change that passes control to a new player.
   */
  private startTurnTimer() {
    // Clear any existing timer
    this.stopTimer();

    const gs = this.state.gameState;
    if (!gs || gs.winner !== null) return;

    // Determine who needs to act and what phase they're in
    let actingIndex: number;
    let phase: "turn" | "response";

    if (isInResponsePhase(gs) && gs.respondingPlayerIndex !== null) {
      actingIndex = gs.respondingPlayerIndex;
      phase = "response";
    } else if (isInSevenDispute(gs) && gs.sevenDispute) {
      actingIndex = gs.sevenDispute.responderPlayerId;
      phase = "response";
    } else if (isInJackResponse(gs) && gs.jackResponse) {
      actingIndex = gs.jackResponse.responderPlayerId;
      phase = "response";
    } else if (isInAceResponse(gs) && gs.aceResponse) {
      actingIndex = gs.aceResponse.responderPlayerId;
      phase = "response";
    } else {
      actingIndex = gs.currentPlayerIndex;
      phase = "turn";
    }

    const playerId = this.state.indexToPlayerId.get(actingIndex);
    if (!playerId) return;

    const player = this.state.players.find((p) => p.id === playerId);

    // Don't start timer for AI players or disconnected players (AI handles them)
    if (player?.isAI || player?.aiTakeover || !player?.isConnected) return;

    const durationMs = phase === "response" ? RESPONSE_TIMER_MS : TURN_TIMER_MS;
    const startedAt = Date.now();

    // Set up the timer state
    this.state.timer = {
      playerId,
      playerIndex: actingIndex,
      startedAt,
      durationMs,
      phase,
      timeoutId: null,
      intervalId: null,
    };

    // Broadcast initial timer state
    this.broadcastTimerUpdate();

    // Set up interval to broadcast timer updates
    this.state.timer.intervalId = setInterval(() => {
      this.broadcastTimerUpdate();
    }, TIMER_UPDATE_INTERVAL_MS);

    // Set up timeout for auto-action
    this.state.timer.timeoutId = setTimeout(() => {
      this.handleTimerTimeout();
    }, durationMs);

    console.log(`[${this.state.code}] Timer started for player ${playerId} (${phase}, ${durationMs}ms)`);
  }

  /**
   * Stop the current timer.
   */
  private stopTimer() {
    if (!this.state.timer) return;

    if (this.state.timer.timeoutId) {
      clearTimeout(this.state.timer.timeoutId);
    }
    if (this.state.timer.intervalId) {
      clearInterval(this.state.timer.intervalId);
    }

    this.state.timer = null;
  }

  /**
   * Broadcast timer update to all clients.
   */
  private broadcastTimerUpdate() {
    if (!this.state.timer) return;

    const elapsed = Date.now() - this.state.timer.startedAt;
    const remainingMs = Math.max(0, this.state.timer.durationMs - elapsed);

    this.broadcast({
      type: "timer_update",
      payload: {
        playerId: this.state.timer.playerId,
        remainingMs,
        phase: this.state.timer.phase,
      },
    });
  }

  /**
   * Handle timer timeout - execute auto-action for the player.
   */
  private handleTimerTimeout() {
    const timer = this.state.timer;
    if (!timer) return;

    console.log(`[${this.state.code}] Timer expired for player ${timer.playerId}`);

    // Stop the timer
    this.stopTimer();

    const gs = this.state.gameState;
    if (!gs || gs.winner !== null) return;

    // Determine and execute the auto-action based on the game phase
    let action: GameAction;

    if (timer.phase === "response") {
      // For response phases, accept/resolve
      if (isInResponsePhase(gs)) {
        action = { action: "resolve_response" };
      } else if (isInSevenDispute(gs)) {
        action = { action: "seven_dispute_accept" };
      } else if (isInJackResponse(gs)) {
        action = { action: "jack_accept" };
      } else if (isInAceResponse(gs)) {
        action = { action: "ace_accept" };
      } else {
        return; // Unknown state
      }
    } else {
      // For normal turns, draw a card (safest default action)
      action = { action: "draw" };
    }

    // Execute the action
    const result = this.executeAction(timer.playerIndex, action);
    if (result.success) {
      this.broadcastStateUpdate(action, timer.playerId);

      if (this.state.gameState?.winner !== null) {
        this.handleGameEnd();
      } else {
        // Check for AI turn and start next timer
        this.checkAndExecuteAITurn();
        // Start timer for next player (if not AI)
        this.startTurnTimer();
      }
    }
  }

  // ===========================================================================
  // Game End
  // ===========================================================================

  private handleGameEnd() {
    // Stop any active timer
    this.stopTimer();

    const gs = this.state.gameState;
    if (!gs || gs.winner === null) return;

    const winnerId = this.state.indexToPlayerId.get(gs.winner);
    const winner = this.state.players.find((p) => p.id === winnerId);

    this.state.status = "ended";

    this.broadcast({
      type: "game_ended",
      payload: {
        winnerId: winnerId || "",
        winnerName: winner?.name || "Unknown",
        finalState: this.toClientGameState(gs, null),
      },
    });
  }

  // ===========================================================================
  // State Broadcasting
  // ===========================================================================

  private sendRoomState(conn: Party.Connection) {
    this.send(conn, {
      type: "room_state",
      payload: {
        code: this.state.code,
        status: this.state.status,
        players: this.state.players.map((p) => this.toPublicPlayer(p)),
        hostId: this.state.hostId,
        config: this.state.config,
      },
    });
  }

  private broadcastRoomState() {
    this.broadcast({
      type: "room_state",
      payload: {
        code: this.state.code,
        status: this.state.status,
        players: this.state.players.map((p) => this.toPublicPlayer(p)),
        hostId: this.state.hostId,
        config: this.state.config,
      },
    });
  }

  private broadcastPlayerUpdate(
    playerId: string,
    updates: { name?: string; isConnected?: boolean }
  ) {
    this.broadcast({
      type: "player_updated",
      payload: {
        playerId,
        ...updates,
      },
    });
  }

  private broadcastGameStarted() {
    // Send personalized state to each player
    for (const player of this.state.players) {
      if (player.isAI || !player.connectionId) continue;

      const conn = this.room.getConnection(player.connectionId);
      if (!conn) continue;

      this.send(conn, {
        type: "game_started",
        payload: {
          gameState: this.toClientGameState(this.state.gameState!, player.id),
        },
      });
    }
  }

  private broadcastStateUpdate(action: GameAction, actingPlayerId: string) {
    for (const player of this.state.players) {
      if (player.isAI || !player.connectionId) continue;

      const conn = this.room.getConnection(player.connectionId);
      if (!conn) continue;

      this.send(conn, {
        type: "state_update",
        payload: {
          gameState: this.toClientGameState(this.state.gameState!, player.id),
          lastAction: {
            playerId: actingPlayerId,
            action,
          },
        },
      });
    }
  }

  private sendGameState(conn: Party.Connection, playerId: string) {
    if (!this.state.gameState) return;

    this.send(conn, {
      type: "game_state",
      payload: {
        gameState: this.toClientGameState(this.state.gameState, playerId),
      },
    });
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private getPlayerByConnection(conn: Party.Connection): RoomPlayer | undefined {
    return this.state.players.find((p) => p.connectionId === conn.id);
  }

  private toPublicPlayer(player: RoomPlayer): PublicPlayer {
    const gs = this.state.gameState;
    let cardCount: number | undefined;

    if (gs && player.gameIndex !== undefined) {
      cardCount = gs.players[player.gameIndex]?.hand.length;
    }

    return {
      id: player.id,
      name: player.name,
      isHost: player.id === this.state.hostId,
      isConnected: player.isConnected,
      isAI: player.isAI,
      cardCount,
    };
  }

  private toClientGameState(
    gs: GameState,
    viewingPlayerId: string | null
  ): ClientGameState {
    const viewingIndex = viewingPlayerId
      ? this.state.playerIdToIndex.get(viewingPlayerId)
      : undefined;

    const players: ClientPlayerState[] = gs.players.map((p, i) => {
      const roomPlayer = this.state.players.find(
        (rp) => rp.gameIndex === i
      );

      return {
        id: roomPlayer?.id || `player_${i}`,
        name: roomPlayer?.name || `Player ${i + 1}`,
        isAI: roomPlayer?.isAI || false,
        isConnected: roomPlayer?.isConnected || false,
        cardCount: p.hand.length,
        hand: i === viewingIndex ? p.hand : undefined,
        declaredLastCard: p.declaredLastCard,
        lastCardPenalty: p.lastCardPenalty,
      };
    });

    const currentPlayerId =
      this.state.indexToPlayerId.get(gs.currentPlayerIndex) || "";
    const respondingPlayerId = gs.respondingPlayerIndex !== null
      ? this.state.indexToPlayerId.get(gs.respondingPlayerIndex) || null
      : null;

    return {
      players,
      currentPlayerId,
      turnPhase: gs.turnPhase,
      topCard: getTopCard(gs),
      discardPileCount: gs.discardPile.length,
      drawPileCount: gs.drawPile.length,
      effectiveSuit: getTargetSuit(gs),
      pendingEffects: gs.pendingEffects,
      direction: gs.direction,
      responsePhase: gs.responsePhase,
      responseChainRank: gs.responseChainRank,
      respondingPlayerId,
      sevenDispute: gs.sevenDispute,
      lastCardClaim: gs.lastCardClaim
        ? {
            playerId:
              this.state.indexToPlayerId.get(gs.lastCardClaim.playerId) || "",
            turnNumberCreated: gs.lastCardClaim.turnNumberCreated,
          }
        : null,
      jackResponse: gs.jackResponse
        ? {
            jackPlayerId:
              this.state.indexToPlayerId.get(gs.jackResponse.jackPlayerId) || "",
            responderPlayerId:
              this.state.indexToPlayerId.get(gs.jackResponse.responderPlayerId) || "",
            jackSuit: gs.jackResponse.jackSuit,
          }
        : null,
      aceResponse: gs.aceResponse
        ? {
            acePlayerId:
              this.state.indexToPlayerId.get(gs.aceResponse.acePlayerId) || "",
            responderPlayerId:
              this.state.indexToPlayerId.get(gs.aceResponse.responderPlayerId) || "",
            aceSuit: gs.aceResponse.aceSuit,
            chosenSuit: gs.aceResponse.chosenSuit,
          }
        : null,
      winnerId: gs.winner !== null
        ? this.state.indexToPlayerId.get(gs.winner) || null
        : null,
      turnNumber: gs.turnNumber,
    };
  }

  private send(conn: Party.Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  private broadcast(msg: ServerMessage, exclude?: string[]) {
    const data = JSON.stringify(msg);
    for (const player of this.state.players) {
      if (!player.connectionId) continue;
      if (exclude?.includes(player.connectionId)) continue;

      const conn = this.room.getConnection(player.connectionId);
      if (conn) {
        conn.send(data);
      }
    }
  }

  private sendError(conn: Party.Connection, message: string) {
    this.send(conn, {
      type: "error",
      payload: { message },
    });
  }
}
