"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";

const MOCK_WORDS = [
  "House", "Pen", "Red Umbrella", "Coffee Mug",
  "Blue Chair", "Laptop", "Bicycle", "Green Leaf",
  "Spectacles", "Wall Clock", "Running Shoe", "Cactus",
  "Metal Key", "Book", "Water Bottle", "Desk Lamp"
];

const MOCK_SCORES = [
  { teamName: "Team 1", totalPoints: 10 },
  { teamName: "Team 2", totalPoints: 2 }
];

const MOCK_CLAIMED_TILES = [0, 3, 7, 10];

export default function GameBoardPage() {
  const router = useRouter();
  const { loaded, isAuthenticated } = useAuthSession();
  const { gameId } = useParams<{ gameId: string }>();

  const [claimedTileIds] = useState<number[]>(MOCK_CLAIMED_TILES);
  const [teamScores] = useState<any[]>(MOCK_SCORES);
  
  // Time Bar State (Mocking 70% time remaining)
  const [timeLeft, setTimeLeft] = useState(70); 

  useEffect(() => {
    if (!loaded) return;
    if (!isAuthenticated) router.replace("/login");
  }, [isAuthenticated, loaded, router]);

  if (!loaded || !isAuthenticated) return <div className="app-shell" />;

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient bingo-frame-layout">
        
        {/* Scoreboard Section */}
        <section className="bingo-team-points-container" aria-label="Team Scores">
          <div className="bingo-team-points-card">
            <span className="bingo-team-points-card-text">Team 1<br />Points:</span>
            <span className="bingo-team-points-card-points">{teamScores[0].totalPoints}</span>
          </div>

          <div className="bingo-team-points-card">
            <span className="bingo-team-points-card-text">Team 2<br />Points:</span>
            <span className="bingo-team-points-card-points">{teamScores[1].totalPoints}</span>
          </div>
        </section>

        {/* NEW: Time Bar Section */}
        <div className="bingo-time-bar-container">
          <div className="bingo-time-bar-label">Time Remaining:</div>
          <div className="bingo-time-bar-track">
            <div 
              className="bingo-time-bar-fill" 
              style={{ width: `${timeLeft}%` }} 
            />
          </div>
        </div>

        {/* Bingo Grid Section */}
        <section className="bingo-panel">
          <div className="bingo-card">
            {[0, 1, 2, 3].map((rowIndex) => (
              <div key={rowIndex} className="bingo-row-frame">
                {[0, 1, 2, 3].map((colIndex) => {
                  const tileIndex = rowIndex * 4 + colIndex;
                  const word = MOCK_WORDS[tileIndex];
                  const isClaimed = claimedTileIds.includes(tileIndex);

                  return (
                    <button
                      key={tileIndex}
                      type="button"
                      className={`bingo-field-button ${isClaimed ? "is-claimed" : ""}`}
                      disabled={isClaimed}
                      onClick={() => router.push(`/games/${gameId}/submission?tileId=${tileIndex}`)}
                    >
                      {isClaimed ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" className="claimed-icon-svg">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      ) : (
                        <span className="tile-text">{word}</span>
                      )}
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