"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";

const HOME_HERO_IMAGE = "/images/home-hero.png";

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
          <img
            className="home-hero-image"
            src={HOME_HERO_IMAGE}
            alt="VisionQuest title artwork"
          />
        </section>

        <section className="home-action-row">
          <button
            type="button"
            className="vq-button home-action-btn"
            onClick={() => router.push("/login")}
          >
            Sign In
          </button>
          <button
            type="button"
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
