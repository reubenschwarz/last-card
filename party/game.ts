import type * as Party from "partykit/server";

/**
 * Player connection info stored in room state
 */
interface ConnectedPlayer {
  id: string;
  name: string;
  connectionId: string;
  joinedAt: number;
}

/**
 * Room state for a game lobby/session
 */
interface RoomState {
  code: string;
  players: ConnectedPlayer[];
  hostId: string | null;
  status: "lobby" | "playing" | "ended";
  createdAt: number;
}

/**
 * Last Card Game Room Server
 *
 * Handles WebSocket connections for multiplayer game rooms.
 * Each room is identified by a short code (the party room ID).
 */
export default class GameRoom implements Party.Server {
  // Room state - persisted in memory for the lifetime of the room
  state: RoomState;

  constructor(readonly room: Party.Room) {
    // Initialize room state
    this.state = {
      code: room.id,
      players: [],
      hostId: null,
      status: "lobby",
      createdAt: Date.now(),
    };
  }

  /**
   * Handle new WebSocket connection
   */
  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`[${this.state.code}] Connection: ${conn.id}`);

    // Send current room state to the new connection
    conn.send(
      JSON.stringify({
        type: "room_state",
        payload: {
          code: this.state.code,
          players: this.state.players.map((p) => ({
            id: p.id,
            name: p.name,
          })),
          hostId: this.state.hostId,
          status: this.state.status,
        },
      })
    );
  }

  /**
   * Handle WebSocket disconnection
   */
  onClose(conn: Party.Connection) {
    console.log(`[${this.state.code}] Disconnection: ${conn.id}`);

    // Find and remove the player
    const playerIndex = this.state.players.findIndex(
      (p) => p.connectionId === conn.id
    );

    if (playerIndex !== -1) {
      const player = this.state.players[playerIndex];
      this.state.players.splice(playerIndex, 1);

      // If host left, assign new host
      if (this.state.hostId === player.id && this.state.players.length > 0) {
        this.state.hostId = this.state.players[0].id;
      }

      // Broadcast player left
      this.broadcast(
        JSON.stringify({
          type: "player_left",
          payload: {
            playerId: player.id,
            playerName: player.name,
            newHostId: this.state.hostId,
          },
        })
      );
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message);
      const { type, payload } = data;

      switch (type) {
        case "join":
          this.handleJoin(sender, payload);
          break;

        case "set_name":
          this.handleSetName(sender, payload);
          break;

        case "leave":
          this.handleLeave(sender);
          break;

        default:
          // Unknown message type - will be handled by game logic in future
          console.log(`[${this.state.code}] Unknown message type: ${type}`);
          break;
      }
    } catch (error) {
      console.error(`[${this.state.code}] Error processing message:`, error);
      sender.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Invalid message format" },
        })
      );
    }
  }

  /**
   * Handle player join request
   */
  private handleJoin(
    conn: Party.Connection,
    payload: { playerId: string; name: string }
  ) {
    const { playerId, name } = payload;

    // Check if player already exists (reconnection)
    const existingPlayer = this.state.players.find((p) => p.id === playerId);
    if (existingPlayer) {
      // Update connection ID for reconnection
      existingPlayer.connectionId = conn.id;
      conn.send(
        JSON.stringify({
          type: "join_success",
          payload: {
            playerId,
            isHost: this.state.hostId === playerId,
            reconnected: true,
          },
        })
      );
      return;
    }

    // Check room capacity (max 4 players)
    if (this.state.players.length >= 4) {
      conn.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Room is full" },
        })
      );
      return;
    }

    // Check if game already started
    if (this.state.status === "playing") {
      conn.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Game already in progress" },
        })
      );
      return;
    }

    // Add new player
    const newPlayer: ConnectedPlayer = {
      id: playerId,
      name: name || `Player ${this.state.players.length + 1}`,
      connectionId: conn.id,
      joinedAt: Date.now(),
    };

    this.state.players.push(newPlayer);

    // First player becomes host
    if (this.state.players.length === 1) {
      this.state.hostId = playerId;
    }

    // Confirm join to the player
    conn.send(
      JSON.stringify({
        type: "join_success",
        payload: {
          playerId,
          isHost: this.state.hostId === playerId,
          reconnected: false,
        },
      })
    );

    // Broadcast to all players
    this.broadcast(
      JSON.stringify({
        type: "player_joined",
        payload: {
          player: { id: playerId, name: newPlayer.name },
          players: this.state.players.map((p) => ({ id: p.id, name: p.name })),
          hostId: this.state.hostId,
        },
      })
    );
  }

  /**
   * Handle player name change
   */
  private handleSetName(conn: Party.Connection, payload: { name: string }) {
    const player = this.state.players.find((p) => p.connectionId === conn.id);
    if (!player) return;

    player.name = payload.name;

    // Broadcast name change
    this.broadcast(
      JSON.stringify({
        type: "player_updated",
        payload: {
          playerId: player.id,
          name: player.name,
        },
      })
    );
  }

  /**
   * Handle player leave request
   */
  private handleLeave(conn: Party.Connection) {
    // Trigger the same logic as disconnect
    this.onClose(conn);
    conn.close();
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: string, exclude?: string[]) {
    for (const player of this.state.players) {
      if (exclude?.includes(player.connectionId)) continue;

      const conn = this.room.getConnection(player.connectionId);
      if (conn) {
        conn.send(message);
      }
    }
  }
}
