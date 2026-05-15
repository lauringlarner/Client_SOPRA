"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createLobbyClient } from "@/api/lobbyService";
import { GameRulesOverlay, GameModeDTO } from "@/components/GameRulesOverlay";
import StatsOverlay from "@/components/StatsOverlay"; 
import { useApi } from "@/hooks/useApi";
import { useAuthSession } from "@/hooks/useAuthSession";
import {
  clearStoredActiveLobbyId,
  clearStoredLobbyTeam,
  clearStoredSinglePlayerMode,
  getStoredSinglePlayerMode,
  setStoredActiveLobbyId,
  setStoredSinglePlayerMode,
  setStoredLobbyTeam,
} from "@/utils/lobbySession";
import { ApplicationError } from "@/types/error";
import {
  getLobbyTeamLabel,
  LOBBY_TEAMS,
  LobbyDetails,
  LobbyPlayer,
  LobbySelectableTeam,
  LobbyTeam,
  LobbyListType,
  SinglPlayereMode,
} from "@/types/lobby";

const MIN_GAME_DURATION = 5;
const MAX_GAME_DURATION = 120;
const TEAM_SECTIONS: LobbyTeam[] = [...LOBBY_TEAMS, null];

interface User {
  id: string;
  username: string;
  status: string;
  gamesPlayed: number;
  gamesWon: number;
}

