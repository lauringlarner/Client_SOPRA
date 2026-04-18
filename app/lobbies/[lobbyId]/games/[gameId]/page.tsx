"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";

interface TeamScore {
  teamName: string;
  totalPoints: number;
}

type TeamName = "Team 1" | "Team 2";

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

const MOCK_CLAIMED_TILES: Record<number, TeamName> = {
  0: "Team 1",
  3: "Team 2",
  7: "Team 1",
  10: "Team 2",
};

const MOCK_TIME_LEFT = 64;

function normalizeTeamName(value: string | null): TeamName {
  if (value === "Team 2" || value === "Team2") {
    return "Team 2";
  }
  return "Team 1";
}

export default function GameBoardPage() {
  const router = useRouter();
  const { loaded, isAuthenticated } = useAuthSession();
  const params = useParams();
  const lobbyId = params?.lobbyId as string;
  const gameId = params?.gameId as string;

  const [teamScores] = useState<TeamScore[]>(MOCK_SCORES);
  const [myTeamName, setMyTeamName] = useState<TeamName>("Team 1");

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
    setMyTeamName(normalizeTeamName(localStorage.getItem("teamName")));
    const interval = setInterval(checkPendingStatus, 500);
    return () => clearInterval(interval);
  }, [isAuthenticated, loaded, router, pendingWord]);

  if (!loaded || !isAuthenticated) return <div className="app-shell" />;

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient bingo-frame-layout">
        
        <section className="bingo-team-points-container" aria-label="Team Scores">
          {teamScores.map((score) => (
            <div
              key={score.teamName}
              className={`bingo-team-points-card ${score.teamName === myTeamName ? "is-friendly" : "is-enemy"}`}
            >
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
              style={{ width: `${MOCK_TIME_LEFT}%` }} 
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
                  const claimedByTeam = MOCK_CLAIMED_TILES[tileIndex];
                  const isClaimed = claimedByTeam !== undefined;
                  const isAnalyzing = pendingWord === word;
                  const claimedClass = !isClaimed
                    ? ""
                    : claimedByTeam === myTeamName
                      ? "is-claimed-friendly"
                      : "is-claimed-enemy";

                  return (
                    <button
                      key={`tile-${tileIndex}`}
                      type="button"
                      className={`bingo-field-button ${isClaimed ? `is-claimed ${claimedClass}` : ""} ${isAnalyzing ? "is-analyzing" : ""}`}
                      disabled={isClaimed || isAnalyzing}
                      onClick={() => {
                        if (lobbyId && gameId) {
                          router.push(`/lobbies/${lobbyId}/games/${gameId}/submission?tileWord=${encodeURIComponent(word)}`);
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
