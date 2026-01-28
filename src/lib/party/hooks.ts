/**
 * Partykit Client Hooks
 *
 * React hooks for managing WebSocket connections to the Partykit game server.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import PartySocket from "partysocket";
import type {
  ServerMessage,
  ClientMessage,
  ClientGameState,
  PublicPlayer,
  LobbyConfig,
  RoomStatus,
  GameAction,
} from "./messages";
import { parseMessage, serializeMessage } from "./messages";

// =============================================================================
// Configuration
// =============================================================================

const PARTYKIT_HOST =
  process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";

// =============================================================================
// Connection Status Types
// =============================================================================

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

// =============================================================================
// usePartySocket - Low-level connection management
// =============================================================================

export interface UsePartySocketOptions {
  /** Room code to connect to */
  roomCode: string;
  /** Callback when a message is received */
  onMessage?: (message: ServerMessage) => void;
  /** Callback when connection status changes */
  onStatusChange?: (status: ConnectionStatus) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /** Whether to automatically connect (default: true) */
  autoConnect?: boolean;
}

export interface UsePartySocketResult {
  /** Current connection status */
  status: ConnectionStatus;
  /** Send a message to the server */
  send: (message: ClientMessage) => void;
  /** Manually connect to the server */
  connect: () => void;
  /** Manually disconnect from the server */
  disconnect: () => void;
  /** The underlying PartySocket instance (for advanced use) */
  socket: PartySocket | null;
}

/**
 * Low-level hook for managing a PartySocket connection.
 * Handles connection lifecycle, reconnection, and message sending.
 */
export function usePartySocket(
  options: UsePartySocketOptions
): UsePartySocketResult {
  const { roomCode, onMessage, onStatusChange, onError, autoConnect = true } = options;

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const socketRef = useRef<PartySocket | null>(null);
  const reconnectAttemptRef = useRef(0);

  // Update status and notify callback
  const updateStatus = useCallback(
    (newStatus: ConnectionStatus) => {
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    },
    [onStatusChange]
  );

  // Create and connect the socket
  const connect = useCallback(() => {
    if (socketRef.current) {
      return; // Already connected or connecting
    }

    updateStatus("connecting");

    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomCode,
    });

    socket.addEventListener("open", () => {
      reconnectAttemptRef.current = 0;
      updateStatus("connected");
    });

    socket.addEventListener("message", (event) => {
      const message = parseMessage(event.data);
      if (message && "type" in message) {
        // Only pass server messages to the callback
        if (
          [
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
          ].includes(message.type)
        ) {
          onMessage?.(message as ServerMessage);
        }
      }
    });

    socket.addEventListener("close", () => {
      // PartySocket handles reconnection automatically
      if (reconnectAttemptRef.current > 0) {
        updateStatus("reconnecting");
      } else {
        updateStatus("disconnected");
      }
      reconnectAttemptRef.current++;
    });

    socket.addEventListener("error", () => {
      const error = new Error("WebSocket connection error");
      onError?.(error);
      updateStatus("error");
    });

    socketRef.current = socket;
  }, [roomCode, onMessage, onError, updateStatus]);

  // Disconnect the socket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
      updateStatus("disconnected");
    }
  }, [updateStatus]);

  // Send a message
  const send = useCallback((message: ClientMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(serializeMessage(message));
    }
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Reconnect if room code changes
  useEffect(() => {
    if (socketRef.current && autoConnect) {
      disconnect();
      connect();
    }
  }, [roomCode, autoConnect, connect, disconnect]);

  return {
    status,
    send,
    connect,
    disconnect,
    socket: socketRef.current,
  };
}

// =============================================================================
// useGameRoom - High-level game room state and actions
// =============================================================================

export interface GameRoomState {
  /** Room code */
  code: string;
  /** Room status */
  status: RoomStatus;
  /** Players in the room */
  players: PublicPlayer[];
  /** Host player ID */
  hostId: string | null;
  /** Lobby configuration */
  config: LobbyConfig;
  /** Current player's ID (after joining) */
  myPlayerId: string | null;
  /** Whether current player is host */
  isHost: boolean;
  /** Game state (when playing) */
  gameState: ClientGameState | null;
  /** Last error message */
  error: string | null;
}

export interface UseGameRoomOptions {
  /** Room code to connect to */
  roomCode: string;
  /** Player ID (from identity system) */
  playerId: string;
  /** Player display name */
  displayName: string;
  /** Auto-join on connect (default: true) */
  autoJoin?: boolean;
}

export interface UseGameRoomResult {
  /** Connection status */
  connectionStatus: ConnectionStatus;
  /** Room state */
  room: GameRoomState;
  /** Join the room */
  join: () => void;
  /** Leave the room */
  leave: () => void;
  /** Update display name */
  setName: (name: string) => void;
  /** Configure game settings (host only) */
  configureGame: (config: Partial<LobbyConfig>) => void;
  /** Start the game (host only) */
  startGame: () => void;
  /** Add an AI player (host only) */
  addAI: () => void;
  /** Remove an AI player (host only) */
  removeAI: (aiPlayerId: string) => void;
  /** Kick a player (host only) */
  kickPlayer: (playerId: string) => void;
  /** Perform a game action */
  playAction: (action: GameAction) => void;
  /** Clear the current error */
  clearError: () => void;
}