export default function LobbyPage() {
  const api = useApi();
  const router = useRouter();
  const { loaded, isAuthenticated, token, userId } = useAuthSession();
  const params = useParams<{ lobbyId: string }>();
  const lobbyId = params.lobbyId;

  const [lobby, setLobby] = useState<LobbyDetails | null>(null);
  const [durationDraft, setDurationDraft] = useState("10");
  const [listTypeDraft, setListTypeDraft] = useState<LobbyListType>("all");
  const [isSinglePlayerDraft, setIsSinglePlayerDraft] = useState<SinglPlayereMode>(0);
  const [savedSinglePlayerMode, setSavedSinglePlayerMode] = useState<SinglPlayereMode>(0);
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "error">("connecting");
  const [pendingAction, setPendingActionState] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<{ text: string; tone: "info" | "error" } | null>(null);

  const [_selectedPlayer, setSelectedPlayer] = useState<LobbyPlayer | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLobbyClosedModal, setShowLobbyClosedModal] = useState(false);
  const autoStartSent = useRef(false);
  const latestLobbyRef = useRef<LobbyDetails | null>(null);

  // Rules state managed at lobby level for pre-fetching
  const [showRules, setShowRules] = useState(false);
  const [gameModes, setGameModes] = useState<GameModeDTO[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);

  const setPendingAction = (action: string | null) => {
    setPendingActionState(action);
  };

  const lobbyClient = useMemo(() => createLobbyClient({ api, token }), [api, token]);

  const lobbyPlayers = lobby?.lobbyPlayers ?? [];
  const currentPlayer = lobbyPlayers.find((p) => p.user.id === userId) ?? null;
  const isHost = currentPlayer?.isHost ?? false;
  const needsTeamSelection = currentPlayer?.team == null;
  const allPlayersReady = lobbyPlayers.length > 0 && lobbyPlayers.every((p) => p.isReady);
  const hasRequiredTeamCoverage = savedSinglePlayerMode === 1
    ? LOBBY_TEAMS.some((team) => lobbyPlayers.some((p) => p.team === team))
    : LOBBY_TEAMS.every((team) => lobbyPlayers.some((p) => p.team === team));

  const canAutoStart = allPlayersReady && hasRequiredTeamCoverage;
  const connectionSubtitle =
    connectionState === "error"
      ? "The latest lobby state could not be loaded."
      : connectionState === "live"
      ? "Share this code so other players can join the lobby."
      : "Loading the latest lobby state.";

  useEffect(() => {
    if (!loaded) return;
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, loaded, router]);

  useEffect(() => {
    if (!loaded || !isAuthenticated || !lobbyId) return;

    const checkLobbyExists = async () => {
      try {
        await lobbyClient.getLobby(lobbyId);
      } catch (error: unknown) {
        if (isFatalApplicationError(error)) {
          triggerExitSequence();
        }
      }
    };

    const interval = setInterval(checkLobbyExists, 1000);
    return () => clearInterval(interval);
  }, [loaded, isAuthenticated, lobbyId, lobbyClient, userId]);

  const triggerExitSequence = () => {
    setShowLobbyClosedModal(true);
    setTimeout(() => {
      clearStoredActiveLobbyId(userId, lobbyId);
      clearStoredLobbyTeam(userId, lobbyId);
      clearStoredSinglePlayerMode(userId, lobbyId);
      router.replace("/menu");
    }, 3000);
  };

  const openPlayerProfile = async (player: LobbyPlayer) => {
    if (profileLoading) return;
    setSelectedPlayer(player);
    setProfileLoading(true);
    setSelectedUser(null);
    try {
      const data = await api.get<User>(`/users/${player.user.id}`, token);
      setSelectedUser(data);
    } catch {
      setSelectedUser(null);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    if (!loaded || !isAuthenticated) return;

    let cancelled = false;
    latestLobbyRef.current = null;
    setLobby(null);
    setConnectionState("connecting");

    const applyLobbyDetails = (details: LobbyDetails) => {
      if (cancelled) return;
      latestLobbyRef.current = details;
      setStoredActiveLobbyId(userId, details.id);
      setLobby(details);
      setConnectionState("live");
      setPageMessage(null);
    };

    const handleLobbyError = (error: unknown, fallback: string) => {
      if (cancelled) return;
      if (isFatalApplicationError(error)) {
        triggerExitSequence();
        return;
      }
      const message = getLobbyErrorMessage(error, fallback);
      setPageMessage({ text: message, tone: "error" });
    };

    const unsubscribe = lobbyClient.subscribeToLobby(lobbyId, applyLobbyDetails, (err) => {
      handleLobbyError(err, "Realtime connection failed.");
    });

    void lobbyClient.getLobby(lobbyId).then(applyLobbyDetails).catch((err) => {
      handleLobbyError(err, "Unable to load lobby.");
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isAuthenticated, loaded, lobbyClient, lobbyId, userId]);

  useEffect(() => {
    const storedMode = getStoredSinglePlayerMode(userId, lobbyId);
    setSavedSinglePlayerMode(storedMode);
    setIsSinglePlayerDraft(storedMode);
  }, [lobbyId, userId]);

  useEffect(() => {
    if (lobby) {
      setDurationDraft(String(lobby.gameDuration));
      setListTypeDraft(lobby.listType ?? "all");
    }
  }, [lobby]);

  useEffect(() => {
    setStoredLobbyTeam(userId, lobbyId, currentPlayer?.team ?? null);
  }, [currentPlayer?.team, lobbyId, userId]);

  useEffect(() => {
    if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
      globalThis.localStorage.removeItem("teamName");
    }
  }, []);

  useEffect(() => {
    if (lobby?.gameId) router.replace(`/lobbies/${lobbyId}/games/${lobby.gameId}`);
  }, [lobby?.gameId, lobbyId, router]);

  useEffect(() => {
    if (!canAutoStart) autoStartSent.current = false;
  }, [canAutoStart]);

  useEffect(() => {
    if (!lobby || !isHost || !canAutoStart || autoStartSent.current || pendingAction !== null) return;

    autoStartSent.current = true;
    setPendingAction("start");
    setPageMessage({ text: "Starting the game...", tone: "info" });

    void lobbyClient.startLobby(lobbyId, savedSinglePlayerMode)
      .then((res) => {
        if (res.gameId) router.replace(`/lobbies/${lobbyId}/games/${res.gameId}`);
        else setPageMessage({ text: "Everyone is ready. Waiting for the game screen.", tone: "info" });
      })
      .catch((err) => {
        setPageMessage({ text: getLobbyErrorMessage(err, "Failed to start."), tone: "error" });
      })
      .finally(() => setPendingAction(null));
  }, [canAutoStart, isHost, lobby, lobbyClient, lobbyId, pendingAction, router, savedSinglePlayerMode]);

  // Pre-fetch game rules helper
  const handleOpenRules = async () => {
    if (rulesLoading) return;

    if (gameModes.length > 0) {
      setShowRules(true);
      return;
    }

    if (!token) return;

    setRulesLoading(true);
    setPageMessage(null);
    try {
      const data = await api.get<GameModeDTO[]>("/gameModes", token);
      setGameModes(data);
      setShowRules(true);
    } catch (_error) {
      setPageMessage({ text: "Failed to load game rules.", tone: "error" });
    } finally {
      setRulesLoading(false);
    }
  };

  const handleUpdateTeam = async (team: LobbySelectableTeam) => {
    if (!currentPlayer) return;
    setPendingAction(`team-${team}`);
    try {
      await lobbyClient.updatePlayerTeam(lobbyId, currentPlayer.id, team);
    } catch (err) {
      setPageMessage({ text: getLobbyErrorMessage(err, "Update failed."), tone: "error" });
    } finally {
      setPendingAction(null);
    }
  };

  const handleToggleReadyToggle = async () => {
    if (!currentPlayer) return;
    setPendingAction("ready");
    try {
      await lobbyClient.updatePlayerReady(lobbyId, currentPlayer.id, !currentPlayer.isReady);
    } catch (err) {
      setPageMessage({ text: getLobbyErrorMessage(err, "Action failed."), tone: "error" });
    } finally {
      setPendingAction(null);
    }
  };

  const handleSaveSettings = async () => {
    const parsed = Number.parseInt(durationDraft, 10);
    if (isNaN(parsed) || parsed < MIN_GAME_DURATION || parsed > MAX_GAME_DURATION) {
      setPageMessage({ text: `Duration: ${MIN_GAME_DURATION}-${MAX_GAME_DURATION}m`, tone: "error" });
      return;
    }
    setPendingAction("settings");
    try {
      await lobbyClient.updateSettings(lobbyId, parsed, listTypeDraft);
      setSavedSinglePlayerMode(isSinglePlayerDraft);
      setStoredSinglePlayerMode(userId, lobbyId, isSinglePlayerDraft);
      setPageMessage({ text: "Settings updated.", tone: "info" });
    } catch (err) {
      setPageMessage({ text: getLobbyErrorMessage(err, "Save failed."), tone: "error" });
    } finally {
      setPendingAction(null);
    }
  };

  const confirmDeleteLobby = async () => {
    setShowDeleteModal(false);
    setPendingAction("delete");
    try {
      await lobbyClient.deleteLobby(lobbyId);
      clearStoredActiveLobbyId(userId, lobbyId);
      clearStoredLobbyTeam(userId, lobbyId);
      clearStoredSinglePlayerMode(userId, lobbyId);
      router.replace("/menu");
    } catch (err) {
      setPageMessage({ text: getLobbyErrorMessage(err, "Delete failed."), tone: "error" });
      setPendingAction(null);
    }
  };

  const confirmLeaveLobby = async () => {
    setShowLeaveModal(false);
    setPendingAction("leave");
    try {
      await lobbyClient.leaveLobby(lobbyId);
      clearStoredActiveLobbyId(userId, lobbyId);
      clearStoredLobbyTeam(userId, lobbyId);
      clearStoredSinglePlayerMode(userId, lobbyId);
      router.replace("/menu");
    } catch (err) {
      setPageMessage({ text: getLobbyErrorMessage(err, "Leave failed."), tone: "error" });
      setPendingAction(null);
    }
  };

  if (!loaded || !isAuthenticated) return <div className="app-shell" />;

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient lobby-layout">
        <div className="lobby-top-actions">
          <button 
            className={`menu-rules-trigger ${rulesLoading ? "is-loading" : ""}`} 
            onClick={() => void handleOpenRules()}
            disabled={rulesLoading}
          >
            {rulesLoading ? "..." : "i"}
          </button>
          {profileLoading && <span className="profile-loading-spinner">...</span>}
        </div>

        <section className="lobby-card lobby-code-card">
          <div className="lobby-code-header">
            <div>
              <h1 className="lobby-code-title">Lobby Code</h1>
              <p className="lobby-code-subtitle">{connectionSubtitle}</p>
            </div>
          </div>
          <div className="lobby-code-box">
            {lobby?.joinCode ? formatJoinCode(lobby.joinCode) : "Loading..."}
          </div>
        </section>

        {pageMessage && (
          <section className={`lobby-card lobby-feedback-card ${pageMessage.tone === "error" ? "is-error" : "is-info"}`}>
            <p className="lobby-feedback-text">{pageMessage.text}</p>
          </section>
        )}

        {lobby && (
          <>
            <section className="lobby-card lobby-me-card">
              <div className="lobby-me-header">
                <div>
                  <h2 className="lobby-section-title">Your Seat</h2>
                  <p className="lobby-muted-note">
                    {currentPlayer?.user.username}{currentPlayer?.isHost ? " • Host" : ""}
                  </p>
                </div>
                {currentPlayer && (
                  <span className={`lobby-player-badge ${currentPlayer.isReady ? "is-ready" : "is-pending"}`}>
                    {currentPlayer.isReady ? "Ready" : "Not Ready"}
                  </span>
                )}
              </div>

              {currentPlayer && (
                <>
                  <div className="lobby-team-selector">
                    {LOBBY_TEAMS.map((team) => (
                      <button
                        key={team}
                        className={`vq-button lobby-team-option ${currentPlayer.team === team ? "is-selected" : ""}`}
                        disabled={pendingAction !== null}
                        onClick={() => void handleUpdateTeam(team)}
                      >
                        {getLobbyTeamLabel(team)}
                      </button>
                    ))}
                  </div>
                  <button
                    className={`vq-button lobby-ready-toggle ${currentPlayer.isReady ? "is-ready" : ""}`}
                    disabled={pendingAction !== null || needsTeamSelection}
                    onClick={() => void handleToggleReadyToggle()}
                  >
                    {pendingAction === "ready" ? "Updating..." : currentPlayer.isReady ? "Not Ready" : "Ready"}
                  </button>
                </>
              )}
            </section>

            <section className="lobby-card lobby-settings-card">
              <details className="settings-accordion">
                <summary className="lobby-section-title settings-summary">
                  Game Settings <span className="chevron">▼</span>
                </summary>

                <div className="settings-content">
                  <label className="lobby-settings-field">
                    <span className="lobby-settings-label">
                      Round duration: <strong>{durationDraft}</strong> min
                    </span>
                    <input
                      className="range-slider"
                      type="range"
                      min={MIN_GAME_DURATION}
                      max={MAX_GAME_DURATION}
                      step="1"
                      value={durationDraft}
                      disabled={!isHost || pendingAction !== null}
                      onChange={(e) => setDurationDraft(e.target.value)}
                    />
                  </label>

                  <label className="lobby-settings-field">
                    <span className="lobby-settings-label">What kind of objects do you want to search?</span>
                    <select
                      className="field-input"
                      value={listTypeDraft}
                      disabled={!isHost || pendingAction !== null}
                      onChange={(e) => setListTypeDraft(e.target.value as LobbyListType)}
                    >
                      <option value="all">Outdoor and Indoor objects</option>
                      <option value="outside">Outdoor objects</option>
                      <option value="inside">Indoor objects</option>
                      <option value="demo">Demo Mode</option>
                    </select>
                  </label>

                  <div className="lobby-settings-field">
                    <span className="lobby-settings-label">Singleplayer</span>
                    <label className="lobby-toggle-switch">
                      <input
                        type="checkbox"
                        checked={isSinglePlayerDraft === 1}
                        disabled={!isHost || pendingAction !== null}
                        onChange={(e) => setIsSinglePlayerDraft(e.target.checked ? 1 : 0)}
                      />
                      <span className="lobby-toggle-track" />
                    </label>
                  </div>

                  {isHost && (
                    <button
                      className="vq-button"
                      disabled={pendingAction !== null}
                      onClick={() => void handleSaveSettings()}
                    >
                      {pendingAction === "settings" ? "Saving..." : "Save Settings"}
                    </button>
                  )}
                </div>
              </details>
            </section>

            {TEAM_SECTIONS.map((team) => {
              const players = lobbyPlayers.filter((p) => p.team === team);
              if (players.length === 0) return null;

              return (
                <section key={team ?? "none"} className="lobby-card lobby-team-card">
                  <h2 className="lobby-section-title">{getLobbyTeamLabel(team)}</h2>
                  <div className="lobby-team-list">
                    {players.map((p) => (
                      <LobbyPlayerCard
                        key={p.id}
                        player={p}
                        isSelf={p.user.id === userId}
                        onClick={() => openPlayerProfile(p)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            <section className="lobby-card lobby-action-bar">
              <button
                className="vq-button lobby-action-btn"
                disabled={pendingAction !== null}
                onClick={() => (isHost ? setShowDeleteModal(true) : setShowLeaveModal(true))}
              >
                {isHost ? "Delete Lobby" : "Leave Lobby"}
              </button>
            </section>
          </>
        )}

        {showDeleteModal && (
          <div className="guard-backdrop" onClick={() => setShowDeleteModal(false)}>
            <div className="guard-panel" onClick={(e) => e.stopPropagation()}>
              <h2 className="guard-title">Delete Lobby</h2>
              <div className="guard-flow">
                <button className="guard-action primary-red" onClick={() => void confirmDeleteLobby()}>Delete</button>
                <button className="guard-action secondary-teal" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {showLeaveModal && (
          <div className="guard-backdrop" onClick={() => setShowLeaveModal(false)}>
            <div className="guard-panel" onClick={(e) => e.stopPropagation()}>
              <h2 className="guard-title">Leave Lobby</h2>
              <div className="guard-flow">
                <button className="guard-action primary-red" onClick={() => void confirmLeaveLobby()}>Leave</button>
                <button className="guard-action secondary-teal" onClick={() => setShowLeaveModal(false)}>Stay</button>
              </div>
            </div>
          </div>
        )}

        {showLobbyClosedModal && (
          <div className="guard-backdrop">
            <div className="guard-panel">
              <h2 className="guard-title">Lobby Closed</h2>
              <p className="guard-description">
                The host has deleted the lobby. You will now be redirected to the menu.
              </p>
              <div className="guard-loader-container">
                <div className="guard-loader"></div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* GAME RULES OVERLAY */}
      <GameRulesOverlay 
        isOpen={showRules} 
        onClose={() => setShowRules(false)} 
        gameModes={gameModes} 
      />

      {/* REUSABLE STATS OVERLAY INTEGRATION */}
      <StatsOverlay 
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        gamesPlayed={selectedUser?.gamesPlayed ?? 0}
        gamesWon={selectedUser?.gamesWon ?? 0}
      />
    </div>
  );
}

function LobbyPlayerCard({ player, isSelf, onClick }: { player: LobbyPlayer; isSelf: boolean; onClick?: () => void; }) {
  const initial = player.user.username.charAt(0).toUpperCase() || "P";
  return (
    <article className={`lobby-player-item ${isSelf ? "is-self" : ""}`} onClick={onClick}>
      <span className="lobby-player-icon">{initial}</span>
      <div className="lobby-player-copy">
        <span className="lobby-player-name">{player.user.username}{isSelf ? " (You)" : ""}</span>
      </div>
      <span className={`lobby-player-badge ${player.isReady ? "is-ready" : "is-pending"}`}>
        {player.isReady ? "Ready" : "Not Ready"}
      </span>
    </article>
  );
}

function formatJoinCode(v: string) { return v.toUpperCase().slice(0, 6); }
function getConnectionLabel(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
function getLobbyErrorMessage(e: unknown, f: string) { return (e as ApplicationError)?.message || f; }
function isFatalApplicationError(e: unknown) {
  const status = (e as ApplicationError)?.status;
  return status === 403 || status === 404;
}