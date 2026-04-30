"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createGameClient } from "@/api/gameService";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ApiService } from "@/api/apiService";
import { setStoredActiveLobbyId } from "@/utils/lobbySession";
import { setLastSubmissionWord } from "@/utils/submissionFeedback";

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
  
  // Neuer State für den Countdown
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

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
              height: { ideal: 2160 }
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
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [capturedImage, isAuthenticated, loaded, lobbyId, router, userId]);

  // Automatische Handhabung nach dem Capture für den Countdown
  useEffect(() => {
    if (capturedImage) {
      setCountdown(5); // 5 Sekunden Countdown
      
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
            }
            // Sobald der Timer 0 erreicht, direkt absenden
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

  useEffect(() => {
    if (!loaded || !isAuthenticated || !gameId) {
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const redirectToLeaderboard = () => {
      router.replace(`/lobbies/${lobbyId}/games/${gameId}/leaderboard`);
    };

    const init = async () => {
      try {
        const game = await gameClient.getGame(gameId);
        if (game.status === "ENDED") {
          redirectToLeaderboard();
          return;
        }

        unsubscribe = gameClient.subscribeToGame(
          gameId,
          (details) => {
            if (details.status === "ENDED") {
              redirectToLeaderboard();
            }
          },
          () => {},
        );
      } catch {
        // Keep the current page state when the status lookup fails.
      }
    };

    void init();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [gameClient, gameId, isAuthenticated, loaded, lobbyId, router]);

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

      await api.post<void>(
        `/games/${gameId}/submission`,
        formData,
        token,
      );

      setLastSubmissionWord(tileWord);

      router.replace(`/lobbies/${lobbyId}/games/${gameId}`);
    } catch (error) {
      if (isGameEndedError(error)) {
        router.replace(`/lobbies/${lobbyId}/games/${gameId}/leaderboard`);
        return;
      }

      console.error("Submission error:", error);
      setSubmissionError(getSubmissionErrorMessage(error));
      setIsSubmitting(false);
    }
  };

  // Hilfsfunktion: Zurück zur Bingo-Seite und `router.back()` triggern
  const handleCancel = () => {
    // Verhindert das erneute Laden der vorherigen Seite, indem wir die Navigations-Historie nutzen
    router.back();
  };

  if (!loaded || !isAuthenticated) return <div className="app-shell" />;

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient camera-frame-layout">
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
              <img src={capturedImage} alt="Captured" className="camera-video-element" />

              {/* Countdown Overlay in der Bildmitte inklusive Text */}
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
                <button type="button" className="camera-button-cancel" onClick={handleCancel}>
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