"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";

interface TeamScore {
  teamName: string;
  totalPoints: number;
}

interface LeaderboardEntry {
  id: string;
  playerName: string;
  teamName: string;
  resultLabel: "Win" | "Lose";
  itemsFound: number;
  points: number;
  isHost?: boolean;
}

interface LeaderboardSnapshot {
  teamScores: TeamScore[];
  entries: LeaderboardEntry[];
}

const DEMO_LEADERBOARD: LeaderboardSnapshot = {
  teamScores: [
    { teamName: "Team 2", totalPoints: 24 },
    { teamName: "Team 1", totalPoints: 8 },
  ],
  entries: [
    {
      id: "player-3",
      playerName: "Player 3",
      teamName: "Team 2",
      resultLabel: "Win",
      itemsFound: 5,
      points: 20,
    },
    {
      id: "player-4",
      playerName: "Player 4",
      teamName: "Team 2",
      resultLabel: "Win",
      itemsFound: 1,
      points: 4,
    },
    {
      id: "player-1",
      playerName: "Player 1",
      teamName: "Team 1",
      resultLabel: "Lose",
      itemsFound: 2,
      points: 8,
      isHost: true,
    },
    {
      id: "player-2",
      playerName: "Player 2",
      teamName: "Team 1",
      resultLabel: "Lose",
      itemsFound: 0,
      points: 0,
    },
  ],
};

function buildMockLeaderboard(gameId: string): LeaderboardSnapshot {
  if (gameId === "demo-lobby") {
    return DEMO_LEADERBOARD;
  }

  return {
    teamScores: [
      { teamName: "Team 1", totalPoints: 16 },
      { teamName: "Team 2", totalPoints: 12 },
    ],
    entries: [
      {
        id: "player-a",
        playerName: "Host Player",
        teamName: "Team 1",
        resultLabel: "Win",
        itemsFound: 3,
        points: 12,
        isHost: true,
      },
      {
        id: "player-b",
        playerName: "Player 2",
        teamName: "Team 1",
        resultLabel: "Win",
        itemsFound: 1,
        points: 4,
      },
      {
        id: "player-c",
        playerName: "Player 3",
        teamName: "Team 2",
        resultLabel: "Lose",
        itemsFound: 2,
        points: 8,
      },
      {
        id: "player-d",
        playerName: "Player 4",
        teamName: "Team 2",
        resultLabel: "Lose",
        itemsFound: 1,
        points: 4,
      },
    ],
  };
}

function PlayerIcon() {
  return (
    <svg
      className="leaderboard-player-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" fill="currentColor" />
      <path
        d="M4.5 20c0-3.59 3.36-6.5 7.5-6.5s7.5 2.91 7.5 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { loaded, isAuthenticated } = useAuthSession();
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;

  const snapshot = buildMockLeaderboard(gameId);

  useEffect(() => {
    if (!loaded) return;
    if (!isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, loaded, router]);

  if (!loaded || !isAuthenticated) {
    return <div className="app-shell" />;
  }

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient leaderboard-layout">
        <header className="leaderboard-header">
          <h1 className="leaderboard-title">Leaderboard</h1>
          <p className="leaderboard-subtitle">
            Mocked result view for <span>{gameId}</span>.
          </p>
        </header>

        <section className="leaderboard-card" aria-label="Final player results">
          <div className="leaderboard-list">
            {snapshot.entries.map((entry, index) => {
              const displayName = entry.isHost
                ? `${entry.playerName} / Host`
                : entry.playerName;
              const rowClassName =
                entry.resultLabel === "Win"
                  ? index === 0
                    ? "leaderboard-row leaderboard-row-win-primary"
                    : "leaderboard-row leaderboard-row-win-secondary"
                  : "leaderboard-row leaderboard-row-loss";

              return (
                <article key={entry.id} className={rowClassName}>
                  <PlayerIcon />

                  <div className="leaderboard-player-copy">
                    <span className="leaderboard-player-team">
                      {entry.teamName} / {entry.resultLabel}
                    </span>
                    <span className="leaderboard-player-name">{displayName}</span>
                  </div>

                  <div className="leaderboard-player-stats">
                    <span className="leaderboard-player-stat-label">
                      Items found
                    </span>
                    <span className="leaderboard-player-stat-value">
                      {entry.itemsFound}
                    </span>
                    <span className="leaderboard-player-stat-label">Points</span>
                    <span className="leaderboard-player-stat-value">
                      {entry.points}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="leaderboard-action-bar">
          <button
            type="button"
            className="vq-button leaderboard-action-btn"
            onClick={() => router.push("/menu")}
          >
            Leave Lobby
          </button>
          <button
            type="button"
            className="vq-button leaderboard-action-btn"
            onClick={() => router.push(`/lobbies/${gameId}`)}
          >
            Ready Up
          </button>
          <button
            type="button"
            className="vq-button leaderboard-action-btn"
            onClick={() => router.push(`/games/${gameId}`)}
          >
            Start new Round
          </button>
        </section>
      </main>
    </div>
  );
}
