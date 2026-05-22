"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ApiService } from "@/api/apiService";
import type { ApplicationError } from "@/types/error";
import { playUiBeep } from "@/utils/sounds";

const api = new ApiService();

function validateRequiredPassword(password: string): string | null {
  return password.trim().length === 0 ? "Password cannot be empty." : null;
}

function getFriendlyLoginError(error: unknown): string {
  const applicationError = error as Partial<ApplicationError> | undefined;
  return applicationError?.status === 401
    ? "Invalid username or password."
    : "Something went wrong. Please try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const { loaded, isAuthenticated, setSession } = useAuthSession();
  
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [passwordError, setPasswordError] = useState("");

  const validateField = (name: string) => {
    if (name === "password") {
      setPasswordError("");
    }
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    playUiBeep();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const credentials = Object.fromEntries(formData.entries());
    
    const username = credentials.username as string;
    const password = credentials.password as string;

    if (username.trim().length === 0) {
      setError("Username cannot be empty.");
      setIsSubmitting(false);
      return;
    }

    const passwordValidationError = validateRequiredPassword(password);
    if (passwordValidationError) {
      setPasswordError(passwordValidationError);
      setIsSubmitting(false);
      return;
    }

    try {
      const loginData = await api.post<{ id: string; token: string, username: string}>(
        "/users/login",
        { username, password }
      );

      setSession(loginData.token, loginData.id, loginData.username);
      router.push("/menu");
    } catch (err: unknown) {
      setError(getFriendlyLoginError(err));
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
        <div className="bingo-rain-container">
          {[...Array(12)].map((_, i) => (
            <span key={i} className="rain-item">VisionQuest</span>
          ))}
        </div>
        <h1 className="auth-title">Login &amp; Play</h1>

        <form className="auth-form-card" onSubmit={handleLogin} noValidate>
          {error && (
            <div className="error-template">
              {error}
            </div>
          )}

          <label className="field-group">
            <span className="field-label">Username</span>
            <input
              name="username"
              className="field-input"
              placeholder="Enter username"
              required
              disabled={isSubmitting}
              maxLength={15}
            />
          </label>

          <label className="field-group">
            <span className="field-label">Password</span>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", width: "100%" }}>
              <input
                name="password"
                className="field-input"
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                required
                disabled={isSubmitting}
                minLength={8}
                maxLength={30}
                autoComplete="current-password"
                onChange={() => validateField("password")}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="eye-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  cursor: isSubmitting ? "not-allowed" : "pointer"
                }}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="3" y1="21" x2="21" y2="3"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
            {passwordError && (
              <span className="error-template">
                {passwordError}
              </span>
            )}
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