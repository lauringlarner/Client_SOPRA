"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";

export default function LobbyPage() {
  const router = useRouter();
  const { loaded, isAuthenticated } = useAuthSession();
  const params = useParams<{ lobbyId: string }>();
  const lobbyId = params.lobbyId;
  const lobbyCode = lobbyId
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .padEnd(9, "X")
    .slice(0, 9)
    .replace(/(.{3})/g, "$1 ")
    .trim();

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
      <main className="phone-frame screen-gradient lobby-layout">
        <section className="lobby-card lobby-code-card">
          <h1 className="lobby-code-title">Lobby Code:</h1>
          <div className="lobby-code-box">{lobbyCode}</div>
        </section>

        <section className="lobby-card lobby-team-card">
          <article className="lobby-player-item">
            <span className="lobby-player-icon">P</span>
            <div className="lobby-player-copy">
              <span className="lobby-player-team">Team 1</span>
              <span className="lobby-player-name">Player 1 / Host</span>
            </div>
          </article>
          <article className="lobby-player-item">
            <span className="lobby-player-icon">P</span>
            <div className="lobby-player-copy">
              <span className="lobby-player-team">Team 1</span>
              <span className="lobby-player-name">Player 2</span>
            </div>
          </article>
        </section>

        <section className="lobby-card lobby-team-card">
          <article className="lobby-player-item">
            <span className="lobby-player-icon">P</span>
            <div className="lobby-player-copy">
              <span className="lobby-player-team">Team 2</span>
              <span className="lobby-player-name">Player 3</span>
            </div>
          </article>
          <article className="lobby-player-item">
            <span className="lobby-player-icon">P</span>
            <div className="lobby-player-copy">
              <span className="lobby-player-team">Team 2</span>
              <span className="lobby-player-name">Player 4</span>
            </div>
          </article>
        </section>

        <section className="lobby-action-bar">
          <button
            type="button"
            className="vq-button lobby-action-btn"
            onClick={() => router.push("/menu")}
          >
            Leave Lobby
          </button>
          <button type="button" className="vq-button lobby-action-btn">
            Options
          </button>
          <button
            type="button"
            className="vq-button lobby-action-btn"
            onClick={() => router.push(`/games/${lobbyId}`)}
          >
            Start Game
          </button>
        </section>
      </main>
    </div>
  );
}
