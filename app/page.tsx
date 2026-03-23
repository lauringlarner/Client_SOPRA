"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";

export default function Home() {
  const router = useRouter();
  const { loaded, isAuthenticated } = useAuthSession();

  useEffect(() => {
    if (!loaded) return;
    if (isAuthenticated) {
      router.replace("/menu");
    }
  }, [isAuthenticated, loaded, router]);

  return (
    <div className="app-shell">
      <main className="phone-frame screen-home home-layout">
        <section className="home-hero" aria-label="VisionQuest hero">
          <div className="home-hero-badge">VisionQuest</div>
        </section>

        <section className="home-action-row">
          <button
            className="vq-button home-action-btn"
            onClick={() => router.push("/login")}
          >
            Sign In
          </button>
          <button
            className="vq-button home-action-btn"
            onClick={() => router.push("/register")}
          >
            Create Account
          </button>
        </section>
      </main>
    </div>
  );
}
