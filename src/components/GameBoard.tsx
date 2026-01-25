"use client";

import { Suit } from "@/engine";
import { useGameStore } from "@/store/gameStore";
import { Hand } from "./Hand";
import { OpponentArea } from "./OpponentArea";
import { PlayArea } from "./PlayArea";
import { OrderStrip } from "./OrderStrip";
import { SuitChooser } from "./SuitChooser";
import { HandoffScreen } from "./HandoffScreen";
import { GameControls, LastCardButton } from "./GameControls";
import { StatusBar } from "./StatusBar";
import { WinScreen } from "./WinScreen";

export function GameBoard() {
  const {
    gameState,
    selectedCards,
    playOrder,
    pendingSuitChoice,
    startGame,
    selectCard,
    deselectCard,
    clearSelection,
    reorderPlayCard,
    playSelectedCards,
    drawCard,
    confirmHandoff,
    declareLastCard,
    getCurrentPlayer,
    isSelectionLegal,
    getTopCard,
    getTargetSuit,
    getTargetRank,
  } = useGameStore();

  // Game not started
  if (!gameState) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-br from-gray-900 to-gray-800">
        <h1 className="text-5xl font-bold text-white">Last Card</h1>
        <p className="max-w-md text-center text-white/60">
          A classic card game for 2-4 players. Be the first to play all your cards!
        </p>
        <div className="flex flex-col gap-4">
          <button
            onClick={() => startGame(2)}
            className="rounded-xl bg-green-600 px-12 py-4 text-xl font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-green-500"
          >
            Start 2 Player Game
          </button>
          <div className="flex gap-4">
            <button
              onClick={() => startGame(3)}
              className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white transition-all hover:bg-blue-500"
            >
              3 Players
            </button>
            <button
              onClick={() => startGame(4)}
              className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white transition-all hover:bg-blue-500"
            >
              4 Players
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentPlayer = getCurrentPlayer();
  const topCard = getTopCard();
  const targetSuit = getTargetSuit();
  const targetRank = getTargetRank();

  // Game over
  if (gameState.winner !== null) {
    return (
      <WinScreen winner={gameState.winner} onPlayAgain={() => startGame(gameState.players.length)} />
    );
  }

  // Handoff screen
  if (gameState.turnPhase === "waiting") {
    return (
      <HandoffScreen playerNumber={gameState.currentPlayerIndex + 1} onConfirm={confirmHandoff} />
    );
  }

  // Suit chooser modal
  if (pendingSuitChoice) {
    return (
      <div className="relative flex min-h-screen flex-col bg-felt">
        <SuitChooser onChoose={(suit: Suit) => playSelectedCards(suit)} onCancel={clearSelection} />
        {renderGameContent()}
      </div>
    );
  }

  function renderGameContent() {
    if (!gameState || !currentPlayer || !targetSuit || !targetRank) return null;

    const currentPlayerState = gameState.players[gameState.currentPlayerIndex];
    const isMustDraw = gameState.turnPhase === "must-draw";
    const canPlayCards = isSelectionLegal() && gameState.turnPhase === "playing";
    const canDrawCard =
      (gameState.turnPhase === "playing" || gameState.turnPhase === "must-draw") &&
      (gameState.drawPile.length > 0 || gameState.discardPile.length > 1);

    // Get opponent info - for 2 player game, just show the other player
    // For 3-4 players, show all opponents
    const opponents = gameState.players.filter((_, i) => i !== gameState.currentPlayerIndex);

    return (
      <>
        {/* Status bar */}
        <div className="bg-black/20 py-3">
          <StatusBar
            currentPlayer={gameState.currentPlayerIndex}
            targetSuit={targetSuit}
            targetRank={targetRank}
            forcedDrawCount={gameState.pendingEffects.forcedDrawCount}
            skipActive={gameState.pendingEffects.skipNextPlayer}
          />
        </div>

        {/* Main game area */}
        <div className="relative flex flex-1 flex-col">
          {/* Opponent area (top) */}
          <div className="flex justify-center gap-8 py-6">
            {opponents.map((opponent) => (
              <OpponentArea
                key={opponent.id}
                cardCount={opponent.hand.length}
                playerName={`Player ${opponent.id + 1}`}
                hasLastCardDeclared={opponent.declaredLastCard}
              />
            ))}
          </div>

          {/* Play area (center) */}
          <div className="flex flex-1 items-center justify-center">
            <PlayArea
              topCard={topCard}
              drawPileCount={gameState.drawPile.length}
              chosenSuit={gameState.chosenSuit}
              onDrawClick={drawCard}
              canDraw={canDrawCard}
            />
          </div>

          {/* Order strip (when multiple cards selected) */}
          {playOrder.length > 1 && (
            <div className="flex justify-center py-4">
              <OrderStrip cards={playOrder} onReorder={reorderPlayCard} />
            </div>
          )}

          {/* Controls */}
          <div className="py-4">
            <GameControls
              canPlay={canPlayCards}
              canDraw={canDrawCard}
              mustDraw={isMustDraw}
              forcedDrawCount={gameState.pendingEffects.forcedDrawCount}
              hasLastCardPenalty={currentPlayerState.lastCardPenalty}
              onPlay={() => playSelectedCards()}
              onDraw={drawCard}
            />
          </div>

          {/* Player's hand (bottom) */}
          <div className="bg-black/20 py-6">
            <div className="mb-2 text-center text-sm font-medium text-white/70">
              Your Hand ({currentPlayer.hand.length} cards)
            </div>
            <Hand
              cards={currentPlayer.hand}
              selectedCards={selectedCards}
              onSelectCard={selectCard}
              onDeselectCard={deselectCard}
              disabled={gameState.turnPhase === "must-draw"}
            />
          </div>

          {/* Unobtrusive "Last Card" button - bottom right corner */}
          <div className="absolute bottom-4 right-4">
            <LastCardButton
              onClick={declareLastCard}
              declared={currentPlayerState.declaredLastCard}
            />
          </div>
        </div>
      </>
    );
  }

  return <div className="flex min-h-screen flex-col bg-felt">{renderGameContent()}</div>;
}
