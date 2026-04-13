"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ApiService } from "@/api/apiService";

const api = new ApiService();

export default function LoginPage() {
  const router = useRouter();
  const { loaded, isAuthenticated, setSession } = useAuthSession();
  
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const credentials = Object.fromEntries(formData.entries());

    try {
      // POST /users/login
      const loginData = await api.post<{ id: string; token: string, username: string}>(
        "/users/login",
        credentials
      );

      // 2. Save real session data to localStorage via the hook
      setSession(loginData.token, loginData.id, loginData.username);
      
      router.push("/menu");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!loaded) return;
    if (isAuthenticated) {
      router.replace("/menu");
    }
  }, [isAuthenticated, loaded, router]);

  if (!loaded) {
    return <div className="app-shell" />;
  }

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient auth-layout">
        <h1 className="auth-title">Login &amp; Play</h1>

        <form className="auth-form-card" onSubmit={handleLogin}>
          {error && <div className="error-template">{error}</div>}

          <label className="field-group">
            <span className="field-label">Username</span>
            <input
              name="username"
              className="field-input"
              placeholder="Enter username"
              required
              disabled={isSubmitting}
            />
          </label>

          <label className="field-group">
            <span className="field-label">Password</span>
            <input
              name="password"
              className="field-input"
              type="password"
              placeholder="Enter password"
              required
              disabled={isSubmitting}
            />
          </label>

          <button 
            type="submit" 
            className="vq-button auth-submit" 
            disabled={isSubmitting}
            style={{ opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
          >
            {isSubmitting ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <button
          className="auth-link-button"
          type="button"
          onClick={() => router.push("/register")}
          disabled={isSubmitting}
        >
          Don&apos;t have an account? Sign up!
        </button>
      </main>
    </div>
  );
}
