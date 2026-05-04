"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createLobbyClient } from "@/api/lobbyService";
import { useApi } from "@/hooks/useApi";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ApplicationError } from "@/types/error";
import {
  clearStoredActiveLobbyId,
  getStoredActiveLobbyId,
  setStoredActiveLobbyId,
} from "@/utils/lobbySession";

type GameModeDTO = {
  id: string;
  name: string;
  rules: string[]; // [Find, Capture, Submission, Win]
};

const labels = ["Find", "Capture", "Submission", "Win"];

export default function MenuPage() {
  const router = useRouter();
  const api = useApi();
  const { loaded, isAuthenticated, logout, token, userId, username } = useAuthSession();
  
  const [activeOverlay, setActiveOverlay] = useState<"join" | "rules" | null>(null);
  const [activeLobbyId, setActiveLobbyId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [menuMessage, setMenuMessage] = useState<string | null>(null);
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"create" | "join" | "resume" | null>(null);

  const lobbyClient = useMemo(() => createLobbyClient({ api, token }), [api, token]);

  const avatarInitial = useMemo(() => {
    if (!username) return "U";
    return username.trim().charAt(0).toUpperCase() || "U";
  }, [username]);

  const [gameModes, setGameModes] = useState<GameModeDTO[]>([]);
  const [loadingGameModes, setLoadingGameModes] = useState(false);
  const [gameModesError, setGameModesError] = useState<string | null>(null);

  useEffect(() => {
    if (activeOverlay !== "rules") return;

    const fetchGameModes = async () => {
      setLoadingGameModes(true);
      setGameModesError(null);

      try {
        const response = await api.get<GameModeDTO[]>("/gameModes", token);
        setGameModes(response); 
      } catch (e) {
        setGameModesError("Failed to load game modes.");
      } finally {
        setLoadingGameModes(false);
      }
    };

    void fetchGameModes();
  }, [activeOverlay, api, token]);

  // Auth Schutz
  useEffect(() => {
    if (!loaded) return;
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, loaded, router]);

  // Lade gespeicherte Lobby nur wenn User Daten da sind
  useEffect(() => {
    if (loaded && isAuthenticated && userId && userId.trim() !== "") {
      const id = getStoredActiveLobbyId(userId);
      setActiveLobbyId(id);
    }
  }, [isAuthenticated, loaded, userId]);

  if (!loaded || !isAuthenticated) {
    return <div className="app-shell" />;
  }

  const handleCreateLobby = async () => {
    setMenuMessage(null);
    setPendingAction("create");
    try {
      const createdLobby = await lobbyClient.createLobby();
      setStoredActiveLobbyId(userId, createdLobby.lobbyId);
      router.push(`/lobbies/${createdLobby.lobbyId}`);
    } catch (_error) { // Gefixt: Unterstrich hinzugefügt
      setMenuMessage("Unable to create a lobby.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleJoinLobby = async () => {
    if (joinCode.length < 6) return;
    setOverlayError(null);
    setPendingAction("join");
    try {
      const joinedLobby = await lobbyClient.joinLobby(joinCode);
      if (joinedLobby && joinedLobby.lobbyId) {
        setStoredActiveLobbyId(userId, joinedLobby.lobbyId);
        router.push(`/lobbies/${joinedLobby.lobbyId}`);
      }
    } catch (_error) { // Gefixt: Unterstrich hinzugefügt
      setOverlayError("Invalid join code. Please enter a valid code!");
    } finally {
      setPendingAction(null);
    }
  };

  const handleResumeSession = async () => {
    if (!activeLobbyId) {
      return;
    }

    setMenuMessage(null);
    setPendingAction("resume");
    try {
      const currentLobby = await lobbyClient.getLobby(activeLobbyId);
      setStoredActiveLobbyId(userId, currentLobby.id);

      if (currentLobby.gameId) {
        router.push(`/lobbies/${currentLobby.id}/games/${currentLobby.gameId}`);
        return;
      }

      router.push(`/lobbies/${currentLobby.id}`);
    } catch (error) {
      const applicationError = error as ApplicationError | undefined;
      if (applicationError?.status === 403 || applicationError?.status === 404) {
        clearStoredActiveLobbyId(userId, activeLobbyId);
        setActiveLobbyId("");
        setMenuMessage("Your last lobby is no longer available.");
        return;
      }

      setMenuMessage("Unable to reconnect to your current lobby right now.");
    } finally {
      setPendingAction(null);
    }
  };

  const closeOverlay = () => {
    setActiveOverlay(null);
    setOverlayError(null);
    setJoinCode("");
  };

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient">
        <div className="bingo-rain-container">
          {[...Array(12)].map((_, i) => (
            <span key={i} className="rain-item">BINGO</span>
          ))}
        </div>

        <div className="menu-layout">
          <section className="menu-panel">
            <button type="button" className="menu-rules-trigger" onClick={() => setActiveOverlay("rules")}>i</button>
            <button type="button" className="menu-profile" onClick={() => router.push(`/users/${userId}`)}>
              <span className="menu-avatar">{avatarInitial}</span>
              <span className="menu-username">{username || "User"}</span>
            </button>
            <div className="menu-main-actions">
              <button type="button" className="vq-button menu-main-btn" onClick={() => void handleCreateLobby()} disabled={pendingAction !== null}>
                {pendingAction === "create" ? "Creating..." : "Create Lobby"}
              </button>
              <button type="button" className="vq-button menu-main-btn" onClick={() => setActiveOverlay("join")}>Join Lobby</button>
            </div>
          </section>

          {menuMessage && <div className="menu-status-card is-error">{menuMessage}</div>}

          <section className={`secondary-actions ${activeLobbyId ? "" : "is-single-item"}`}>
            {activeLobbyId && (
              <button
                type="button"
                className="vq-button menu-secondary-btn"
                onClick={() => void handleResumeSession()}
                disabled={pendingAction !== null}
              >
                {pendingAction === "resume" ? "Loading..." : "Take Me Back"}
              </button>
            )}
            <button type="button" className="vq-button menu-secondary-btn logout" onClick={() => { logout(); router.replace("/"); }}>Logout</button>
          </section>
        </div>

        {activeOverlay && (
          <div className="overlay-backdrop" onClick={closeOverlay}>
            <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
              
              {activeOverlay === "join" && (
                <>
                  <h2 className="overlay-title">Join Lobby</h2>
                  {overlayError && <div className="overlay-error-bubble">{overlayError}</div>}
                  <input
                    className="overlay-input"
                    placeholder="CODE"
                    value={joinCode}
                    maxLength={6}
                    autoFocus
                    onChange={(e) => {
                      setOverlayError(null);
                      setJoinCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase());
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && joinCode.length === 6 && pendingAction === null) {
                        void handleJoinLobby();
                      }
                    }}
                  />
                  <div className="overlay-actions">
                    <button type="button" className="vq-button btn-cancel" onClick={closeOverlay}>Cancel</button>
                    <button 
                      type="button"
                      className="vq-button btn-confirm" 
                      disabled={joinCode.length < 6 || pendingAction !== null} 
                      onClick={() => void handleJoinLobby()}
                    >
                      {pendingAction === "join" ? "..." : "Join"}
                    </button>
                  </div>
                </>
              )}

               {activeOverlay === "rules" && (
                  <div className="rules-content">
                    <h2 className="overlay-title">Game Rules</h2>

                    <div className="rules-section">
                      <div className="rules-scroll-container">
                        {loadingGameModes && <p>Loading...</p>}
                        {gameModesError && (
                          <p className="overlay-error-bubble">{gameModesError}</p>
                        )}

                        <div className="rules-horizontal-list">
                          {gameModes.map((mode) => (
                            <div key={mode.id} className="rules-card">
                              <h3 className="rules-subtitle">{mode.name}</h3>

                              <ul className="rules-bullet-list">
                                {mode.rules.map((rule, i) => (
                                  <li key={i}>
                                    <strong>{labels[i]}:</strong> {rule}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rules-section">
                      <h3 className="rules-subtitle">Tile Examples</h3>

                      <div className="rules-tile-grid">
                        <div className="rules-tile-item">
                          <button type="button" className="bingo-field-button">
                            <span className="tile-text">Tree</span>
                          </button>
                          <span>Unclaimed</span>
                        </div>

                        <div className="rules-tile-item">
                          <button
                            type="button"
                            className="bingo-field-button is-processing-friendly is-analyzing"
                            disabled
                          >
                            <div className="loader is-friendly"></div>
                          </button>
                          <span>In Validation</span>
                        </div>

                        <div className="rules-tile-item">
                          <button
                            type="button"
                            className="bingo-field-button is-claimed is-claimed-friendly"
                            disabled
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="white"
                              strokeWidth="4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="claimed-icon-svg"
                            >
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </button>
                          <span>Claimed Team 1</span>
                        </div>

                        <div className="rules-tile-item">
                          <button
                            type="button"
                            className="bingo-field-button is-claimed is-claimed-enemy"
                            disabled
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="white"
                              strokeWidth="4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="claimed-icon-svg"
                            >
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </button>
                          <span>Claimed Team 2</span>
                        </div>
                      </div>
                    </div>

                    <div className="overlay-actions overlay-actions-single">
                      <button
                        type="button"
                        className="btn-rules-confirm"
                        onClick={closeOverlay}
                      >
                        Got it!
                      </button>
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
