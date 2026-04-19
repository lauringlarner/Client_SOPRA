"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createGameClient } from "@/api/gameService";
import { createLobbyClient } from "@/api/lobbyService";
import { useApi } from "@/hooks/useApi";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ApplicationError } from "@/types/error";
import { GameDetails, GameTileStatus } from "@/types/game";
import {
  BackendTeamName,
  buildTeamScores,
  getTilePerspective,
  normalizeBackendTeamName,
  TeamPerspective,
  TeamScoreViewModel,
} from "@/utils/gamePerspective";
import {
  clearLastSubmissionWord,
  getLastSubmissionWord,
} from "@/utils/submissionFeedback";

export default function GameBoardPage() {
  const api = useApi();
  const router = useRouter();
  const { loaded, isAuthenticated, token, userId } = useAuthSession();
  const params = useParams<{ lobbyId: string; gameId: string }>();
  const lobbyId = params.lobbyId;
  const gameId = params.gameId;

  // --- States ---
  const [game, setGame] = useState<GameDetails | null>(null);
  const [myTeamName, setMyTeamName] = useState<BackendTeamName | null>(null);
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "error">("connecting");
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const previousStatuses = useRef<Map<string, GameTileStatus>>(new Map());
  const gameClient = useMemo(() => createGameClient({ token }), [token]);
  const lobbyClient = useMemo(() => createLobbyClient({ api, token }), [api, token]);

  // --- Timer Logik (Hooks müssen oben stehen!) ---
  useEffect(() => {
    if (game && remainingSeconds === null) {
      setRemainingSeconds(game.gameDuration * 60);
    }
  }, [game, remainingSeconds]);

  useEffect(() => {
    if (remainingSeconds === null || remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [remainingSeconds]);

  const progressWidth = useMemo(() => {
    if (!game || remainingSeconds === null) return "100%";
    const totalSeconds = game.gameDuration * 60;
    const percentage = (remainingSeconds / totalSeconds) * 100;
    return `${Math.max(0, Math.min(100, percentage))}%`;
  }, [remainingSeconds, game?.gameDuration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // --- Auth & Lobby Effekte ---
  useEffect(() => {
    if (!loaded) return;
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }
    if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
      globalThis.localStorage.removeItem("teamName");
    }
  }, [isAuthenticated, loaded, router]);

  useEffect(() => {
    if (!loaded || !isAuthenticated) return;

    setConnectionState("connecting");
    setPageMessage(null);

    return gameClient.subscribeToGame(
      gameId,
      (details) => {
        setGame(details);
        setConnectionState("live");
      },
      (error) => {
        setGame(null);
        setConnectionState("error");
        setPageMessage(getGameErrorMessage(error, "Unable to load this game."));
      },
    );
  }, [gameClient, gameId, isAuthenticated, loaded]);

  useEffect(() => {
    if (!loaded || !isAuthenticated || userId.trim() === "") return;

    return lobbyClient.subscribeToLobby(
      lobbyId,
      (details) => {
        const currentPlayer = details.lobbyPlayers.find((p) => p.user.id === userId) ?? null;
        setMyTeamName(normalizeBackendTeamName(currentPlayer?.team ?? null));
      },
      () => {}
    );
  }, [isAuthenticated, loaded, lobbyClient, lobbyId, userId]);

  useEffect(() => {
    if (!game || !myTeamName) return;

    const nextStatuses = new Map<string, GameTileStatus>();
    let failedSubmissionDetected = false;
    const lastSubmittedWord = getLastSubmissionWord();

    game.tileGrid.forEach((row, rowIndex) => {
      row.forEach((tile, colIndex) => {
        const key = `${rowIndex}-${colIndex}`;
        const previousStatus = previousStatuses.current.get(key);
        nextStatuses.set(key, tile.status);

        if (lastSubmittedWord === tile.word && previousStatus && isFriendlyProcessing(previousStatus, myTeamName) && tile.status === "UNCLAIMED") {
          failedSubmissionDetected = true;
          clearLastSubmissionWord();
        }

        if (lastSubmittedWord === tile.word && previousStatus && isFriendlyProcessing(previousStatus, myTeamName) && isClaimedStatus(tile.status)) {
          clearLastSubmissionWord();
        }
      });
    });

    previousStatuses.current = nextStatuses;
    if (failedSubmissionDetected) {
      setSubmissionNotice("Your last submission was not recognized. You can try again.");
    }
  }, [game, myTeamName]);

  // --- Render Logik ---
  if (!loaded || !isAuthenticated) return <div className="app-shell" />;

  const teamScores: TeamScoreViewModel[] = game && myTeamName
    ? buildTeamScores(myTeamName, game.score_1, game.score_2)
    : [];

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient bingo-frame-layout">
        {(!game || !myTeamName) && (
          <section className="lobby-card lobby-loading-card">
            <h2 className="lobby-section-title">
              {connectionState === "error" ? "Game unavailable" : "Connecting to game"}
            </h2>
            <p className="lobby-muted-note">
              {pageMessage ?? (game ? "Resolving your team from the lobby." : "Waiting for the first game update from the stream.")}
            </p>
            <button
              type="button"
              className="vq-button"
              onClick={() => router.replace(`/lobbies/${lobbyId}`)}
            >
              Back to Lobby
            </button>
          </section>
        )}

        {game && myTeamName && (
          <>
            {pageMessage && (
              <section className="lobby-card lobby-feedback-card is-error">
                <p className="lobby-feedback-text">{pageMessage}</p>
              </section>
            )}
            
            <section className="bingo-team-points-container" aria-label="Team Scores">
              {teamScores.map((score) => (
                <div
                  key={score.label}
                  className={`bingo-team-points-card ${getPerspectiveCardClass(score.perspective)}`}
                >
                  <span className="bingo-team-points-card-text">{score.label}<br />Points:</span>
                  <span className="bingo-team-points-card-points">{score.totalPoints}</span>
                </div>
              ))}
            </section>

            <div className="bingo-time-bar-container">
              <div className="bingo-time-bar-label">
                Time Remaining: {remainingSeconds !== null ? formatTime(remainingSeconds) : "..."}
              </div>
              <div className="bingo-time-bar-track">
                <div 
                  className="bingo-time-bar-fill" 
                  style={{ 
                    width: progressWidth,
                    transition: "width 1s linear" 
                  }}
                />
              </div>
            </div>

            <section className="bingo-panel">
              <div className="bingo-card">
                {game.tileGrid.map((row, rowIndex) => (
                  <div key={`row-${rowIndex}`} className="bingo-row-frame">
                    {row.map((tile, colIndex) => {
                      const tileIndex = rowIndex * row.length + colIndex;
                      const isClaimed = isClaimedStatus(tile.status);
                      const isProcessing = isProcessingStatus(tile.status);
                      const stateClass = getTileStateClass(tile.status, myTeamName);
                      const loaderClass = getTileLoaderClass(tile.status, myTeamName);

                      return (
                        <button
                          key={`tile-${tileIndex}`}
                          type="button"
                          className={`bingo-field-button ${stateClass} ${isProcessing ? "is-analyzing" : ""}`}
                          disabled={isClaimed || isProcessing}
                          onClick={() => {
                            if (lobbyId && gameId) {
                              router.push(`/lobbies/${lobbyId}/games/${gameId}/submission?tileWord=${encodeURIComponent(tile.word)}`);
                            }
                          }}
                        >
                          {isProcessing ? (
                            <div className={`loader ${loaderClass}`}></div>
                          ) : isClaimed ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="claimed-icon-svg">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          ) : (
                            <span className="tile-text">{tile.word}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>

            {submissionNotice && (
              <p className="bingo-submission-note">
                {submissionNotice}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// --- Helper Functions ---

function getTileStateClass(status: GameTileStatus, myTeamName: BackendTeamName): string {
  if (status === "UNCLAIMED") return "";
  if (isClaimedStatus(status)) {
    return getTilePerspective(status, myTeamName) === "own" ? "is-claimed is-claimed-friendly" : "is-claimed is-claimed-enemy";
  }
  if (isProcessingStatus(status)) {
    return getTilePerspective(status, myTeamName) === "own" ? "is-processing-friendly is-analyzing" : "is-processing-enemy is-analyzing";
  }
  return "";
}

function getTileLoaderClass(status: GameTileStatus, myTeamName: BackendTeamName): string {
  if (!isProcessingStatus(status)) return "";
  return getTilePerspective(status, myTeamName) === "own" ? "is-friendly" : "is-enemy";
}

function getPerspectiveCardClass(perspective: TeamPerspective): string {
  return perspective === "own" ? "is-friendly" : "is-enemy";
}

function isClaimedStatus(status: GameTileStatus): boolean {
  return status === "CLAIMED_TEAM1" || status === "CLAIMED_TEAM2";
}

function isProcessingStatus(status: GameTileStatus): boolean {
  return status === "PROCESSING_TEAM1" || status === "PROCESSING_TEAM2";
}

function isFriendlyProcessing(status: GameTileStatus, myTeamName: BackendTeamName): boolean {
  return isProcessingStatus(status) && getTilePerspective(status, myTeamName) === "own";
}

function getGameErrorMessage(error: unknown, fallback: string): string {
  const applicationError = error as ApplicationError | undefined;
  if (applicationError?.status === 403) return applicationError.message;
  if (applicationError?.status === 404) return "This game could not be found anymore.";
  if (applicationError instanceof Error && applicationError.message.trim() !== "") return applicationError.message;
  return fallback;
}