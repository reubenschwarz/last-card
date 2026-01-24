# Last Card

A production-quality web implementation of "Last Card" - a classic UNO-like card game using a standard 52-card deck. Features a clean, minimal UI inspired by Microsoft Hearts.

## Features

- **Hotseat multiplayer**: 2-4 players on a single device with handoff concealment
- **Complete rule implementation**: All special cards (Ace, 2, 5, 10), multi-card plays, draw pile recycling
- **Framework-agnostic rules engine**: Pure TypeScript game logic, fully tested
- **Last Card declaration**: Penalty system for failing to declare when down to one card

## Tech Stack

- **Next.js 15** (App Router) + React 19 + TypeScript
- **Tailwind CSS** for styling
- **Zustand** for state management
- **Vitest** for unit testing

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to play.

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm run test:coverage
```

### Linting & Formatting

```bash
# Lint
npm run lint

# Format with Prettier
npm run format

# Check formatting
npm run format:check
```

## Game Rules

### Setup
- Standard 52-card deck (no jokers)
- Each player receives 7 cards
- Top card of draw pile starts the discard pile

### Basic Play
On your turn, you may either:
1. **Play cards** matching the discard pile's suit or rank
2. **Draw a card** (even if you have a legal play)

### Multi-Card Plays
- Play 1-3 cards of the same rank (suits can differ)
- Play 1-4 cards of the same suit in sequence
- When changing suits within a play, ranks must match the card beneath

### Special Cards
| Card | Effect |
|------|--------|
| **Ace** | Wild - play on anything, choose the next required suit |
| **2** | Next player draws 2 cards (stacks with multiple 2s) |
| **5** | Next player draws 5 cards (stacks with multiple 5s) |
| **10** | Next player skips their turn |

### Last Card Declaration
- When playing to your second-to-last card, you must click "Declare LAST CARD"
- If you forget, you must draw 1 card on your next turn instead of playing
- Cannot declare on special effect plays (2, 5, 10)

### Winning
- Be the first to discard all your cards
- Final play must be a single card (no multi-card plays to go out)

## Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── globals.css     # Tailwind + custom styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Main game page
├── components/          # React components
│   ├── Card.tsx        # Card display
│   ├── GameBoard.tsx   # Main game layout
│   ├── GameControls.tsx # Action buttons
│   ├── Hand.tsx        # Player's hand
│   ├── HandoffScreen.tsx # Turn handoff concealment
│   ├── OpponentArea.tsx # Face-down opponent cards
│   ├── OrderStrip.tsx  # Multi-card ordering UI
│   ├── PlayArea.tsx    # Draw/discard piles
│   ├── StatusBar.tsx   # Turn/target indicators
│   ├── SuitChooser.tsx # Ace suit selection
│   └── WinScreen.tsx   # Victory screen
├── engine/              # Framework-agnostic rules engine
│   ├── types.ts        # Core type definitions
│   ├── deck.ts         # Deck utilities
│   ├── rules.ts        # Game rules & state transitions
│   ├── rules.test.ts   # Comprehensive test suite
│   └── index.ts        # Public exports
└── store/               # State management
    └── gameStore.ts    # Zustand store
```

## Engine API

The rules engine is completely framework-agnostic:

```typescript
import {
  initializeGame,
  getLegalPlays,
  isPlayLegal,
  applyPlay,
  applyDraw,
  nextTurn,
} from "@/engine";

// Initialize a game
const state = initializeGame(2); // 2-4 players

// Get legal plays for current player
const plays = getLegalPlays(state, state.currentPlayerIndex);

// Apply a play
const newState = applyPlay(state, {
  cards: [{ rank: "8", suit: "diamonds" }],
});

// Advance to next player
const afterTurn = nextTurn(newState);
```

## License

MIT
