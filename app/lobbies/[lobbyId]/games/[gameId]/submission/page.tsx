"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ApiService } from "@/api/apiService"; 

const api = new ApiService();

function CameraContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loaded, isAuthenticated } = useAuthSession();
  
  const tileWord = searchParams.get("tileWord");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }

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
  }, [isAuthenticated, loaded, router, capturedImage]);

  const handleCapture = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 1.0);
      setCapturedImage(dataUrl);
    }
  };

  const handleSubmit = async () => {
    if (!capturedImage || !tileWord) {
      alert("Missing image or target word.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const gameId = localStorage.getItem("gameId");
      const teamName = localStorage.getItem("teamName") || "UnknownTeam";

      if (!gameId) throw new Error("Game ID missing from storage");

      // Bild für den Upload vorbereiten
      const fetchRes = await fetch(capturedImage);
      const blob = await fetchRes.blob();

      const formData = new FormData();
      formData.append("image", blob, "submission.jpg");
      formData.append("object", tileWord); 
      formData.append("team", teamName);

      
      localStorage.setItem("pendingCheck", tileWord);

      // Request wird im Hintergrund ausgeführt
      api.post<{ result: number }>(
        `/games/${gameId}/submission`,
        formData
      ).then((response) => {
        console.log("Background analysis complete:", response);
        // Sobald der Server antwortet, entfernen wir die Markierung
        localStorage.removeItem("pendingCheck");
      }).catch((error) => {
        console.error("Background analysis failed:", error);
        localStorage.removeItem("pendingCheck");
      });


      router.back();

    } catch (error) {
      console.error("Submission error:", error);
      alert("Could not process image.");
      setIsSubmitting(false);
      router.back();
    }
  };

  if (!loaded || !isAuthenticated) return <div className="app-shell" />;

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient camera-frame-layout">
        <section className="camera-container">
          
          {tileWord && (
            <div className="camera-target-badge">
              Target: <strong>{tileWord}</strong>
            </div>
          )}

          {capturedImage ? (
            <>
              <img src={capturedImage} alt="Captured" className="camera-video-element" />
              <div className="camera-actions-frame">
                <button 
                  type="button" 
                  className="camera-button-capture" 
                  onClick={handleSubmit}
                  disabled={isSubmitting}
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
              />
              <div className="camera-actions-frame">
                <button type="button" className="camera-button-capture" onClick={handleCapture}>
                  Capture
                </button>
                <button type="button" className="camera-button-cancel" onClick={() => router.back()}>
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
