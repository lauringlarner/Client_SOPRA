"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";

function CameraContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loaded, isAuthenticated } = useAuthSession();
  
  // Get the tile word from the URL
  const tileWord = searchParams.get("tileId");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }

    // Only attempt to start camera if we don't have a captured image
    if (!capturedImage) {
      (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: "environment",
              width: { ideal: 1920 },
              height: { ideal: 1080 }
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

    // Cleanup: Stop camera tracks when component unmounts or capturedImage changes
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
      // Compress to 70% quality to save bandwidth
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      setCapturedImage(dataUrl);
    }
  };


  const handleSubmit =  () => {
    // Add your backend fetch logic here ==> sending the image to backend here
    console.log("Submitting image for:", tileWord);
    router.back(); 
  };

  if (!loaded || !isAuthenticated) return <div className="app-shell" />;

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient camera-frame-layout">
        <section className="camera-container">
          
          {/* Target Word Badge */}
          {tileWord && (
            <div className="camera-target-badge">
              Target: {tileWord}
            </div>
          )}

          {capturedImage ? (
            /* PREVIEW MODE */
            <>
              <img src={capturedImage} alt="Captured" className="camera-video-element" />
              <div className="camera-actions-frame">
                <button type="button" className="camera-button-capture" onClick={handleSubmit}>
                  Submit
                </button>
                <button type="button" className="camera-button-cancel" onClick={() => setCapturedImage(null)}>
                  Discard
                </button>
              </div>
            </>
          ) : (
            /* LIVE CAMERA MODE */
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
