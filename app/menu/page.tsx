"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";

export default function MenuPage() {
  const router = useRouter();
  const { loaded, isAuthenticated, logout, userId } = useAuthSession();
  const [activeOverlay, setActiveOverlay] = useState<
    "join" | "rules" | "friend" | "options" | null
  >(null);

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
      <main className="phone-frame screen-gradient menu-layout">
        <section className="menu-panel">
          <button
            type="button"
            className="menu-profile"
            onClick={() => router.push(`/users/${userId || "1"}`)}
          >
            <span className="menu-avatar">U</span>
            <span className="menu-username">Username</span>
          </button>

          <div className="menu-main-actions">
            <button
              type="button"
              className="vq-button menu-main-btn"
              onClick={() => router.push("/lobbies/demo-lobby")}
            >
              Create Lobby
            </button>
            <button
              type="button"
              className="vq-button menu-main-btn"
              onClick={() => setActiveOverlay("join")}
            >
              Join Lobby
            </button>
            <button
              type="button"
              className="vq-button menu-main-btn"
              onClick={() => setActiveOverlay("rules")}
            >
              Game Rules
            </button>
          </div>
        </section>

        <section className="menu-secondary-actions">
          <button
            type="button"
            className="vq-button menu-secondary-btn"
            onClick={() => setActiveOverlay("friend")}
          >
            Friend Code
          </button>
          <button
            type="button"
            className="vq-button menu-secondary-btn"
            onClick={() => setActiveOverlay("options")}
          >
            Options
          </button>
          <button
            type="button"
            className="vq-button menu-secondary-btn"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
          >
            Logout
          </button>
        </section>
      </main>

      {activeOverlay && (
        <div className="overlay-backdrop" role="dialog" aria-modal="true">
          <div className="overlay-card">
            {activeOverlay === "join" && (
              <>
                <h2 className="overlay-title">Join by Code</h2>
                <input
                  className="overlay-input"
                  placeholder="Enter join code"
                />
                <div className="overlay-actions">
                  <button
                    type="button"
                    className="vq-button"
                    onClick={() => setActiveOverlay(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="vq-button"
                    onClick={() => {
                      setActiveOverlay(null);
                      router.push("/lobbies/demo-lobby");
                    }}
                  >
                    Join
                  </button>
                </div>
              </>
            )}

            {activeOverlay === "rules" && (
              <>
                <h2 className="overlay-title">Game Rules</h2>
                <p className="overlay-text">
                  Build a Bingo line first. Submit proof for claimed tiles and
                  coordinate with your team in the lobby.
                </p>
                <div className="overlay-actions overlay-actions-single">
                  <button
                    type="button"
                    className="vq-button"
                    onClick={() => setActiveOverlay(null)}
                  >
                    Close
                  </button>
                </div>
              </>
            )}

            {activeOverlay === "friend" && (
              <>
                <h2 className="overlay-title">Friend Code</h2>
                <input
                  className="overlay-input"
                  placeholder="Share or paste a friend code"
                />
                <div className="overlay-actions overlay-actions-single">
                  <button
                    type="button"
                    className="vq-button"
                    onClick={() => setActiveOverlay(null)}
                  >
                    Close
                  </button>
                </div>
              </>
            )}

            {activeOverlay === "options" && (
              <>
                <h2 className="overlay-title">Game Options</h2>
                <label className="overlay-range-label">
                  Round duration
                  <input type="range" min={30} max={180} defaultValue={90} />
                </label>
                <div className="overlay-actions overlay-actions-single">
                  <button
                    type="button"
                    className="vq-button"
                    onClick={() => setActiveOverlay(null)}
                  >
                    Save
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
