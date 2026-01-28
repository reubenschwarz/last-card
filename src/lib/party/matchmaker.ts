/**
 * Matchmaker Client API
 *
 * Functions for interacting with the matchmaker server for Quick Play.
 */

const MATCHMAKER_ROOM_ID = "global";

/**
 * Get the matchmaker URL based on environment
 */
function getMatchmakerUrl(): string {
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}/parties/matchmaker/${MATCHMAKER_ROOM_ID}`;
}

/**
 * Response from finding a room
 */
export interface FindRoomResponse {
  found: boolean;
  room: {
    code: string;
    playerCount: number;
    maxPlayers: number;
  } | null;
}

/**
 * Response from listing rooms
 */
export interface ListRoomsResponse {
  count: number;
  rooms: {
    code: string;
    playerCount: number;
    maxPlayers: number;
  }[];
}

/**
 * Find an available room for Quick Play.
 * Returns null if no rooms are available.
 */
export async function findAvailableRoom(): Promise<FindRoomResponse["room"]> {
  try {
    const url = `${getMatchmakerUrl()}/find`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error("[Matchmaker] Failed to find room:", response.statusText);
      return null;
    }

    const data = (await response.json()) as FindRoomResponse;
    return data.room;
  } catch (error) {
    console.error("[Matchmaker] Error finding room:", error);
    return null;
  }
}

/**
 * List all available rooms (for debugging/admin).
 */
export async function listAvailableRooms(): Promise<ListRoomsResponse["rooms"]> {
  try {
    const url = `${getMatchmakerUrl()}/list`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error("[Matchmaker] Failed to list rooms:", response.statusText);
      return [];
    }

    const data = (await response.json()) as ListRoomsResponse;
    return data.rooms;
  } catch (error) {
    console.error("[Matchmaker] Error listing rooms:", error);
    return [];
  }
}
