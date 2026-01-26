"use client";

import { useState, useEffect, useCallback } from "react";
import { Card as CardType, PlayerType, Suit, cardEquals } from "@/engine";
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
    activateEffect,
    startGame,
    startGameWithTypes,
    executeAiTurn,
    selectCard,
    deselectCard,
    clearSelection,
    reorderPlayCard,
    toggleActivateEffect,
    playSelectedCards,
    drawCard,
    confirmHandoff,
    declareLastCard,
    getCurrentPlayer,
    isSelectionLegal,
    getTopCard,
    getTargetSuit,
    getTargetRank,
    isInResponsePhase,
    hasSpecialCardSelected,
    getRespondingPlayer,
    getLegalDeflections,
    resolveResponse,
    deflectResponse,
    // Seven Dispute
    isInSevenDispute,
    canPlaySevenCancelEffect,
    canPlaySevenCancelLastCard,
    getLegalSevenCancelsEffect,
    getLegalSevenCancelsLastCard,
    getLegalSevenDisputePlays,
    canPlaySevenDispute,
    playSevenCancelEffect,
    playSevenCancelLastCard,
    playSevenDispute,
    acceptSevenDispute,
    getSevenDisputeStatusMessage,
    getSevenDisputeResponder,
    // AI helpers
    isActivePlayerAi,
    getActivePlayerIndex,
    getPlayerType,
  } = useGameStore();

  // Game setup state
  const [setupPlayerCount, setSetupPlayerCount] = useState(2);
  const [setupPlayerTypes, setSetupPlayerTypes] = useState<PlayerType[]>(["human", "human"]);

  // Update player types when count changes
  const handlePlayerCountChange = useCallback((count: number) => {
    setSetupPlayerCount(count);
    setSetupPlayerTypes((prev) => {
      const newTypes: PlayerType[] = ["human"]; // Player 1 is always human
      for (let i = 1; i < count; i++) {
        newTypes.push(prev[i] ?? "ai"); // Default new players to AI
      }
      return newTypes;
    });
  }, []);

  // Toggle player type between human and AI
  const togglePlayerType = useCallback((index: number) => {
    if (index === 0) return; // Player 1 is always human
    setSetupPlayerTypes((prev) => {
      const newTypes = [...prev];
      newTypes[index] = newTypes[index] === "human" ? "ai" : "human";
      return newTypes;
    });
  }, []);

  // Start game with configured types
  const handleStartGame = useCallback(() => {
    startGameWithTypes(setupPlayerCount, setupPlayerTypes);
  }, [setupPlayerCount, setupPlayerTypes, startGameWithTypes]);

  // AI turn execution effect
  useEffect(() => {
    if (!gameState || gameState.winner !== null) return;

    const activeIsAi = isActivePlayerAi();
    if (!activeIsAi) return;

    // Delay AI turn for visibility
    const timer = setTimeout(() => {
      executeAiTurn();
    }, 500);

    return () => clearTimeout(timer);
  }, [gameState, isActivePlayerAi, executeAiTurn]);

  // Game not started - show setup screen
  if (!gameState) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-br from-gray-900 to-gray-800">
        <h1 className="text-5xl font-bold text-white">Last Card</h1>
        <p className="max-w-md text-center text-white/60">
          A classic card game for 2-4 players. Be the first to play all your cards!
        </p>

        {/* Player count selector */}
        <div className="flex flex-col items-center gap-4">
          <div className="text-lg font-medium text-white">Number of Players</div>
          <div className="flex gap-3">
            {[2, 3, 4].map((count) => (
              <button
                key={count}
                onClick={() => handlePlayerCountChange(count)}
                className={`rounded-lg px-6 py-3 font-bold transition-all ${
                  setupPlayerCount === count
                    ? "bg-green-600 text-white scale-105"
                    : "bg-gray-700 text-white/70 hover:bg-gray-600"
                }`}
              >
                {count} Players
              </button>
            ))}
          </div>
        </div>

        {/* Player type configuration */}
        <div className="flex flex-col items-center gap-4">
          <div className="text-lg font-medium text-white">Player Setup</div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: setupPlayerCount }).map((_, index) => (
              <div
                key={index}
                className="flex items-center gap-4 rounded-lg bg-gray-800 px-4 py-3"
              >
                <span className="w-24 font-medium text-white">
                  Player {index + 1}
                </span>
                {index === 0 ? (
                  <span className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white">
                    You (Human)
                  </span>
                ) : (
                  <button
                    onClick={() => togglePlayerType(index)}
                    className={`rounded px-3 py-1 text-sm font-medium transition-all ${
                      setupPlayerTypes[index] === "human"
                        ? "bg-blue-600 text-white"
                        : "bg-purple-600 text-white"
                    }`}
                  >
                    {setupPlayerTypes[index] === "human" ? "Human (Hotseat)" : "AI"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={handleStartGame}
          className="rounded-xl bg-green-600 px-12 py-4 text-xl font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-green-500"
        >
          Start Game
        </button>
      </div>
    );
  }

  const currentPlayer = getCurrentPlayer();
  const topCard = getTopCard();
  const targetSuit = getTargetSuit();
  const targetRank = getTargetRank();

  // Game over
  if (gameState.winner !== null) {
    const winnerType = getPlayerType(gameState.winner);
    const winnerLabel = winnerType === "ai" ? "AI" : "Human";
    return (
      <WinScreen
        winner={gameState.winner}
        winnerLabel={winnerLabel}
        onPlayAgain={() => {
          // Restart with same player types
          const types = gameState.players.map((p) => p.playerType);
          startGameWithTypes(gameState.players.length, types);
        }}
      />
    );
  }

  // Get the active player index for handoff/display
  const activeIndex = getActivePlayerIndex() ?? gameState.currentPlayerIndex;
  const activePlayerType = getPlayerType(activeIndex);
  const activeIsAi = activePlayerType === "ai";

  // Handoff screen - only for human players, not during response phase, not during seven dispute
  // AI players don't need handoff - the useEffect handles their turn automatically
  if (gameState.turnPhase === "waiting" && !isInResponsePhase() && !isInSevenDispute() && !activeIsAi) {
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
    if (!gameState || !targetSuit || !targetRank) return null;

    const inResponsePhase = isInResponsePhase();
    const inSevenDispute = isInSevenDispute();
    const respondingPlayer = getRespondingPlayer();
    const sevenDisputeResponder = getSevenDisputeResponder();
    const legalDeflections = getLegalDeflections();

    // Seven cancel options
    const canCancelEffect = canPlaySevenCancelEffect();
    const canCancelLastCard = canPlaySevenCancelLastCard();
    const legalSevenCancelsEffect = getLegalSevenCancelsEffect();
    const legalSevenCancelsLastCard = getLegalSevenCancelsLastCard();
    const legalSevenDisputePlays = getLegalSevenDisputePlays();
    const sevenDisputeStatus = getSevenDisputeStatusMessage();

    // During response phase, show the responding player's view
    // During seven dispute, show the dispute responder's view
    let displayPlayer = currentPlayer;
    if (inSevenDispute && sevenDisputeResponder) {
      displayPlayer = sevenDisputeResponder;
    } else if (inResponsePhase && respondingPlayer) {
      displayPlayer = respondingPlayer;
    }
    if (!displayPlayer) return null;

    const currentPlayerState = gameState.players[gameState.currentPlayerIndex];
    const isMustDraw = gameState.turnPhase === "must-draw";
    const canPlayCards = isSelectionLegal() && gameState.turnPhase === "playing" && !inSevenDispute && !canCancelLastCard;
    const canDrawCard =
      (gameState.turnPhase === "playing" || gameState.turnPhase === "must-draw") &&
      (gameState.drawPile.length > 0 || gameState.discardPile.length > 1) &&
      !inSevenDispute && !canCancelLastCard;

    // Get opponent info - exclude the currently displayed player
    let displayPlayerIndex = gameState.currentPlayerIndex;
    if (inSevenDispute && gameState.sevenDispute) {
      displayPlayerIndex = gameState.sevenDispute.responderPlayerId;
    } else if (inResponsePhase && gameState.respondingPlayerIndex !== null) {
      displayPlayerIndex = gameState.respondingPlayerIndex;
    }
    const opponents = gameState.players.filter((_, i) => i !== displayPlayerIndex);

    // Check if a card can be used to deflect
    const isDeflectionCard = (card: CardType) => {
      return legalDeflections.some((d) => cardEquals(d, card));
    };

    // Check if a card is a legal 7 for canceling effect
    const isSevenCancelEffectCard = (card: CardType) => {
      return legalSevenCancelsEffect.some((c) => cardEquals(c, card));
    };

    // Check if a card is a legal 7 for canceling last card
    const isSevenCancelLastCardCard = (card: CardType) => {
      return legalSevenCancelsLastCard.some((c) => cardEquals(c, card));
    };

    // Check if a card is a legal 7 for dispute
    const isSevenDisputeCard = (card: CardType) => {
      return legalSevenDisputePlays.some((c) => cardEquals(c, card));
    };

    // Handle card click during response phase
    const handleResponseCardClick = (card: CardType) => {
      if (isDeflectionCard(card)) {
        deflectResponse(card);
      } else if (isSevenCancelEffectCard(card)) {
        playSevenCancelEffect(card);
      }
    };

    // Handle card click during seven dispute
    const handleSevenDisputeCardClick = (card: CardType) => {
      if (isSevenDisputeCard(card)) {
        playSevenDispute(card);
      }
    };

    // Handle card click when can challenge last card
    const handleLastCardChallengeClick = (card: CardType) => {
      if (isSevenCancelLastCardCard(card)) {
        playSevenCancelLastCard(card);
      }
    };

    // Combined highlight cards for response phase (deflections + 7 cancels)
    const responseHighlightCards = [...legalDeflections, ...legalSevenCancelsEffect];

    // Get effect description for response phase
    const getEffectDescription = () => {
      if (!gameState.responseChainRank) return "";
      if (gameState.responseChainRank === "10") {
        return "being skipped";
      }
      return `drawing ${gameState.pendingEffects.forcedDrawCount} cards`;
    };

    return (
      <>
        {/* Status bar */}
        <div className="bg-black/20 py-3">
          <StatusBar
            currentPlayer={displayPlayerIndex}
            targetSuit={targetSuit}
            targetRank={targetRank}
            forcedDrawCount={gameState.pendingEffects.forcedDrawCount}
            skipActive={gameState.pendingEffects.skipNextPlayer}
          />
        </div>

        {/* Seven Dispute banner */}
        {inSevenDispute && (
          <div className="bg-purple-600 px-4 py-3 text-center">
            <div className="text-lg font-bold text-white">
              7 Dispute - Player {displayPlayerIndex + 1}
            </div>
            <div className="text-sm text-purple-100">
              {sevenDisputeStatus}
            </div>
          </div>
        )}

        {/* Last Card Challenge banner */}
        {!inSevenDispute && canCancelLastCard && (
          <div className="bg-orange-600 px-4 py-3 text-center">
            <div className="text-lg font-bold text-white">
              Challenge Last Card? - Player {displayPlayerIndex + 1}
            </div>
            <div className="text-sm text-orange-100">
              Opponent declared Last Card. Play a matching 7 to challenge, or continue your turn.
            </div>
          </div>
        )}

        {/* Response phase banner */}
        {!inSevenDispute && inResponsePhase && (
          <div className="bg-yellow-600 px-4 py-3 text-center">
            <div className="text-lg font-bold text-white">
              Right of Reply - Player {displayPlayerIndex + 1}
            </div>
            <div className="text-sm text-yellow-100">
              You are facing {getEffectDescription()}. Play a {gameState.responseChainRank} to deflect{canCancelEffect ? ", play a 7 to cancel" : ""}, or resolve to accept.
            </div>
          </div>
        )}

        {/* Main game area */}
        <div className="relative flex flex-1 flex-col">
          {/* Opponent area (top) */}
          <div className="flex justify-center gap-8 py-6">
            {opponents.map((opponent) => (
              <OpponentArea
                key={opponent.id}
                cardCount={opponent.hand.length}
                playerName={`Player ${opponent.id + 1}`}
                playerType={opponent.playerType}
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
              onDrawClick={(inResponsePhase || inSevenDispute) ? undefined : drawCard}
              canDraw={(inResponsePhase || inSevenDispute) ? false : canDrawCard}
            />
          </div>

          {/* Order strip (when multiple cards selected - not during response phase) */}
          {!inResponsePhase && playOrder.length > 1 && (
            <div className="flex justify-center py-4">
              <OrderStrip cards={playOrder} onReorder={reorderPlayCard} />
            </div>
          )}

          {/* Activation toggle for special cards (not during response phase) */}
          {!inResponsePhase && hasSpecialCardSelected() && (
            <div className="flex items-center justify-center gap-3 py-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-gray-800/80 px-4 py-2 text-white">
                <input
                  type="checkbox"
                  checked={activateEffect}
                  onChange={toggleActivateEffect}
                  className="h-4 w-4 accent-yellow-500"
                />
                <span className="text-sm font-medium">
                  Activate Effect {activateEffect ? "(ON)" : "(OFF)"}
                </span>
              </label>
              <span className="text-xs text-gray-400">
                {activateEffect ? "Effect will trigger" : "Play without effect"}
              </span>
            </div>
          )}

          {/* Controls - different for each phase */}
          {inSevenDispute ? (
            <div className="flex justify-center gap-4 py-4">
              <button
                onClick={acceptSevenDispute}
                className="rounded-lg bg-purple-700 px-8 py-3 font-bold text-white transition-all hover:bg-purple-600"
              >
                Accept {gameState.sevenDispute?.cancelled ? "(Effect Cancelled)" : "(Effect Active)"}
              </button>
              {legalSevenDisputePlays.length > 0 && (
                <div className="flex items-center text-sm text-purple-300">
                  Or click a 7 in your hand to counter
                </div>
              )}
            </div>
          ) : canCancelLastCard ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex justify-center gap-4">
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
              {legalSevenCancelsLastCard.length > 0 && (
                <div className="flex items-center text-sm text-orange-400">
                  Or click a 7 in your hand to challenge the Last Card
                </div>
              )}
            </div>
          ) : inResponsePhase ? (
            <div className="flex justify-center gap-4 py-4">
              <button
                onClick={resolveResponse}
                className="rounded-lg bg-red-600 px-8 py-3 font-bold text-white transition-all hover:bg-red-500"
              >
                Resolve - Accept {gameState.responseChainRank === "10" ? "Skip" : `+${gameState.pendingEffects.forcedDrawCount}`}
              </button>
              {(legalDeflections.length > 0 || canCancelEffect) && (
                <div className="flex items-center text-sm text-yellow-400">
                  Or click a {legalDeflections.length > 0 ? gameState.responseChainRank : ""}{legalDeflections.length > 0 && canCancelEffect ? " or " : ""}{canCancelEffect ? "7" : ""} in your hand
                </div>
              )}
            </div>
          ) : (
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
          )}

          {/* Player's hand (bottom) */}
          <div className="bg-black/20 py-6">
            <div className="mb-2 text-center text-sm font-medium text-white/70">
              {(inSevenDispute || inResponsePhase) ? `Player ${displayPlayerIndex + 1}'s Hand` : "Your Hand"} ({displayPlayer.hand.length} cards)
            </div>
            {inSevenDispute ? (
              <Hand
                cards={displayPlayer.hand}
                selectedCards={[]}
                onSelectCard={handleSevenDisputeCardClick}
                onDeselectCard={() => {}}
                disabled={false}
                highlightCards={legalSevenDisputePlays}
              />
            ) : canCancelLastCard ? (
              <Hand
                cards={displayPlayer.hand}
                selectedCards={selectedCards}
                onSelectCard={(card) => {
                  if (isSevenCancelLastCardCard(card)) {
                    handleLastCardChallengeClick(card);
                  } else {
                    selectCard(card);
                  }
                }}
                onDeselectCard={deselectCard}
                disabled={gameState.turnPhase === "must-draw"}
                highlightCards={legalSevenCancelsLastCard}
              />
            ) : inResponsePhase ? (
              <Hand
                cards={displayPlayer.hand}
                selectedCards={[]}
                onSelectCard={handleResponseCardClick}
                onDeselectCard={() => {}}
                disabled={false}
                highlightCards={responseHighlightCards}
              />
            ) : (
              <Hand
                cards={displayPlayer.hand}
                selectedCards={selectedCards}
                onSelectCard={selectCard}
                onDeselectCard={deselectCard}
                disabled={gameState.turnPhase === "must-draw"}
              />
            )}
          </div>

          {/* Unobtrusive "Last Card" button - bottom right corner (not during special phases) */}
          {!inResponsePhase && !inSevenDispute && (
            <div className="absolute bottom-4 right-4">
              <LastCardButton
                onClick={declareLastCard}
                declared={currentPlayerState.declaredLastCard}
              />
            </div>
          )}
        </div>
      </>
    );
  }

  return <div className="flex min-h-screen flex-col bg-felt">{renderGameContent()}</div>;
}
