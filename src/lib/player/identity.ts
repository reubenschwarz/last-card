/**
 * Player Identity Management
 * Handles anonymous player identification for multiplayer games.
 * - Generates unique player IDs on first visit
 * - Manages display names
 * - Persists to localStorage
 */

"use client";

import { useState, useEffect, useCallback } from "react";

// localStorage keys
const PLAYER_ID_KEY = "lastcard_player_id";
const DISPLAY_NAME_KEY = "lastcard_display_name";

// Player ID format: 12 character alphanumeric string
const ID_LENGTH = 12;
const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export interface PlayerIdentity {
  playerId: string;
  displayName: string | null;
}

/**
 * Generate a random player ID
 */
function generatePlayerId(): string {
  let id = "";
  const array = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(array);
  for (let i = 0; i < ID_LENGTH; i++) {
    id += ID_CHARS[array[i] % ID_CHARS.length];
  }
  return id;
}

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const test = "__storage_test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the player ID, generating one if it doesn't exist.
 * Returns null if localStorage is unavailable (SSR or privacy mode).
 */
export function getPlayerId(): string | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  let playerId = localStorage.getItem(PLAYER_ID_KEY);
  if (!playerId) {
    playerId = generatePlayerId();
    localStorage.setItem(PLAYER_ID_KEY, playerId);
  }
  return playerId;
}

/**
 * Get the stored display name.
 * Returns null if not set or localStorage unavailable.
 */
export function getDisplayName(): string | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }
  return localStorage.getItem(DISPLAY_NAME_KEY);
}

/**
 * Set the display name.
 * Returns false if localStorage is unavailable.
 */
export function setDisplayName(name: string): boolean {
  if (!isLocalStorageAvailable()) {
    return false;
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return false;
  }

  localStorage.setItem(DISPLAY_NAME_KEY, trimmed);
  return true;
}

/**
 * Check if the player has set a display name.
 */
export function hasDisplayName(): boolean {
  const name = getDisplayName();
  return name !== null && name.trim().length > 0;
}

/**
 * Get the full player identity (ID + display name).
 * Creates a player ID if one doesn't exist.
 */
export function getPlayerIdentity(): PlayerIdentity | null {
  const playerId = getPlayerId();
  if (!playerId) {
    return null;
  }

  return {
    playerId,
    displayName: getDisplayName(),
  };
}

/**
 * Clear the player identity (useful for testing or "forget me" feature).
 */
export function clearPlayerIdentity(): void {
  if (!isLocalStorageAvailable()) {
    return;
  }
  localStorage.removeItem(PLAYER_ID_KEY);
  localStorage.removeItem(DISPLAY_NAME_KEY);
}

/**
 * Validate a display name.
 * Rules:
 * - Must be 1-20 characters after trimming
 * - Cannot be empty or whitespace only
 */
export function isValidDisplayName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 20;
}

/**
 * Display name validation error messages
 */
export function getDisplayNameError(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return "Display name is required";
  }
  if (trimmed.length > 20) {
    return "Display name must be 20 characters or less";
  }
  return null;
}

// =============================================================================
// React Hooks
// =============================================================================

export interface UsePlayerIdentityResult {
  /** The player's unique ID (null during SSR or if localStorage unavailable) */
  playerId: string | null;
  /** The player's display name (null if not set) */
  displayName: string | null;
  /** Whether the identity has loaded from localStorage */
  isLoaded: boolean;
  /** Whether the player needs to set a display name */
  needsDisplayName: boolean;
  /** Update the display name */
  updateDisplayName: (name: string) => boolean;
  /** Clear the stored identity */
  clearIdentity: () => void;
}

/**
 * React hook for accessing and managing player identity.
 * Handles SSR safely by only accessing localStorage after mount.
 */
export function usePlayerIdentity(): UsePlayerIdentityResult {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [displayName, setDisplayNameState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load identity from localStorage on mount
  useEffect(() => {
    const id = getPlayerId();
    const name = getDisplayName();
    setPlayerId(id);
    setDisplayNameState(name);
    setIsLoaded(true);
  }, []);

  const updateDisplayName = useCallback((name: string): boolean => {
    if (!isValidDisplayName(name)) {
      return false;
    }
    const success = setDisplayName(name);
    if (success) {
      setDisplayNameState(name.trim());
    }
    return success;
  }, []);

  const clearIdentity = useCallback(() => {
    clearPlayerIdentity();
    setPlayerId(null);
    setDisplayNameState(null);
  }, []);

  return {
    playerId,
    displayName,
    isLoaded,
    needsDisplayName: isLoaded && !displayName,
    updateDisplayName,
    clearIdentity,
  };
}
