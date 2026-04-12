"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";

interface TeamScore {
  teamName: string;
  totalPoints: number;
}

const MOCK_WORDS = [
  "House", "Pen", "Red Umbrella", "Coffee Mug",
  "Blue Chair", "Laptop", "Bicycle", "Green Leaf",
  "Spectacles", "Wall Clock", "Running Shoe", "Cactus",
  "Metal Key", "Book", "Bottle", "Desk Lamp"
];

const MOCK_SCORES: TeamScore[] = [
  { teamName: "Team 1", totalPoints: 10 },
  { teamName: "Team 2", totalPoints: 2 }
];

const MOCK_CLAIMED_TILES = [0, 3, 7, 10];

export default function GameBoardPage() {
  const router = useRouter();
  const { loaded, isAuthenticated } = useAuthSession();
  const params = useParams();
  const gameId = params?.gameId as string;

  const [claimedTileIds] = useState<number[]>(MOCK_CLAIMED_TILES);
  const [teamScores] = useState<TeamScore[]>(MOCK_SCORES);

  // State für das Wort, das im Hintergrund analysiert wird
  const [pendingWord, setPendingWord] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }

    // Prüft, ob ein Wort im LocalStorage als "in Prüfung" markiert ist
    const checkPendingStatus = () => {
      const storedWord = localStorage.getItem("pendingCheck");
      if (storedWord !== pendingWord) {
        setPendingWord(storedWord);
      }
    };

    checkPendingStatus();
    const interval = setInterval(checkPendingStatus, 500);
    return () => clearInterval(interval);
  }, [isAuthenticated, loaded, router, pendingWord]);

  if (!loaded || !isAuthenticated) return <div className="app-shell" />;

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient bingo-frame-layout">
        
        <section className="bingo-team-points-container" aria-label="Team Scores">
          {teamScores.map((score) => (
            <div key={score.teamName} className="bingo-team-points-card">
              <span className="bingo-team-points-card-text">{score.teamName}<br />Points:</span>
              <span className="bingo-team-points-card-points">{score.totalPoints}</span>
            </div>
          ))}
        </section>

        <div className="bingo-time-bar-container">
          <div className="bingo-time-bar-label">Time Remaining:</div>
          <div className="bingo-time-bar-track">
            <div 
              className="bingo-time-bar-fill" 
              style={{ width: `${timeLeft}%` }} 
            />
          </div>
        </div>

        <section className="bingo-panel">
          <div className="bingo-card">
            {[0, 1, 2, 3].map((rowIndex) => (
              <div key={`row-${rowIndex}`} className="bingo-row-frame">
                {[0, 1, 2, 3].map((colIndex) => {
                  const tileIndex = rowIndex * 4 + colIndex;
                  const word = MOCK_WORDS[tileIndex];
                  const isClaimed = claimedTileIds.includes(tileIndex);
                  const isAnalyzing = pendingWord === word;

                  return (
                    <button
                      key={`tile-${tileIndex}`}
                      type="button"
                      className={`bingo-field-button ${isClaimed ? "is-claimed" : ""} ${isAnalyzing ? "is-analyzing" : ""}`}
                      disabled={isClaimed || isAnalyzing}
                      onClick={() => {
                        if (gameId) {
                          router.push(`/games/${gameId}/submission?tileWord=${encodeURIComponent(word)}`);
                        }
                      }}
                    >
                      {isAnalyzing ? (
                        <div className="loader"></div>
                      ) : isClaimed ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="claimed-icon-svg">
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