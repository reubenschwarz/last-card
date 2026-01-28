import type * as Party from "partykit/server";

/**
 * Open room entry in the matchmaker
 */
interface OpenRoom {
  code: string;
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
  lastUpdated: number;
}

/**
 * Matchmaker Server
 *
 * Tracks open game rooms for Quick Play functionality.
 * Game rooms register/unregister themselves via HTTP API.
 * Clients query for available rooms.
 */
export default class Matchmaker implements Party.Server {
  /** Map of room code to room info */
  openRooms: Map<string, OpenRoom> = new Map();

  constructor(readonly room: Party.Room) {}

  /**
   * Handle HTTP requests for matchmaking
   */
  async onRequest(req: Party.Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // CORS headers for browser requests
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      switch (path) {
        case "register":
          return this.handleRegister(req, corsHeaders);

        case "unregister":
          return this.handleUnregister(req, corsHeaders);

        case "find":
          return this.handleFind(corsHeaders);

        case "list":
          return this.handleList(corsHeaders);

        default:
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
      }
    } catch (error) {
      console.error("[Matchmaker] Error:", error);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  /**
   * Register or update an open room
   * POST /register { code, playerCount, maxPlayers }
   */
  private async handleRegister(
    req: Party.Request,
    corsHeaders: Record<string, string>
  ): Promise<Response> {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as {
      code: string;
      playerCount: number;
      maxPlayers: number;
    };

    const { code, playerCount, maxPlayers } = body;

    if (!code || typeof playerCount !== "number" || typeof maxPlayers !== "number") {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only register if room has space
    if (playerCount >= maxPlayers) {
      // Room is full, remove from open rooms
      this.openRooms.delete(code);
      return new Response(JSON.stringify({ success: true, registered: false, reason: "full" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existing = this.openRooms.get(code);
    const now = Date.now();

    this.openRooms.set(code, {
      code,
      playerCount,
      maxPlayers,
      createdAt: existing?.createdAt ?? now,
      lastUpdated: now,
    });

    console.log(`[Matchmaker] Registered room ${code} (${playerCount}/${maxPlayers})`);

    return new Response(JSON.stringify({ success: true, registered: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  /**
   * Unregister a room (game started or closed)
   * POST /unregister { code }
   */
  private async handleUnregister(
    req: Party.Request,
    corsHeaders: Record<string, string>
  ): Promise<Response> {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as { code: string };
    const { code } = body;

    if (!code) {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existed = this.openRooms.delete(code);
    console.log(`[Matchmaker] Unregistered room ${code} (existed: ${existed})`);

    return new Response(JSON.stringify({ success: true, existed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  /**
   * Find a random open room
   * GET /find
   */
  private handleFind(corsHeaders: Record<string, string>): Response {
    // Clean up stale rooms (not updated in 60 seconds)
    const now = Date.now();
    const staleThreshold = 60 * 1000;

    for (const [code, room] of this.openRooms) {
      if (now - room.lastUpdated > staleThreshold) {
        this.openRooms.delete(code);
        console.log(`[Matchmaker] Removed stale room ${code}`);
      }
    }

    // Get available rooms (have space for at least 1 player)
    const availableRooms = Array.from(this.openRooms.values()).filter(
      (room) => room.playerCount < room.maxPlayers
    );

    if (availableRooms.length === 0) {
      return new Response(JSON.stringify({ found: false, room: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pick a random room, preferring rooms with more players (more likely to start soon)
    // Simple weighted random: rooms with more players have higher weight
    const weightedRooms: OpenRoom[] = [];
    for (const room of availableRooms) {
      // Weight = playerCount + 1 (so empty rooms still have a chance)
      const weight = room.playerCount + 1;
      for (let i = 0; i < weight; i++) {
        weightedRooms.push(room);
      }
    }

    const selectedRoom = weightedRooms[Math.floor(Math.random() * weightedRooms.length)];

    return new Response(
      JSON.stringify({
        found: true,
        room: {
          code: selectedRoom.code,
          playerCount: selectedRoom.playerCount,
          maxPlayers: selectedRoom.maxPlayers,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  /**
   * List all open rooms (for debugging)
   * GET /list
   */
  private handleList(corsHeaders: Record<string, string>): Response {
    const rooms = Array.from(this.openRooms.values());

    return new Response(
      JSON.stringify({
        count: rooms.length,
        rooms: rooms.map((r) => ({
          code: r.code,
          playerCount: r.playerCount,
          maxPlayers: r.maxPlayers,
        })),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
