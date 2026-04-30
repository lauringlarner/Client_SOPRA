"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createGameClient } from "@/api/gameService";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ApiService } from "@/api/apiService";
import { setStoredActiveLobbyId } from "@/utils/lobbySession";
import { setLastSubmissionWord } from "@/utils/submissionFeedback";
// Falls Sie ein separates CSS-Modul oder eine globale CSS-Datei nutzen möchten:
// import "./cameraPage.css"; 

const api = new ApiService();

function CameraContent() {
  const router = useRouter();
  const params = useParams<{ lobbyId: string; gameId: string }>();
  const searchParams = useSearchParams();
  const { loaded, isAuthenticated, token, userId } = useAuthSession();
  const lobbyId = params?.lobbyId as string;
  const gameId = params?.gameId as string;
  const tileWord = searchParams.get("tileWord");
  const gameClient = useMemo(() => createGameClient({ api, token }), [token]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  // Eigener State für das Overlay
  const [claimedOverlayMessage, setClaimedOverlayMessage] = useState<string | null>(null);
  
  // Flag, um doppelte Aufrufe zu unterbinden
  const isRedirecting = useRef(false);

  // Countdown State
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Automatischer Redirect-Timer für das Overlay
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Automatische Umleitung ohne Button
  useEffect(() => {
    if (claimedOverlayMessage) {
      redirectTimerRef.current = setTimeout(() => {
        if (!isRedirecting.current) {
          isRedirecting.current = true;
          router.replace(`/lobbies/${lobbyId}/games/${gameId}`);
        }
      }, 2000);
    }
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, [claimedOverlayMessage, lobbyId, gameId, router]);

  useEffect(() => {
    if (!loaded) return;
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }

    setStoredActiveLobbyId(userId, lobbyId);

    if (!capturedImage) {
      (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "environment",
              width: { ideal: 4096 },
              height: { ideal: 2160 },
            },
            audio: false,
          });

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            streamRef.current = stream;
          }
        } catch (err) {
          console.error("Camera access error:", err);
        }
      })();
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [capturedImage, isAuthenticated, loaded, lobbyId, router, userId]);

  // Automatische Handhabung nach dem Capture für den Countdown
  useEffect(() => {
    if (capturedImage) {
      setCountdown(5);

      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
            }
            void handleSubmit();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      setCountdown(null);
    }

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [capturedImage]);

  // Überprüfung, ob das Zielwort bereits geclaimed wurde
  useEffect(() => {
    if (!loaded || !isAuthenticated || !gameId) {
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const redirectToLeaderboard = () => {
      router.replace(`/lobbies/${lobbyId}/games/${gameId}/leaderboard`);
    };

    const checkAndRedirect = async () => {
      try {
        const game = await gameClient.getGame(gameId);
        if (game.status === "ENDED") {
          redirectToLeaderboard();
          return;
        }

        const rawGame = game as any;
        let isClaimed = false;

        const possibleProperties = ["submittedTiles", "usedTiles", "tiles", "completedTiles"];
        for (const prop of possibleProperties) {
          if (Array.isArray(rawGame[prop])) {
            if (tileWord && rawGame[prop].includes(tileWord)) {
              isClaimed = true;
              break;
            }
          }
        }

        if (!isClaimed && Array.isArray(rawGame.board)) {
          for (const row of rawGame.board) {
            if (Array.isArray(row)) {
              const found = row.find((t: any) => t.word === tileWord && t.status === "CLAIMED");
              if (found) {
                isClaimed = true;
                break;
              }
            }
          }
        }

        if (tileWord && isClaimed) {
          setClaimedOverlayMessage(`The tile "${tileWord}" has already been claimed by another team.`);
          return;
        }
      } catch {
        // Bei Netzwerkfehlern den Status beibehalten.
      }
    };

    void checkAndRedirect();

    unsubscribe = gameClient.subscribeToGame(
      gameId,
      (details) => {
        if (details.status === "ENDED") {
          redirectToLeaderboard();
          return;
        }

        const rawDetails = details as any;
        let isClaimedLive = false;

        const possibleProperties = ["submittedTiles", "usedTiles", "tiles", "completedTiles"];
        for (const prop of possibleProperties) {
          if (Array.isArray(rawDetails[prop])) {
            if (tileWord && rawDetails[prop].includes(tileWord)) {
              isClaimedLive = true;
              break;
            }
          }
        }

        if (!isClaimedLive && Array.isArray(rawDetails.board)) {
          for (const row of rawDetails.board) {
            if (Array.isArray(row)) {
              const found = row.find((t: any) => t.word === tileWord && t.status === "CLAIMED");
              if (found) {
                isClaimedLive = true;
                break;
              }
            }
          }
        }

        if (tileWord && isClaimedLive) {
          setClaimedOverlayMessage(`The tile "${tileWord}" has already been claimed by another team.`);
        }
      },
      () => {},
    );

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [gameClient, gameId, isAuthenticated, loaded, lobbyId, router, tileWord]);

  const handleCapture = () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoElement, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 1.0);
      setCapturedImage(dataUrl);
    }
  };

  const handleSubmit = async () => {
    if (claimedOverlayMessage || isRedirecting.current) return;

    if (!capturedImage || !tileWord) {
      setSubmissionError("The target word or captured image is missing.");
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    if (!gameId) {
      setSubmissionError("The game route is missing its game id.");
      setIsSubmitting(false);
      return;
    }

    try {
      const fetchRes = await fetch(capturedImage);
      const blob = await fetchRes.blob();

      const formData = new FormData();
      formData.append("image", blob, "submission.jpg");
      formData.append("object", tileWord);

      await api.post<void>(`/games/${gameId}/submission`, formData, token);

      setLastSubmissionWord(tileWord);
      router.replace(`/lobbies/${lobbyId}/games/${gameId}`);
    } catch (error) {
      if (isGameEndedError(error)) {
        router.replace(`/lobbies/${lobbyId}/games/${gameId}/leaderboard`);
        return;
      }

      const errorMsg = getSubmissionErrorMessage(error);

      if (errorMsg.toLowerCase().includes("already taken")) {
        setClaimedOverlayMessage(`The tile "${tileWord}" is already claimed by a team!`);
        setIsSubmitting(false);
        return;
      }

      console.error("Submission error:", error);
      setSubmissionError(errorMsg);
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (!loaded || !isAuthenticated) return <div className="app-shell" />;

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient camera-frame-layout">
        
        {/* Overlay, das angezeigt wird, wenn das Tile bereits belegt ist */}
        {claimedOverlayMessage && (
          <div className="custom-overlay-backdrop">
            <div className="custom-overlay-card">
              <h2 className="custom-overlay-title">Tile already claimed</h2>
              <p className="custom-overlay-text">{claimedOverlayMessage}</p>
              <p className="custom-overlay-subtext">Redirecting to game screen...</p>
            </div>
          </div>
        )}

        <section className="camera-container">
          {tileWord && (
            <div className="camera-target-badge">
              <strong>Target: {tileWord}</strong>
            </div>
          )}

          {submissionError && (
            <section className="lobby-card lobby-feedback-card is-error camera-feedback-card">
              <p className="lobby-feedback-text">{submissionError}</p>
            </section>
          )}

          {capturedImage ? (
            <>
              <img
                src={capturedImage}
                alt="Captured"
                className="camera-video-element"
              />

              <div className="countdown-overlay">
                <span className="countdown-text">Sending in</span>
                <span className="countdown-number">{countdown}</span>
              </div>

              <div className="camera-actions-frame">
                <button
                  type="button"
                  className="camera-button-capture"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !capturedImage}
                >
                  {isSubmitting ? "Uploading..." : "Submit"}
                </button>
                <button
                  type="button"
                  className="camera-button-cancel"
                  onClick={() => setCapturedImage(null)}
                  disabled={isSubmitting}
                >
                  Discard
                </button>
              </div>
            </>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="camera-video-element"
                onLoadedMetadata={() => setIsCameraReady(true)}
              />
              <div className="camera-actions-frame">
                <button
                  type="button"
                  className="camera-button-capture"
                  onClick={handleCapture}
                  disabled={!isCameraReady}
                >
                  Capture
                </button>
                <button
                  type="button"
                  className="camera-button-cancel"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default function CameraPage() {
  return (
    <Suspense fallback={<div className="app-shell" />}>
      <CameraContent />
    </Suspense>
  );
}

function getSubmissionErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim() !== ""
  ) {
    return error.message;
  }

  return "The submission could not be sent. Please try again.";
}

function isGameEndedError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status === 409
  );
}