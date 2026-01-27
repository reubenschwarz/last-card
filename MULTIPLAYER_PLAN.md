# Online Multiplayer Plan

## Overview

Add support for 1-4 players playing Last Card online, with optional AI opponents filling empty slots.

## Decisions

- **Deployment**: Vercel
- **Real-time**: Partykit (handles WebSocket limitations on Vercel)
- **Players**: Anonymous with display names (no accounts)
- **Game discovery**: Short codes for sharing + random matchmaking
- **Persistence**: None needed (games are ephemeral)

## Current State

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **State**: Zustand store wrapping pure game engine
- **Engine**: Framework-agnostic rules in `/src/engine/` (already suitable for server-side use)
- **Multiplayer**: Hotseat only (no networking)
- **Persistence**: None (in-memory only)

## Architecture: Partykit + Vercel

**Why Partykit**:
- Purpose-built for multiplayer games on edge/serverless
- Handles WebSocket connections that Vercel can't
- Free tier sufficient for this project
- Easy integration with Next.js
- Automatic reconnection and room management

---

## Implementation Phases

### Phase 1: Infrastructure Setup

**Goal**: Set up Partykit server and client integration

1. **Add Partykit to project**
   - Install `partykit` and `partysocket`
   - Create `partykit.json` config
   - Set up party server in `/party/` directory

2. **Create game room server** (`/party/game.ts`)
   - Handle connections, disconnections
   - Room = one game session
   - In-memory state (Partykit handles persistence within room lifetime)

3. **Define message protocol**
   - Client → Server: `join`, `setName`, `configureGame`, `startGame`, `playAction`, `leaveGame`
   - Server → Client: `lobby`, `gameState`, `playerJoined`, `playerLeft`, `error`
   - Server → Broadcast: `gameStarted`, `stateUpdate`, `gameEnded`

### Phase 2: Game Session Management

**Goal**: Create, join, and manage game lobbies

1. **Game creation & discovery**
   - Generate short game codes (e.g., 4-char: "ABCD")
   - Three entry points:
     - "Create Game" → generates code, user is host
     - "Join by Code" → enter code to join specific game
     - "Quick Play" → join random open game (or create if none)
   - Games are "open" (joinable) until started or full

2. **Player identification**
   - Single "Display Name" field (required, stored in localStorage)
   - Random player ID generated on first visit (stored in localStorage)
   - No authentication required

3. **Lobby UI**
   - Show game code prominently (easy to share)
   - List connected players with names
   - Host can: set player count (2-4), add AI to empty slots, kick players
   - "Start Game" button (host only, when 2+ players/AI)
   - "Leave" button for non-hosts

### Phase 3: State Synchronization

**Goal**: Keep all clients in sync with authoritative server state

1. **Server-authoritative model**
   - Server runs game engine, validates all moves
   - Clients send intents, server applies and broadcasts results
   - Prevents cheating (can't play cards you don't have)

2. **Client state management**
   - Replace direct `applyPlay()` calls with socket emissions
   - Receive state updates from server
   - Optimistic updates optional (show card played immediately, rollback on reject)

3. **Action validation**
   - Server validates using existing `isPlayLegal()` function
   - Reject invalid moves with error message
   - Handle edge cases (player disconnected during their turn)

### Phase 4: Turn & Timer Management

**Goal**: Handle turn flow in a networked environment

1. **Turn timers**
   - Configurable turn timeout (e.g., 30s, 60s, unlimited)
   - Warning at 10s remaining
   - Auto-action on timeout (draw if possible, else pass/forfeit)

2. **Response phase handling**
   - Shorter timer for response windows (e.g., 15s)
   - "Thinking..." indicator for other players

3. **Disconnection during turn**
   - Grace period for reconnection (e.g., 30s)
   - AI takes over if player doesn't reconnect
   - Or forfeit after grace period

### Phase 5: Reconnection & Recovery

**Goal**: Handle network issues gracefully

1. **Connection state tracking**
   - Detect disconnection (socket close, ping timeout)
   - Show "Reconnecting..." overlay
   - Queue actions during brief disconnections

2. **Session recovery**
   - Store game state server-side with player tokens
   - On reconnect, validate token and restore position
   - Sync full game state to reconnected client

3. **Spectator mode** (optional)
   - Allow additional connections to watch
   - Useful for reconnection edge cases

### Phase 6: Polish & Edge Cases

**Goal**: Production-ready multiplayer

1. **UI/UX improvements**
   - Player avatars/colors
   - Chat or quick emotes
   - Sound effects for remote player actions
   - "Player X is thinking..." indicators

2. **Error handling**
   - Network error recovery
   - Server restart recovery (persist to Redis)
   - Graceful degradation

3. **AI integration**
   - AI runs server-side for empty slots
   - Same logic as current `executeAiTurn()`
   - Configurable AI speed/difficulty

---

## Technical Components

### New Files/Directories

```
party/
└── game.ts                    # Partykit server (game room logic)

src/
├── app/
│   ├── page.tsx               # Update: add multiplayer entry points
│   ├── play/
│   │   └── [code]/
│   │       └── page.tsx       # Game room page (by code)
│   └── lobby/
│       └── page.tsx           # Browse/create games
├── lib/
│   ├── party/
│   │   ├── client.ts          # Partykit client wrapper
│   │   ├── messages.ts        # Message type definitions
│   │   └── hooks.ts           # React hooks (usePartySocket, useGameRoom)
│   └── player/
│       └── identity.ts        # Player ID & name management
├── components/
│   ├── Lobby.tsx              # Game lobby UI (waiting room)
│   ├── MultiplayerSetup.tsx   # Create/Join/QuickPlay screen
│   └── ConnectionStatus.tsx   # Network status indicator
└── store/
    └── multiplayerStore.ts    # Network state (or extend gameStore)

partykit.json                  # Partykit configuration
```

### Dependencies to Add

```json
{
  "partykit": "^0.0.x",
  "partysocket": "^1.x",
  "nanoid": "^5.x"             // For game code generation
}
```

---

## Data Flow

```
┌─────────────┐                            ┌─────────────┐
│   Client A  │ ◄──── WebSocket ─────────► │  Partykit   │
│  (Browser)  │      (partysocket)         │   Room      │
└─────────────┘                            │  "ABCD"     │
                                           │             │
┌─────────────┐                            │  - validate │
│   Client B  │ ◄──── WebSocket ─────────► │  - apply    │
│  (Browser)  │                            │  - broadcast│
└─────────────┘                            │             │
                                           │  GameState  │
┌─────────────┐                            │  stored in  │
│   Client C  │ ◄──── WebSocket ─────────► │  room memory│
│  (Browser)  │                            └─────────────┘
└─────────────┘

Room lifecycle:
- Created when first player connects with code
- Destroyed when all players leave or game ends + timeout
```

---

## Estimated Complexity

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| 1. Infrastructure | Medium | None |
| 2. Session Management | Medium | Phase 1 |
| 3. State Sync | High | Phase 1, 2 |
| 4. Turn & Timers | Medium | Phase 3 |
| 5. Reconnection | Medium | Phase 3, 4 |
| 6. Polish | Low-Medium | All above |

---

## MVP Scope (Minimum Viable Multiplayer)

For a working MVP, implement:

1. **Phase 1**: Partykit setup with basic room
2. **Phase 2**: Lobby with create/join/quickplay
3. **Phase 3**: State sync (server-authoritative)
4. **Phase 4**: Basic turn handling (short timeout only)

This gives you functional online play. Phases 5-6 can follow iteratively.
