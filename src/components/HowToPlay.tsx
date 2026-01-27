"use client";

interface HowToPlayProps {
  onClose: () => void;
}

export function HowToPlay({ onClose }: HowToPlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-gray-800 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">How to Play</h2>
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-700 px-3 py-1 text-white hover:bg-gray-600"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 text-gray-200">
          <section>
            <h3 className="mb-2 text-lg font-semibold text-green-400">Objective</h3>
            <p>Be the first player to get rid of all your cards!</p>
          </section>

          <section>
            <h3 className="mb-2 text-lg font-semibold text-green-400">Basic Play</h3>
            <ul className="list-inside list-disc space-y-1 text-sm">
              <li>Match the top card by <strong>suit</strong> or <strong>rank</strong></li>
              <li>Play one or more cards of the same rank, or same suit in sequence</li>
              <li>If you can&apos;t play, draw a card from the deck</li>
              <li>Your final card must be played alone (no multi-card plays to go out)</li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-lg font-semibold text-yellow-400">Special Cards</h3>
            <div className="space-y-2 text-sm">
              <div className="rounded bg-gray-700/50 p-2">
                <strong className="text-red-400">2</strong> - Next player draws 2 cards (can deflect with another 2)
              </div>
              <div className="rounded bg-gray-700/50 p-2">
                <strong className="text-red-400">5</strong> - Next player draws 5 cards (can deflect with another 5)
              </div>
              <div className="rounded bg-gray-700/50 p-2">
                <strong className="text-blue-400">7</strong> - Cancel any special effect by playing a 7 that matches the suit
              </div>
              <div className="rounded bg-gray-700/50 p-2">
                <strong className="text-purple-400">10</strong> - Skip the next player&apos;s turn (can deflect with another 10)
              </div>
              <div className="rounded bg-gray-700/50 p-2">
                <strong className="text-indigo-400">Jack</strong> - Reverses direction of play (3+ players only)
              </div>
              <div className="rounded bg-gray-700/50 p-2">
                <strong className="text-emerald-400">Ace</strong> - Change the suit to any suit you choose
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-lg font-semibold text-orange-400">Right of Reply</h3>
            <p className="text-sm">
              When a special card targets you, you have a chance to respond:
            </p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-sm">
              <li><strong>Deflect</strong> - Play the same rank to pass the effect to the next player</li>
              <li><strong>Cancel</strong> - Play a matching 7 to cancel the effect entirely</li>
              <li><strong>Accept</strong> - Take the effect (draw cards or get skipped)</li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-lg font-semibold text-pink-400">Last Card Rule</h3>
            <p className="text-sm">
              When you&apos;re about to play down to your last card, you should declare &quot;Last Card&quot;
              using the button in the corner. If you forget and another player challenges you with
              a 7, you&apos;ll have to draw a penalty card!
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-lg font-semibold text-cyan-400">Effect Activation</h3>
            <p className="text-sm">
              When playing a special card (2, 5, 10, Jack, Ace), you can toggle the
              &quot;Activate Effect&quot; checkbox to play the card without triggering its special power.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