const initialRoomState: GameRoomState = {
  code: "",
  status: "lobby",
  players: [],
  hostId: null,
  config: {
    maxPlayers: 4,
    aiSlots: 0,
    isPublic: false,
  },
  myPlayerId: null,
  isHost: false,
  gameState: null,
  error: null,
};

/**
 * High-level hook for managing a game room.
 * Provides room state, game state, and action methods.
 */
export function useGameRoom(options: UseGameRoomOptions): UseGameRoomResult {
  const { roomCode, playerId, displayName, autoJoin = true } = options;

  const [room, setRoom] = useState<GameRoomState>({
    ...initialRoomState,
    code: roomCode,
  });

  // Handle incoming messages
  const handleMessage = useCallback(
    (message: ServerMessage) => {
      switch (message.type) {
        case "room_state":
          setRoom((prev) => ({
            ...prev,
            code: message.payload.code,
            status: message.payload.status,
            players: message.payload.players,
            hostId: message.payload.hostId,
            config: message.payload.config,
            isHost: message.payload.hostId === prev.myPlayerId,
          }));
          break;

        case "join_success":
          setRoom((prev) => ({
            ...prev,
            myPlayerId: message.payload.playerId,
            isHost: message.payload.isHost,
            error: null,
          }));
          break;

        case "player_joined":
          setRoom((prev) => ({
            ...prev,
            players: message.payload.players,
            hostId: message.payload.hostId,
            isHost: message.payload.hostId === prev.myPlayerId,
          }));
          break;

        case "player_left":
          setRoom((prev) => ({
            ...prev,
            players: prev.players.filter(
              (p) => p.id !== message.payload.playerId
            ),
            hostId: message.payload.newHostId,
            isHost: message.payload.newHostId === prev.myPlayerId,
          }));
          break;

        case "player_updated":
          setRoom((prev) => ({
            ...prev,
            players: prev.players.map((p) =>
              p.id === message.payload.playerId
                ? {
                    ...p,
                    name: message.payload.name ?? p.name,
                    isConnected: message.payload.isConnected ?? p.isConnected,
                  }
                : p
            ),
          }));
          break;

        case "game_started":
          setRoom((prev) => ({
            ...prev,
            status: "playing",
            gameState: message.payload.gameState,
          }));
          break;

        case "game_state":
          setRoom((prev) => ({
            ...prev,
            gameState: message.payload.gameState,
          }));
          break;

        case "state_update":
          setRoom((prev) => ({
            ...prev,
            gameState: message.payload.gameState,
          }));
          break;

        case "game_ended":
          setRoom((prev) => ({
            ...prev,
            status: "ended",
            gameState: message.payload.finalState,
          }));
          break;

        case "error":
          setRoom((prev) => ({
            ...prev,
            error: message.payload.message,
          }));
          break;

        case "timer_update":
          // Timer updates could be stored in room state if needed
          break;
      }
    },
    []
  );

  // Set up socket connection
  const { status: connectionStatus, send } = usePartySocket({
    roomCode,
    onMessage: handleMessage,
    autoConnect: true,
  });

  // Join the room
  const join = useCallback(() => {
    send({
      type: "join",
      payload: {
        playerId,
        name: displayName,
      },
    });
  }, [send, playerId, displayName]);

  // Auto-join when connected
  useEffect(() => {
    if (connectionStatus === "connected" && autoJoin && !room.myPlayerId) {
      join();
    }
  }, [connectionStatus, autoJoin, room.myPlayerId, join]);

  // Leave the room
  const leave = useCallback(() => {
    send({
      type: "leave",
      payload: {},
    });
    setRoom((prev) => ({
      ...prev,
      myPlayerId: null,
      isHost: false,
    }));
  }, [send]);

  // Update display name
  const setName = useCallback(
    (name: string) => {
      send({
        type: "set_name",
        payload: { name },
      });
    },
    [send]
  );

  // Configure game settings
  const configureGame = useCallback(
    (config: Partial<LobbyConfig>) => {
      send({
        type: "configure_game",
        payload: config,
      });
    },
    [send]
  );

  // Start the game
  const startGame = useCallback(() => {
    send({
      type: "start_game",
      payload: {},
    });
  }, [send]);

  // Add an AI player
  const addAI = useCallback(() => {
    send({
      type: "add_ai",
      payload: {},
    });
  }, [send]);

  // Remove an AI player
  const removeAI = useCallback(
    (aiPlayerId: string) => {
      send({
        type: "remove_ai",
        payload: { aiPlayerId },
      });
    },
    [send]
  );

  // Kick a player
  const kickPlayer = useCallback(
    (targetPlayerId: string) => {
      send({
        type: "kick_player",
        payload: { playerId: targetPlayerId },
      });
    },
    [send]
  );

  // Perform a game action
  const playAction = useCallback(
    (action: GameAction) => {
      send({
        type: "play_action",
        payload: action,
      });
    },
    [send]
  );

  // Clear error
  const clearError = useCallback(() => {
    setRoom((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    connectionStatus,
    room,
    join,
    leave,
    setName,
    configureGame,
    startGame,
    addAI,
    removeAI,
    kickPlayer,
    playAction,
    clearError,
  };
}
