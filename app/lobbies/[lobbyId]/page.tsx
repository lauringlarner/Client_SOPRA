"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createLobbyClient } from "@/api/lobbyService";
import { useApi } from "@/hooks/useApi";
import { useAuthSession } from "@/hooks/useAuthSession";
import { LobbyDetails, LobbyPlayer, LobbySelectableTeam, getLobbyTeamLabel, LOBBY_TEAMS, LobbyTeam } from "@/types/lobby";

const TEAM_SECTIONS: LobbyTeam[] = [...LOBBY_TEAMS, null];

export default function LobbyPage() {
  const api = useApi();
  const router = useRouter();
  const { token, userId, isAuthenticated, loaded } = useAuthSession();
  const { lobbyId } = useParams<{ lobbyId: string }>();

  const [lobby, setLobby] = useState<LobbyDetails | null>(null);
  const [connection, setConnection] = useState<"connecting" | "live" | "error">("connecting");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "error" } | null>(null);

  const client = useMemo(() => createLobbyClient({ api, token }), [api, token]);
  const me = lobby?.lobbyPlayers.find(p => p.user.id === userId) || null;
  const isHost = me?.isHost ?? false;
  const allReady = (lobby?.lobbyPlayers.length ?? 0) >= 2 && lobby?.lobbyPlayers.every(p => p.isReady);

  // 1. SSE Stream
  useEffect(() => {
    if (!loaded || !isAuthenticated) return;
    return client.subscribeToLobby(lobbyId, (data) => {
      setLobby(data);
      setConnection("live");
    }, () => setConnection("error"));
  }, [client, lobbyId, loaded, isAuthenticated]);

  // 2. Automatischer Start-Flow (Init & Redirect)
  useEffect(() => {
    if (lobby?.gameId) {
      const finalize = async () => {
        try {
          if (isHost) {
            // Leaderboard Initialisierung: /lobbies/{lId}/games/{gId}/leaderboard
            await api.post(`/lobbies/${lobbyId}/games/${lobby.gameId}/leaderboard`, undefined, token);
          }
        } catch (e) {
          console.error("Leaderboard init failed", e);
        } finally {
          // Redirect zur hierarchischen URL: /lobbies/{lId}/games/{gId}
          router.replace(`/lobbies/${lobbyId}/games/${lobby.gameId}`);
        }
      };
      void finalize();
    }
  }, [lobby?.gameId, lobbyId, isHost, api, token, router]);

  const handleStart = async () => {
    setPending(true);
    setMsg({ text: "Starting game...", tone: "info" });
    try {
      await client.startLobby(lobbyId);
    } catch (e: any) {
      setMsg({ text: e.message || "Failed to start", tone: "error" });
      setPending(false);
    }
  };

  if (!loaded || !isAuthenticated) return null;

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient lobby-layout">
        {/* Code Card */}
        <section className="lobby-card lobby-code-card">
          <div className="lobby-code-header">
            <div>
              <h1 className="lobby-code-title">Lobby Code</h1>
              <p className="lobby-code-subtitle">Waiting for players...</p>
            </div>
            <span className={`lobby-connection-pill is-${connection}`}>
              {connection === "live" ? "Live" : "Syncing"}
            </span>
          </div>
          <div className="lobby-code-box">
            {lobby?.joinCode ? lobby.joinCode.toUpperCase().replace(/(.{3})/g, "$1 ").trim() : "------"}
          </div>
        </section>

        {msg && (
          <section className={`lobby-card lobby-feedback-card is-${msg.tone}`}>
            <p className="lobby-feedback-text">{msg.text}</p>
          </section>
        )}

        {lobby && (
          <>
            {/* My Status */}
            <section className="lobby-card lobby-me-card">
              <div className="lobby-me-header">
                <h2 className="lobby-section-title">Your Seat</h2>
                <span className={`lobby-player-badge ${me?.isReady ? "is-ready" : "is-pending"}`}>
                  {me?.isReady ? "READY" : "WAITING"}
                </span>
              </div>
              <div className="lobby-team-selector">
                {LOBBY_TEAMS.map(t => (
                  <button key={t} className={`vq-button ${me?.team === t ? "is-selected" : ""}`}
                    onClick={() => client.updatePlayerTeam(lobbyId, me!.id, t)}>
                    {getLobbyTeamLabel(t)}
                  </button>
                ))}
              </div>
              <button className={`vq-button ${me?.isReady ? "is-ready" : ""}`}
                disabled={!me?.team || pending} onClick={() => client.updatePlayerReady(lobbyId, me!.id, !me?.isReady)}>
                {me?.isReady ? "CANCEL READY" : "CONFIRM READY"}
              </button>
            </section>

            {/* Team Player Lists */}
            {TEAM_SECTIONS.map(team => (
              <section key={team ?? "none"} className="lobby-card lobby-team-card">
                <h2 className="lobby-section-title">{getLobbyTeamLabel(team)}</h2>
                <div className="lobby-team-list">
                  {lobby.lobbyPlayers.filter(p => p.team === team).map(p => (
                    <div key={p.id} className={`lobby-player-item ${p.user.id === userId ? "is-self" : ""}`}>
                      <span className="lobby-player-icon">{p.user.username.charAt(0)}</span>
                      <div className="lobby-player-copy">
                        <span className="lobby-player-name">{p.user.username}</span>
                        <span className="lobby-player-team">{p.isHost ? "Host" : "Player"}</span>
                      </div>
                      <span className={`lobby-player-badge ${p.isReady ? "is-ready" : "is-pending"}`}>
                        {p.isReady ? "READY" : "..."}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {/* Footer Actions */}
            <section className="lobby-action-bar">
              {isHost ? (
                <button className="vq-button is-primary" disabled={!allReady || pending} onClick={handleStart}>
                  {pending ? "STARTING..." : "START GAME"}
                </button>
              ) : (
                <div className="lobby-action-note">Waiting for host to start</div>
              )}
              <button className="vq-button" onClick={() => router.push("/menu")}>LEAVE</button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}