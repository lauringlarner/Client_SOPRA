"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createLobbyClient } from "@/api/lobbyService";
import { useApi } from "@/hooks/useApi";
import { useAuthSession } from "@/hooks/useAuthSession";
import { LobbyDetails, LobbyPlayer, getLobbyTeamLabel, LOBBY_TEAMS, LobbyTeam } from "@/types/lobby";

const TEAM_SECTIONS: LobbyTeam[] = [...LOBBY_TEAMS, null];

export default function LobbyPage() {
  const api = useApi();
  const router = useRouter();
  const { token, userId, isAuthenticated, loaded } = useAuthSession();
  const params = useParams<{ lobbyId: string }>();
  const lobbyId = params?.lobbyId;

  const [lobby, setLobby] = useState<LobbyDetails | null>(null);
  const [connection, setConnection] = useState<"connecting" | "live" | "error">("connecting");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "error" } | null>(null);

  const client = useMemo(() => createLobbyClient({ api, token }), [api, token]);
  
  const me = useMemo(() => 
    lobby?.lobbyPlayers.find((p: LobbyPlayer) => p.user.id === userId) || null, 
  [lobby, userId]);

  const isHost = me?.isHost ?? false;
  const allReady = (lobby?.lobbyPlayers.length ?? 0) >= 2 && lobby?.lobbyPlayers.every((p: LobbyPlayer) => p.isReady);

  // 1. SSE Stream
  useEffect(() => {
    if (!loaded || !isAuthenticated || !lobbyId) return;
    
    return client.subscribeToLobby(lobbyId, (data) => {
      setLobby(data);
      setConnection("live");
    }, () => setConnection("error"));
  }, [client, lobbyId, loaded, isAuthenticated]);

  // 2. Automatischer Start-Flow (Init & Redirect)
  useEffect(() => {
    if (lobby?.gameId && lobbyId) {
      const finalize = async () => {
        try {
          if (isHost) {
            // Leaderboard Initialisierung mit leerem Objekt statt undefined (Vermeidung 400er)
            await api.post(`/lobbies/${lobbyId}/games/${lobby.gameId}/leaderboard`, {}, token);
          }
        } catch (e) {
          console.error("Leaderboard init failed", e);
        } finally {
          router.replace(`/lobbies/${lobbyId}/games/${lobby.gameId}`);
        }
      };
      void finalize();
    }
  }, [lobby?.gameId, lobbyId, isHost, api, token, router]);

  const handleStart = async () => {
    if (!lobbyId) return;
    setPending(true);
    setMsg({ text: "Starting game...", tone: "info" });
    try {
      await client.startLobby(lobbyId);
    } catch (e: unknown) {
      const error = e as Error;
      setMsg({ text: error.message || "Failed to start", tone: "error" });
      setPending(false);
    }
  };

  const handleLeave = async () => {
    if (!lobbyId) {
      router.push("/menu");
      return;
    }
    setPending(true);
    try {
      if (isHost) {
        await client.deleteLobby(lobbyId);
      } else {
        await client.leaveLobby(lobbyId);
      }
    } catch (e) {
      console.error("Leave failed", e);
    } finally {
      localStorage.removeItem(`vq.activeLobbyId.${lobbyId}`);
      router.push("/menu");
    }
  };

  if (!loaded || !isAuthenticated) return null;

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient lobby-layout">
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
                    disabled={pending}
                    onClick={() => lobbyId && me && client.updatePlayerTeam(lobbyId, me.id, t)}>
                    {getLobbyTeamLabel(t)}
                  </button>
                ))}
              </div>
              <button className={`vq-button ${me?.isReady ? "is-ready" : ""}`}
                disabled={!me?.team || pending || !lobbyId} 
                onClick={() => lobbyId && me && client.updatePlayerReady(lobbyId, me.id, !me.isReady)}>
                {me?.isReady ? "CANCEL READY" : "CONFIRM READY"}
              </button>
            </section>

            {TEAM_SECTIONS.map(team => (
              <section key={team ?? "none"} className="lobby-card lobby-team-card">
                <h2 className="lobby-section-title">{getLobbyTeamLabel(team)}</h2>
                <div className="lobby-team-list">
                  {lobby.lobbyPlayers.filter((p: LobbyPlayer) => p.team === team).map((p: LobbyPlayer) => (
                    <div key={p.id} className={`lobby-player-item ${p.user.id === userId ? "is-self" : ""}`}>
                      <span className="lobby-player-icon">{p.user.username.charAt(0).toUpperCase()}</span>
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

            <section className="lobby-action-bar">
              {isHost ? (
                <button className="vq-button is-primary" disabled={!allReady || pending} onClick={handleStart}>
                  {pending ? "STARTING..." : "START GAME"}
                </button>
              ) : (
                <div className="lobby-action-note">Waiting for host to start</div>
              )}
              <button className="vq-button" disabled={pending} onClick={handleLeave}>
                {pending ? "LEAVING..." : "LEAVE"}
              </button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}