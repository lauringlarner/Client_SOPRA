"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";

// 16 Mock words for the 4x4 grid
const MOCK_WORDS = [
  "House", "Pen", "Red Umbrella", "Coffee Mug",
  "Blue Chair", "Laptop", "Bicycle", "Green Leaf",
  "Spectacles", "Wall Clock", "Running Shoe", "Cactus",
  "Metal Key", "Book", "Water Bottle", "Desk Lamp"
];

export default function GameBoardPage() {
  const router = useRouter();
  const { loaded, isAuthenticated } = useAuthSession();
  const { gameId } = useParams<{ gameId: string }>();

// In reality, this array would come from your GET /games/{gameId} API call
  // For now, let's assume these indices (0-15) are already claimed
  const [claimedTileIds, setClaimedTileIds] = useState<number[]>([0, 3, 7]);

  useEffect(() => {
    if (!loaded) return;
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loaded, router]);

  if (!loaded || !isAuthenticated) {
    return <div className="app-shell" />;
  }

  return (
 <div className="app-shell">
      <main className="phone-frame screen-gradient bingo-frame-layout">
        <section className="bingo-panel">
          <div className="bingo-card">
            
            {[0, 1, 2, 3].map((rowIndex) => (
              <div key={rowIndex} className="bingo-row-frame">
                {[0, 1, 2, 3].map((colIndex) => {
                  const tileIndex = rowIndex * 4 + colIndex;
                  const word = MOCK_WORDS[tileIndex];
                  
                  // Check if this specific tile is claimed
                  const isClaimed = claimedTileIds.includes(tileIndex);

                  return (
                    <button
                      key={tileIndex}
                      type="button"
                      // 1. Apply the 'is-claimed' class for styling
                      className={`bingo-field-button ${isClaimed ? "is-claimed" : ""}`}
                      // 2. Use 'disabled' to prevent navigation to the camera
                      disabled={isClaimed}
                      onClick={() => {
                        router.push(`/games/${gameId}/submission?tileId=${tileIndex}`);
                      }}
                    >
                      <span className="tile-text">
                        {/* 3. Show a X or the word based on state */}
                        {isClaimed ? "X" : word}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}

          </div>
        </section>
      </main>
    </div>
  );
}