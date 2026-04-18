"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ApiService } from "@/api/apiService";

/**
 * Interfaces
 */
interface PlayerInfo {
  id: string; 
  username: string;
  teamType: "Team1" | "Team2";
}

interface GameResult {
  winnerTeam: string;
  winnerScore: number;
  loserTeam: string;
  loserScore: number;
  isDraw: boolean;
  playerList: PlayerInfo[];
}

interface UserStats {
  id: string;
  username: string;
  gamesPlayed: number;
  gamesWon: number;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { loaded, isAuthenticated, token, userId } = useAuthSession();
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;
  const api = new ApiService();
  
  const [result, setResult] = useState<GameResult | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedPlayerStats, setSelectedPlayerStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }

    async function fetchResults() {
      try {
        setLoading(true);
        let cleanToken = token;
        if (cleanToken) cleanToken = cleanToken.replace(/^"(.*)"$/, '$1');

        const data = await api.get<GameResult>(`/games/${gameId}/results`, cleanToken ?? undefined);
        
        if (data.playerList) {
          data.playerList.sort((a, b) => {
            const aIsWinner = (a.teamType === "Team1" && data.winnerTeam === "Team 1") || (a.teamType === "Team2" && data.winnerTeam === "Team 2");
            const bIsWinner = (b.teamType === "Team1" && data.winnerTeam === "Team 1") || (b.teamType === "Team2" && data.winnerTeam === "Team 2");
            if (aIsWinner && !bIsWinner) return -1;
            if (!aIsWinner && bIsWinner) return 1;
            return 0;
          });
        }
        setResult(data); 
      } catch (error) {
        console.error("Failed to fetch game results:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchResults();
  }, [isAuthenticated, loaded, router, gameId, token]);

  const handleLeaveLobby = () => {
    if (userId) {
      const storageKey = `vq.activeLobbyId.${userId}`;
      localStorage.removeItem(storageKey);
    }
    setIsLeaving(true);
    setTimeout(() => {
      router.push("/menu");
    }, 1200);
  };

  const handlePlayerClick = async (playerId: string) => {
    try {
      setStatsLoading(true);
      let cleanToken = token;
      if (cleanToken) cleanToken = cleanToken.replace(/^"(.*)"$/, '$1');
      const stats = await api.get<UserStats>(`/users/${playerId}`, cleanToken ?? undefined);
      setSelectedPlayerStats(stats);
    } catch (err) {
      console.error("Failed to fetch stats", err);
    } finally {
      setStatsLoading(false);
    }
  };

  if (!loaded || !isAuthenticated) return <div className="app-shell" />;

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient leaderboard-layout" style={{ display: 'flex', flexDirection: 'column' }}>
        <header className="leaderboard-header" style={{ flexShrink: 0 }}>
          <h1 className="leaderboard-title">Leaderboard</h1>
          <p className="leaderboard-subtitle">
            {result?.isDraw ? "It's a Tie!" : "Final Rankings"}
          </p>
        </header>

        <section 
          className="leaderboard-card" 
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            margin: '10px 0',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          <style>{`.leaderboard-card::-webkit-scrollbar { display: none; }`}</style>
          <div className="leaderboard-list">
            {loading ? (
              <div className="leaderboard-row skeleton-pulse">Loading rankings...</div>
            ) : result && result.playerList.map((player) => {
              const playerTeamLabel = player.teamType === "Team1" ? "Team 1" : "Team 2";
              const isWinnerTeam = playerTeamLabel === result.winnerTeam;
              const teamScore = isWinnerTeam ? result.winnerScore : result.loserScore;

              return (
                <article 
                  key={player.id} 
                  className={`leaderboard-row ${isWinnerTeam && !result.isDraw ? "leaderboard-row-win-primary" : "leaderboard-row-standard"}`}
                  onClick={() => handlePlayerClick(player.id)}
                  style={{ cursor: 'pointer', marginBottom: '8px' }}
                >
                  <div className="leaderboard-player-copy">
                    <span className="leaderboard-player-team">
                      {playerTeamLabel} {isWinnerTeam && !result.isDraw ? " 🏆" : ""}
                    </span>
                    <span className="leaderboard-player-name">{player.username}</span>
                  </div>
                  <div className="leaderboard-player-stats">
                    <span className="leaderboard-player-stat-label">Teampunkte</span>
                    <span className="leaderboard-player-stat-value">{teamScore}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <footer className="leaderboard-action-bar" style={{ flexShrink: 0, marginTop: 'auto' }}>
          <button className="vq-button leaderboard-action-btn" onClick={handleLeaveLobby} disabled={isLeaving}>
            Leave Lobby
          </button>
          <button className="vq-button leaderboard-action-btn" onClick={() => router.push(`/lobbies/${gameId}`)} disabled={isLeaving}>
            Back to Lobby
          </button>
        </footer>
      </main>

      {/* COMPACT LEAVE POPUP */}
      {isLeaving && (
        <div className="overlay-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div 
            className="overlay-card" 
            style={{ 
              maxWidth: '200px', 
              padding: '20px', 
              textAlign: 'center', 
              border: '2px solid #22313a', // Dunkler Rand passend zum Theme
              borderRadius: '16px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
            }}
          >
            <h2 className="overlay-title" style={{ fontSize: '1.2rem', marginBottom: '5px' }}>Leaving...</h2>
            <p className="info-label" style={{ fontSize: '0.8rem', margin: 0 }}>Cleaning up session</p>
          </div>
        </div>
      )}

      {/* STATS OVERLAY */}
      {(selectedPlayerStats || statsLoading) && !isLeaving && (
        <div className="overlay-backdrop" onClick={() => setSelectedPlayerStats(null)}>
          <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
            {statsLoading ? (
              <h2 className="overlay-title">Loading...</h2>
            ) : selectedPlayerStats && (
              <>
                <h2 className="overlay-title">{selectedPlayerStats.username}</h2>
                <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div className="stat-card">
                    <span className="stat-value">{selectedPlayerStats.gamesPlayed}</span>
                    <span className="info-label">Games</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">{selectedPlayerStats.gamesWon}</span>
                    <span className="info-label">Wins</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">
                      {selectedPlayerStats.gamesPlayed > 0 
                        ? Math.round((selectedPlayerStats.gamesWon / selectedPlayerStats.gamesPlayed) * 100) 
                        : 0}%
                    </span>
                    <span className="info-label">Rate</span>
                  </div>
                </div>
                <div className="overlay-actions overlay-actions-single" style={{ marginTop: '20px' }}>
                  <button className="vq-button" onClick={() => setSelectedPlayerStats(null)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}