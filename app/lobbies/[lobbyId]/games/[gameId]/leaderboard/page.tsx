"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ApiService } from "@/api/apiService";
import {
  clearStoredActiveLobbyId,
  setStoredActiveLobbyId,
} from "@/utils/lobbySession";

interface LeaderboardGetDTO {
  gameId: string;
  team1Score: number;
  team2Score: number;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { loaded, isAuthenticated, token, userId } = useAuthSession();
  const params = useParams();
  const lobbyId = params?.lobbyId as string;
  const gameId = params?.gameId as string;
  const api = new ApiService();
  
  const [data, setData] = useState<LeaderboardGetDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const getCleanToken = useCallback((rawToken: string | null | undefined) => {
    if (!rawToken) return undefined;
    return rawToken.replace(/^"(.*)"$/, '$1');
  }, []);

  useEffect(() => {
    if (!loaded || !isAuthenticated || !lobbyId || !gameId) return;

    setStoredActiveLobbyId(userId, lobbyId);

    async function fetchLeaderboard() {
      try {
        setLoading(true);
        const response = await api.get<LeaderboardGetDTO>(
          `/lobbies/${lobbyId}/games/${gameId}/leaderboard`, 
          getCleanToken(token)
        );
        setData(response); 
      } catch (error) {
        console.error("Leaderboard fetch failed:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, [gameId, getCleanToken, isAuthenticated, loaded, lobbyId, token, userId]);

  const confirmLeave = () => {
    clearStoredActiveLobbyId(userId, lobbyId);
    setIsLeaving(true);
    router.push("/menu");
  };

  if (!loaded || !isAuthenticated) return <div className="app-shell" />;

  const teams = data ? [
    { name: "Team 1", score: data.team1Score, id: 1 },
    { name: "Team 2", score: data.team2Score, id: 2 }
  ].sort((a, b) => b.score - a.score) : [];

  const isDraw = data && data.team1Score === data.team2Score;
  const winningScore = data ? Math.max(data.team1Score, data.team2Score) : 0;

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient leaderboard-layout">
        
        {/* RECTANGULAR POP-UP OVERLAY */}
        {showConfirm && (
          <div className="confirm-overlay">
            <div className="confirm-card theme-dark-teal">
              <h2 className="confirm-title">Leaving Lobby</h2>
              <p className="confirm-text">Are you sure you want to exit the game results?</p>
              <div className="confirm-actions">
                <button type="button" className="confirm-btn cancel" onClick={() => setShowConfirm(false)}>
                  Stay
                </button>
                <button type="button" className="confirm-btn leave" onClick={confirmLeave}>
                  Exit
                </button>
              </div>
            </div>
          </div>
        )}

        <header className="leaderboard-header">
          <h1 className="leaderboard-title">Leaderboard</h1>
          <p className="leaderboard-subtitle">
            {loading ? "Loading..." : isDraw ? "It's a Draw!" : "Final Standings"}
          </p>
        </header>

        <section className="leaderboard-card-container">
          {loading ? (
            <div className="skeleton-pulse">Fetching Scores...</div>
          ) : (
            <div className="teams-fill-wrapper">
              {teams.map((team) => {
                const isWinner = !isDraw && team.score === winningScore;
                return (
                  <article 
                    key={team.id} 
                    className={`team-card ${isWinner ? "leaderboard-row-win-primary" : "leaderboard-row-standard"}`}
                  >
                    <div className="team-label">{team.name}</div>
                    <div className="team-score-section">
                      <span className="score-label">Points</span>
                      <div className="score-row">
                        <span className="score-value">{team.score}</span>
                        {isWinner && <span className="trophy-icon">🏆</span>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="leaderboard-action-bar">
          <button type="button" className="leaderboard-action-btn" onClick={() => setShowConfirm(true)} disabled={isLeaving}>
            Leave
          </button>
          <button type="button" className="leaderboard-action-btn" onClick={() => router.push(`/lobbies/${lobbyId}`)} disabled={isLeaving}>
            To Lobby
          </button>
        </footer>
      </main>
    </div>
  );
}
