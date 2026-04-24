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
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [showRules, setShowRules] = useState(false);

  const previousStatuses = useRef<Map<string, GameTileStatus>>(new Map());
  const gameClient = useMemo(() => createGameClient({ api, token }), [token]);
  const lobbyClient = useMemo(() => createLobbyClient({ api, token }), [api, token]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const remainingSeconds = useMemo(() => {
    if (!game) {
      return null;
    }

    const totalSeconds = game.gameDuration * 60;
    const startedAtMs = Date.parse(game.startedAt);

    if (Number.isNaN(startedAtMs)) {
      return totalSeconds;
    }

    const elapsedSeconds = Math.floor((nowMs - startedAtMs) / 1000);
    return Math.max(0, totalSeconds - elapsedSeconds);
  }, [game, nowMs]);

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

    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      try {
        setConnectionState("connecting");
        setPageMessage(null);

        // ✅ INITIAL GAME FETCH (missing in your code)
        const initial = await gameClient.getGame(gameId); 
        // OR api call if you don't have it yet

        if (initial) {
          setGame(initial);
          setConnectionState("live");
        }

        unsubscribe = gameClient.subscribeToGame(
          gameId,
          (details) => {
            setGame(details);
            setConnectionState("live");
          },
          (error) => {
            setGame(null);
            setConnectionState("error");
            setPageMessage(
              getGameErrorMessage(error, "Unable to load this game.")
            );
          },
        );
      } catch (error) {
        setConnectionState("error");
        setPageMessage(
          getGameErrorMessage(error, "Unable to load this game.")
        );
      }
    };

    void init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loaded, isAuthenticated, gameClient, gameId]);

  useEffect(() => {
    if (!loaded || !isAuthenticated || userId.trim() === "") return;

    (async () => {
      const currentLobby = await lobbyClient.getLobby(lobbyId);

      const currentPlayer = currentLobby.lobbyPlayers.find(
        (p) => p.user.id === userId
      );

      setMyTeamName(
        normalizeBackendTeamName(currentPlayer?.team ?? null)
      );
    })();
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

  if (!loaded || !isAuthenticated) return <div className="app-shell" />;

  const teamScores: TeamScoreViewModel[] = game && myTeamName
    ? buildTeamScores(myTeamName, game.score_1, game.score_2)
    : [];

  return (
    <div className="app-shell">
      {/* Animation CSS */}
      <style jsx global>{`
        @keyframes tile-claim-pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); filter: brightness(1.2); }
          100% { transform: scale(1); }
        }
        .is-claimed-friendly, .is-claimed-enemy {
          animation: tile-claim-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
      `}</style>

      <main className="phone-frame screen-gradient bingo-frame-layout">
        
        {/* BIGGER RULES TRIGGER - EXACTLY LIKE MENU */}
        {game && myTeamName && (
          <button 
            type="button" 
            className="menu-rules-trigger" 
            onClick={() => setShowRules(true)}
            aria-label="Show Rules"
            style={{ 
              position: 'absolute', 
              top: '20px', 
              right: '20px', 
              zIndex: 100,
              width: '42px',
              height: '42px',
              fontSize: '1.2rem',
              display: 'grid',
              placeItems: 'center'
            }}
          >
            i
          </button>
        )}

        {(!game || !myTeamName) && (
          <section className="lobby-card lobby-loading-card">
            <h2 className="lobby-section-title">
              {connectionState === "error" ? "Game unavailable" : "Connecting..."}
            </h2>
            <button type="button" className="vq-button" onClick={() => router.replace(`/lobbies/${lobbyId}`)}>
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
                <div key={score.label} className={`bingo-team-points-card ${getPerspectiveCardClass(score.perspective)}`}>
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
                <div className="bingo-time-bar-fill" style={{ width: progressWidth, transition: "width 1s linear" }} />
              </div>
            </div>

            <section className="bingo-panel">
              <div className="bingo-card">
                {game.tileGrid.map((row, rowIndex) => (
                  <div key={`row-${rowIndex}`} className="bingo-row-frame">
                    {row.map((tile, colIndex) => {
                      const isClaimed = isClaimedStatus(tile.status);
                      const isProcessing = isProcessingStatus(tile.status);
                      const stateClass = getTileStateClass(tile.status, myTeamName);
                      const loaderClass = getTileLoaderClass(tile.status, myTeamName);

                      return (
                        <button
                          key={`${rowIndex}-${colIndex}`}
                          type="button"
                          className={`bingo-field-button ${stateClass} ${isProcessing ? "is-analyzing" : ""}`}
                          disabled={isClaimed || isProcessing}
                          onClick={() => {
                            router.push(`/lobbies/${lobbyId}/games/${gameId}/submission?tileWord=${encodeURIComponent(tile.word)}`);
                          }}
                        >
                          {isProcessing ? (
                            <div className={`loader ${loaderClass}`}></div>
                          ) : isClaimed ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="claimed-icon-svg">
                              <path d="M20 6L9 17l-5-5" />
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

            {submissionNotice && <p className="bingo-submission-note">{submissionNotice}</p>}
          </>
        )}
      </main>

       {/* RULES OVERLAY */}
      {showRules && (
        <div className="overlay-backdrop" onClick={() => setShowRules(false)}>
          <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
            <div className="rules-content">
              <h2 className="overlay-title">Game Rules</h2>
              
              <div className="rules-section">
                <ul className="rules-bullet-list">
                  <li><strong>Find:</strong> Locate an item listed on the bingo board in the real world.</li>
                  <li><strong>Capture:</strong> Tap the tile to open the camera and snap a photo of that item.</li>
                  <li><strong>Submission:</strong> Once submitted, our AI will validate the image to ensure it matches the item on the tile.</li>
                  <li><strong>Win:</strong> Earn points for every captured tile, plus bonus points for completing rows, columns, or diagonals.</li>
                </ul>
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
                    <button type="button" className="bingo-field-button is-processing-friendly is-analyzing" disabled>
                      <div className="loader is-friendly"></div>
                    </button>
                    <span>In Validation</span>
                  </div>

                  <div className="rules-tile-item">
                    <button type="button" className="bingo-field-button is-claimed is-claimed-friendly" disabled>
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="claimed-icon-svg">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </button>
                    <span>Claimed Team 1</span>
                  </div>

                  <div className="rules-tile-item">
                    <button type="button" className="bingo-field-button is-claimed is-claimed-enemy" disabled>
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="claimed-icon-svg">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </button>
                    <span>Claimed Team 2</span>
                  </div>
                </div>
              </div>

              <div className="overlay-actions overlay-actions-single">
                <button type="button" className="btn-rules-confirm" onClick={() => setShowRules(false)}>
                  Got it!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Helpers ---
function getTileStateClass(status: GameTileStatus, myTeamName: BackendTeamName): string {
  if (status === "UNCLAIMED") return "";
  if (isClaimedStatus(status)) return getTilePerspective(status, myTeamName) === "own" ? "is-claimed is-claimed-friendly" : "is-claimed is-claimed-enemy";
  if (isProcessingStatus(status)) return getTilePerspective(status, myTeamName) === "own" ? "is-processing-friendly is-analyzing" : "is-processing-enemy is-analyzing";
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
  return fallback;
}
