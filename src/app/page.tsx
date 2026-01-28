"use client";

import Link from "next/link";
import { useState } from "react";
import { HowToPlay } from "@/components/HowToPlay";

export default function Home() {
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <h1 className="text-5xl font-bold text-white">Last Card</h1>
      <p className="max-w-md text-center text-white/60">
        A classic card game for 2-4 players. Be the first to play all your cards!
      </p>

      <div className="flex w-full max-w-md flex-col gap-4">
        {/* Local Play */}
        <Link
          href="/local"
          className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-green-600 to-green-500 px-8 py-5 text-left shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
        >
          <div className="relative z-10">
            <h3 className="text-xl font-bold text-white">Local Play</h3>
            <p className="mt-1 text-sm text-white/80">
              Play on this device with AI or hotseat multiplayer
            </p>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-4xl opacity-30">
            &rarr;
          </div>
        </Link>

        {/* Online Play */}
        <Link
          href="/lobby"
          className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-5 text-left shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
        >
          <div className="relative z-10">
            <h3 className="text-xl font-bold text-white">Online Play</h3>
            <p className="mt-1 text-sm text-white/80">
              Play with friends or random opponents online
            </p>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-3xl opacity-30">
            &loz;
          </div>
        </Link>
      </div>

      {/* How to Play button */}
      <button
        onClick={() => setShowHowToPlay(true)}
        className="mt-4 text-white/60 transition-colors hover:text-white"
      >
        How to Play
      </button>

      {/* How to Play modal */}
      {showHowToPlay && <HowToPlay onClose={() => setShowHowToPlay(false)} />}
    </div>
  );
}
