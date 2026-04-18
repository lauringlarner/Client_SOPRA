"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ApiService } from "@/api/apiService";

/**
 * Interface matching your specific JSON structure
 */
interface Tile {
  word: string;
  value: number;
  status: "UNCLAIMED" | "TEAM1" | "TEAM2";
}

interface LeaderboardGetDTO {
  gameId: string;
  team1Score: number;
  team2Score: number;
  tileGrid: Tile[][]; 
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

  const getCleanToken = useCallback((rawToken: string | null | undefined) => {
    if (!rawToken) return undefined;
    return rawToken.replace(/^"(.*)"$/, '$1');
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }

    if (!lobbyId || !gameId) return;

    async function fetchLeaderboard() {
      try {
        setLoading(true);
        const cleanToken = getCleanToken(token);

        const response = await api.get<LeaderboardGetDTO>(
          `/lobbies/${lobbyId}/games/${gameId}/leaderboard`, 
          cleanToken
        );
        
        setData(response); 
      } catch (error) {
        console.error("Leaderboard fetch failed:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, [loaded, isAuthenticated, token, lobbyId, gameId, router, getCleanToken]);

  const handleLeaveLobby = () => {
    if (userId) {
      localStorage.removeItem(`vq.activeLobbyId.${userId}`);
    }
    setIsLeaving(true);
    setTimeout(() => router.push("/menu"), 1200);
  };

  if (!loaded || !isAuthenticated) return <div className="app-shell" />;

  const team1Win = data && data.team1Score > data.team2Score;
  const team2Win = data && data.team2Score > data.team1Score;
  const isDraw = data && data.team1Score === data.team2Score;

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient leaderboard-layout" style={{ display: 'flex', flexDirection: 'column' }}>
        <header className="leaderboard-header" style={{ flexShrink: 0 }}>
          <h1 className="leaderboard-title">Leaderboard</h1>
          <p className="leaderboard-subtitle">
            {loading ? "Loading..." : isDraw ? "It's a Draw!" : "Final Standings"}
          </p>
        </header>

        <section className="leaderboard-card" style={{ flex: 1, overflowY: 'auto', margin: '10px 0', scrollbarWidth: 'none' }}>
          <style>{`.leaderboard-card::-webkit-scrollbar { display: none; }`}</style>
          
          <div className="leaderboard-list" style={{ padding: '0 15px' }}>
            {loading ? (
              <div className="leaderboard-row skeleton-pulse">Loading scores...</div>
            ) : data ? (
              <>
                {/* TEAM 1 SCORE */}
                <article className={`leaderboard-row ${team1Win ? "leaderboard-row-win-primary" : "leaderboard-row-standard"}`} style={{ marginBottom: '10px' }}>
                  <div className="leaderboard-player-copy">
                    <span className="leaderboard-player-team">TEAM 1 {team1Win ? " 🏆" : ""}</span>
                    <span className="leaderboard-player-name">Blue Team</span>
                  </div>
                  <div className="leaderboard-player-stats">
                    <span className="leaderboard-player-stat-label">Points</span>
                    <span className="leaderboard-player-stat-value">{data.team1Score}</span>
                  </div>
                </article>

                {/* TEAM 2 SCORE */}
                <article className={`leaderboard-row ${team2Win ? "leaderboard-row-win-primary" : "leaderboard-row-standard"}`} style={{ marginBottom: '25px' }}>
                  <div className="leaderboard-player-copy">
                    <span className="leaderboard-player-team">TEAM 2 {team2Win ? " 🏆" : ""}</span>
                    <span className="leaderboard-player-name">Red Team</span>
                  </div>
                  <div className="leaderboard-player-stats">
                    <span className="leaderboard-player-stat-label">Points</span>
                    <span className="leaderboard-player-stat-value">{data.team2Score}</span>
                  </div>
                </article>

                {/* BINGO BOARD REVIEW */}
                <div className="bingo-review-section" style={{ textAlign: 'center', marginTop: '10px' }}>
                  <h3 style={{ color: 'white', fontSize: '1rem', marginBottom: '12px', opacity: 0.9 }}>Match Review</h3>
                  <div className="mini-bingo-grid" style={{ display: 'inline-block', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '15px' }}>
                    {data.tileGrid.map((row, rowIndex) => (
                      <div key={`row-${rowIndex}`} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                        {row.map((tile, colIndex) => {
                          const statusClass = 
                            tile.status === "TEAM1" ? "is-claimed-friendly" : 
                            tile.status === "TEAM2" ? "is-claimed-enemy" : "";
                          
                          return (
                            <div 
                              key={`tile-${rowIndex}-${colIndex}`} 
                              className={`mini-tile ${statusClass}`}
                              title={tile.word}
                            >
                              {tile.status !== "UNCLAIMED" && (
                                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" style={{ width: '14px', height: '14px' }}>
                                  <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '10px', fontSize: '0.7rem', color: 'white', opacity: 0.7 }}>
                    <span><span style={{ color: '#4a90e2' }}>●</span> Team 1</span>
                    <span><span style={{ color: '#e24a4a' }}>●</span> Team 2</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="leaderboard-row">No data available</div>
            )}
          </div>
        </section>

        <footer className="leaderboard-action-bar" style={{ flexShrink: 0, marginTop: 'auto' }}>
          <button className="vq-button leaderboard-action-btn" onClick={handleLeaveLobby} disabled={isLeaving}>
            Leave
          </button>
          <button className="vq-button leaderboard-action-btn" onClick={() => router.push(`/lobbies/${lobbyId}`)} disabled={isLeaving}>
            To Lobby
          </button>
        </footer>
      </main>

      <style jsx>{`
        .mini-tile {
          width: 38px;
          height: 38px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        }
        .is-claimed-friendly {
          background-color: #4a90e2 !important; /* Blue Team */
          border: 1px solid rgba(255,255,255,0.2);
        }
        .is-claimed-enemy {
          background-color: #e24a4a !important; /* Red Team */
          border: 1px solid rgba(255,255,255,0.2);
        }
      `}</style>
    </div>
  );
}