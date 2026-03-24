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

  // This state tracks which tiles have been successfully claimed (green)
  // In a real app, you'd initialize this from your API /games/{gameId}
  const [claimedTiles, setClaimedTiles] = useState<number[]>([]);

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
            
            {/* Logic for 4x4 Grid (4 rows of 4) */}
            {[0, 1, 2, 3].map((rowIndex) => (
              <div key={`row-${rowIndex}`} className="bingo-row-frame">
                
                {[0, 1, 2, 3].map((colIndex) => {
                  const tileIndex = rowIndex * 4 + colIndex;
                  const word = MOCK_WORDS[tileIndex];
                  const isClaimed = claimedTiles.includes(tileIndex);

                  return (
                    <button
                      key={`tile-${tileIndex}`}
                      type="button"
                      className={`bingo-field-button ${isClaimed ? "is-claimed" : ""}`}
                      onClick={() => {
                        // Navigate to the camera submission page with the specific tile ID
                        router.push(`/games/${gameId}/submission?tileId=${tileIndex}`);
                      }}
                    >
                      <span className="tile-text">{word}</span>
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