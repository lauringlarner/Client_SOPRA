"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createLobbyClient } from "@/api/lobbyService";
import { useApi } from "@/hooks/useApi";
import { useAuthSession } from "@/hooks/useAuthSession";
import {
  clearStoredActiveLobbyId,
  setStoredActiveLobbyId,
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
} from "@/types/lobby";

const MIN_GAME_DURATION = 5;
const MAX_GAME_DURATION = 20;
const BOARD_SIZE = 4;
const TEAM_SECTIONS: LobbyTeam[] = [...LOBBY_TEAMS, null];

export default function LobbyPage() {
  const api = useApi();
  const router = useRouter();
  const { loaded, isAuthenticated, token, userId } = useAuthSession();
  const params = useParams<{ lobbyId: string }>();
  const lobbyId = params.lobbyId;

  const [lobby, setLobby] = useState<LobbyDetails | null>(null);
  const [durationDraft, setDurationDraft] = useState("10");
  const [connectionState, setConnectionState] = useState<
    "connecting" | "live" | "error"
  >("connecting");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<{
    text: string;
    tone: "info" | "error";
  } | null>(null);
  const autoStartSent = useRef(false);
  const latestLobbyRef = useRef<LobbyDetails | null>(null);

  const lobbyClient = useMemo(() => createLobbyClient({
    api,
    token,
  }), [api, token]);

  const lobbyPlayers = lobby?.lobbyPlayers ?? [];
  const playerCount = lobbyPlayers.length;
  const currentPlayer = lobbyPlayers.find((player: LobbyPlayer) => player.user.id === userId) ?? null;
  const isHost = currentPlayer?.isHost ?? false;
  const needsTeamSelection = currentPlayer?.team == null;
  const allPlayersReady =
    lobbyPlayers.length > 0 &&
    lobbyPlayers.every((player: LobbyPlayer) => player.isReady);
  const bothTeamsHavePlayers = LOBBY_TEAMS.every((team: LobbySelectableTeam) =>
    lobbyPlayers.some((player: LobbyPlayer) => player.team === team),
  );
  const canAutoStart = allPlayersReady && bothTeamsHavePlayers;
  const connectionSubtitle =
    connectionState === "error"
      ? "The latest lobby state could not be loaded."
      : connectionState === "live"
      ? "Share this code so other players can join the lobby."
      : "Loading the latest lobby state.";
  const actionNote = pendingAction === "start"
    ? "Everyone is ready. Starting the game."
    : !currentPlayer
    ? "Your player entry is missing from this lobby."
    : playerCount < 2
    ? "At least 2 players are required before the game can start."
    : !bothTeamsHavePlayers
    ? "Each team needs at least one player before the game can start."
    : !allPlayersReady
    ? "The game starts automatically once everyone is ready."
    : !isHost
    ? "Everyone is ready. Waiting for the game to start."
    : null;

  useEffect(() => {
    if (!loaded) return;
    if (!isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, loaded, router]);

  // Heartbeat Check: Stellt sicher, dass gelöschte Lobbies bemerkt werden
  useEffect(() => {
    if (!loaded || !isAuthenticated || !lobbyId) return;

    const checkLobbyExists = async () => {
      try {
          await lobbyClient.getLobby(lobbyId);
        } catch (error: unknown) {
          const appError = error as ApplicationError;
          if (appError.status === 404 || appError.status === 403) {
            clearStoredActiveLobbyId(userId, lobbyId);
            router.replace("/menu");
          }
        }
    };

    const interval = setInterval(checkLobbyExists, 1000);
    return () => clearInterval(interval);
  }, [loaded, isAuthenticated, lobbyId, lobbyClient, userId, router]);

  useEffect(() => {
    if (!loaded || !isAuthenticated) return;

    let cancelled = false;
    latestLobbyRef.current = null;
    setLobby(null);
    setConnectionState("connecting");
    setPageMessage(null);

    const applyLobbyDetails = (details: LobbyDetails) => {
      if (cancelled) {
        return;
      }

      latestLobbyRef.current = details;
      setStoredActiveLobbyId(userId, details.id);
      setLobby(details);
      setConnectionState("live");
      setPageMessage(null);
    };

    const handleLobbyError = (error: unknown, fallback: string) => {
      if (cancelled) {
        return;
      }

      const message = getLobbyErrorMessage(error, fallback);
      if (isFatalApplicationError(error)) {
        clearStoredActiveLobbyId(userId, lobbyId);
        router.replace("/menu");
        return;
      }

      if (latestLobbyRef.current) {
        setPageMessage({
          text: message,
          tone: "error",
        });
        return;
      }

      setConnectionState("connecting");
      setPageMessage({
        text: message,
        tone: "error",
      });
    };

    const unsubscribe = lobbyClient.subscribeToLobby(
      lobbyId,
      applyLobbyDetails,
      (error) => {
        handleLobbyError(error, "Realtime connection failed. Waiting for the live lobby state.");
      },
    );

    void lobbyClient
      .getLobby(lobbyId)
      .then(applyLobbyDetails)
      .catch((error: unknown) => {
        handleLobbyError(error, "Unable to load the lobby yet. Waiting for the live lobby state.");
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isAuthenticated, loaded, lobbyClient, lobbyId, userId, router]);

  useEffect(() => {
    if (!lobby) return;
    setDurationDraft(String(lobby.gameDuration));
  }, [lobby?.gameDuration]);

  useEffect(() => {
    setStoredLobbyTeam(userId, lobbyId, currentPlayer?.team ?? null);
  }, [currentPlayer?.team, lobbyId, userId]);

  useEffect(() => {
    if (typeof globalThis === "undefined" || !("localStorage" in globalThis)) return;
    globalThis.localStorage.removeItem("teamName");
  }, []);

  useEffect(() => {
    if (!lobby?.gameId) return;
    router.replace(`/lobbies/${lobbyId}/games/${lobby.gameId}`);
  }, [lobby?.gameId, lobbyId, router, userId]);

  useEffect(() => {
    if (!canAutoStart) {
      autoStartSent.current = false;
    }
  }, [canAutoStart]);

  useEffect(() => {
    if (!lobby || !isHost || !canAutoStart || autoStartSent.current || pendingAction !== null) return;

    autoStartSent.current = true;
    setPendingAction("start");
    setPageMessage({
      text: "Everyone is ready. Starting the game.",
      tone: "info",
    });

    void lobbyClient
      .startLobby(lobbyId)
      .then((result) => {
        if (result.gameId) {
          router.replace(`/lobbies/${lobbyId}/games/${result.gameId}`);
          return;
        }

        setPageMessage({
          text: "Everyone is ready. Waiting for the game screen.",
          tone: "info",
        });
      })
      .catch((error) => {
        autoStartSent.current = false;
        setPageMessage({
          text: getLobbyErrorMessage(error, "The lobby action could not be completed."),
          tone: "error",
        });
      })
      .finally(() => {
        setPendingAction(null);
      });
  }, [canAutoStart, isHost, lobby, lobbyClient, lobbyId, pendingAction, router, userId]);

  if (!loaded || !isAuthenticated) {
    return <div className="app-shell" />;
  }

  const runLobbyAction = async (
    actionKey: string,
    action: () => Promise<void>,
  ): Promise<void> => {
    setPendingAction(actionKey);
    setPageMessage(null);

    try {
      await action();
    } catch (error) {
      setPageMessage({
        text: getLobbyErrorMessage(error, "The lobby action could not be completed."),
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleUpdateTeam = async (team: LobbySelectableTeam): Promise<void> => {
    if (!currentPlayer) return;
    await runLobbyAction(`team-${team}`, async () => {
      await lobbyClient.updatePlayerTeam(lobbyId, currentPlayer.id, team);
    });
  };

  const handleToggleReady = async (): Promise<void> => {
    if (!currentPlayer) return;
    await runLobbyAction("ready", async () => {
      await lobbyClient.updatePlayerReady(
        lobbyId,
        currentPlayer.id,
        !currentPlayer.isReady,
      );
    });
  };

  const handleSaveSettings = async (): Promise<void> => {
    const parsedDuration = Number.parseInt(durationDraft, 10);
    if (!Number.isInteger(parsedDuration) || parsedDuration < MIN_GAME_DURATION || parsedDuration > MAX_GAME_DURATION) {
      setPageMessage({
        text: `Round duration must be between ${MIN_GAME_DURATION} and ${MAX_GAME_DURATION} minutes.`,
        tone: "error",
      });
      return;
    }

    await runLobbyAction("settings", async () => {
      await lobbyClient.updateSettings(lobbyId, parsedDuration);
      setPageMessage({
        text: "Lobby settings updated.",
        tone: "info",
      });
    });
  };

  const handleDeleteLobby = async (): Promise<void> => {
    await runLobbyAction("delete", async () => {
      await lobbyClient.deleteLobby(lobbyId);
      clearStoredActiveLobbyId(userId, lobbyId);
      router.replace("/menu");
    });
  };

  const handleLeaveLobby = async (): Promise<void> => {
    await runLobbyAction("leave", async () => {
      await lobbyClient.leaveLobby(lobbyId);
      clearStoredActiveLobbyId(userId, lobbyId);
      router.replace("/menu");
    });
  };

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient lobby-layout">
        <section className="lobby-card lobby-code-card">
          <div className="lobby-code-header">
            <div>
              <h1 className="lobby-code-title">Lobby Code</h1>
              <p className="lobby-code-subtitle">
                {connectionSubtitle}
              </p>
            </div>
            <span className={`lobby-connection-pill is-${connectionState}`}>
              {getConnectionLabel(connectionState)}
            </span>
          </div>
          <div className="lobby-code-box">
            {lobby?.joinCode ? formatJoinCode(lobby.joinCode) : "Loading..."}
          </div>
        </section>

        {pageMessage && (lobby || connectionState !== "error") && (
          <section className={`lobby-card lobby-feedback-card ${pageMessage.tone === "error" ? "is-error" : "is-info"}`}>
            <p className="lobby-feedback-text">{pageMessage.text}</p>
          </section>
        )}

        {!lobby && (
          <section className="lobby-card lobby-loading-card">
            <h2 className="lobby-section-title">
              {connectionState === "error" ? "Lobby unavailable" : "Connecting to lobby"}
            </h2>
            <p className="lobby-muted-note">
              {connectionState === "error"
                ? pageMessage?.text ?? "Head back to the menu and create or join again."
                : "Waiting for the first lobby update from the stream."}
            </p>
            <button
              type="button"
              className="vq-button"
              onClick={() => router.replace("/menu")}
            >
              Back to Menu
            </button>
          </section>
        )}

        {lobby && (
          <>
            <section className="lobby-card lobby-me-card">
              <div className="lobby-me-header">
                <div>
                  <h2 className="lobby-section-title">Your Seat</h2>
                  <p className="lobby-muted-note">
                    {currentPlayer
                      ? `${currentPlayer.user.username}${currentPlayer.isHost ? " • Host" : ""}`
                      : "You are not currently registered as a player in this lobby."}
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
                        type="button"
                        className={`vq-button lobby-team-option ${currentPlayer.team === team ? "is-selected" : ""}`}
                        disabled={pendingAction !== null}
                        onClick={() => void handleUpdateTeam(team)}
                      >
                        {getLobbyTeamLabel(team)}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className={`vq-button lobby-ready-toggle ${currentPlayer.isReady ? "is-ready" : ""}`}
                    disabled={pendingAction !== null || needsTeamSelection}
                    onClick={() => void handleToggleReady()}
                  >
                    {pendingAction === "ready"
                      ? "Updating..."
                      : currentPlayer.isReady
                      ? "Not Ready"
                      : "Ready"}
                  </button>

                  {needsTeamSelection && (
                    <p className="lobby-muted-note">Pick a team first to enable Ready.</p>
                  )}
                </>
              )}
            </section>

            <section className="lobby-card lobby-settings-card">
              <div className="lobby-settings-heading">
                <div>
                  <h2 className="lobby-section-title">Game Settings</h2>
                  <p className="lobby-muted-note">
                    Board size: {BOARD_SIZE}x{BOARD_SIZE}
                  </p>
                </div>
                <span className="lobby-settings-tag">
                  {lobby.lobbyPlayers.length} player{lobby.lobbyPlayers.length === 1 ? "" : "s"}
                </span>
              </div>

              <label className="lobby-settings-field">
                <span className="lobby-settings-label">Round duration (minutes)</span>
                <input
                  className="field-input"
                  type="number"
                  min={MIN_GAME_DURATION}
                  max={MAX_GAME_DURATION}
                  value={durationDraft}
                  disabled={!isHost || pendingAction === "settings" || pendingAction === "start"}
                  onChange={(event) => setDurationDraft(event.target.value)}
                />
              </label>

              {isHost ? (
                <button
                  type="button"
                  className="vq-button"
                  disabled={pendingAction !== null}
                  onClick={() => void handleSaveSettings()}
                >
                  {pendingAction === "settings" ? "Saving..." : "Save Settings"}
                </button>
              ) : (
                <p className="lobby-muted-note">
                  Only the host can change the lobby settings.
                </p>
              )}
            </section>

            {TEAM_SECTIONS.map((team) => {
              const players = lobbyPlayers.filter((player) => player.team === team);

              return (
                <section key={team ?? "none"} className="lobby-card lobby-team-card">
                  <div className="lobby-team-header">
                    <h2 className="lobby-section-title">{getLobbyTeamLabel(team)}</h2>
                    <span className="lobby-team-count">
                      {players.length} player{players.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {players.length === 0 ? (
                    <p className="lobby-empty-state">
                      No players in this group yet.
                    </p>
                  ) : (
                    <div className="lobby-team-list">
                      {players.map((player) => (
                        <React.Fragment key={player.id}>
                          <LobbyPlayerCard
                            player={player}
                            isSelf={player.user.id === userId}
                          />
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}

            <section className="lobby-action-bar">
              <button
                type="button"
                className="vq-button lobby-action-btn"
                disabled={pendingAction !== null}
                onClick={() =>
                  void (isHost ? handleDeleteLobby() : handleLeaveLobby())
                }
              >
                {pendingAction === "delete"
                  ? "Closing..."
                  : pendingAction === "leave"
                  ? "Leaving..."
                  : isHost
                  ? "Delete Lobby"
                  : "Leave Lobby"}
              </button>

              <button
                type="button"
                className="vq-button lobby-action-btn"
                onClick={() => router.push("/menu")}
              >
                Back to Menu
              </button>

              {actionNote && (
                <p className="lobby-action-note">
                  {actionNote}
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function LobbyPlayerCard({
  player,
  isSelf,
}: {
  player: LobbyPlayer;
  isSelf: boolean;
}) {
  const initial = player.user.username.charAt(0).toUpperCase() || "P";

  return (
    <article className={`lobby-player-item ${isSelf ? "is-self" : ""}`}>
      <span className="lobby-player-icon">{initial}</span>
      <div className="lobby-player-copy">
        <span className="lobby-player-team">
          {player.isHost ? "Host" : "Player"} • {player.isReady ? "Ready" : "Not Ready"}
        </span>
        <span className="lobby-player-name">
          {player.user.username}
          {isSelf ? " (You)" : ""}
        </span>
      </div>
      <span className={`lobby-player-badge ${player.isReady ? "is-ready" : "is-pending"}`}>
        {player.isReady ? "Ready" : "Not Ready"}
      </span>
    </article>
  );
}

function formatJoinCode(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 6)
    .replace(/(.{3})/g, "$1 ")
    .trim();
}

function getConnectionLabel(
  state: "connecting" | "live" | "error",
): string {
  if (state === "live") return "Live";
  if (state === "error") return "Issue";
  return "Connecting";
}

function getLobbyErrorMessage(
  error: unknown,
  fallback: string,
): string {
  const applicationError = error as ApplicationError | undefined;
  if (applicationError?.status === 403) return applicationError.message;
  if (applicationError?.status === 404) return "This lobby could not be found anymore.";
  if (applicationError?.status === 409) return applicationError.message;
  if (applicationError instanceof Error && applicationError.message.trim() !== "") return applicationError.message;
  return fallback;
}

function isFatalApplicationError(error: unknown): boolean {
  const applicationError = error as ApplicationError | undefined;
  return applicationError?.status === 403 || applicationError?.status === 404;
}
