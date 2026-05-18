"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ApiService } from "@/api/apiService";
import { playUiBeep } from "@/utils/sounds";

const api = new ApiService();

export default function LoginPage() {
  const router = useRouter();
  const { loaded, isAuthenticated, setSession } = useAuthSession();
  
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Validation States for Dynamic Helper Text
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Block special characters and spaces only for username
  const handleUsernameBeforeInput = (event: React.FormEvent<HTMLInputElement>) => {
    const char = (event.nativeEvent as InputEvent).data;
    if (char) {
      if (/[^a-zA-Z0-9]|\s/.test(char)) {
        event.preventDefault();
        setUsernameError("Special characters are not allowed in the username.");
      }
    }
  };

  const handleUsernameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === " ") {
      event.preventDefault();
      setUsernameError("Special characters are not allowed in the username.");
    }
  };

  const validateField = (name: string, value: string) => {
    if (name === "username") {
      if (value.length > 0 && /^\d/.test(value)) {
        setUsernameError("Username must start with a letter, not a number.");
      } else if (value.length > 0 && /[^a-zA-Z0-9]/.test(value)) {
        setUsernameError("Special characters are not allowed in the username.");
      } else {
        setUsernameError("");
      }
    } else if (name === "password") {
      if (value.length > 0 && !/\d/.test(value)) {
        setPasswordError("Password must contain at least one digit.");
      } else if (value.length > 0 && value.length < 8) {
        setPasswordError("Password must be at least 8 characters.");
      } else {
        setPasswordError("");
      }
    }
  };

  const handleTogglePassword = (event: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    // Verhindert, dass das Input-Feld bei Klick auf den Button den Fokus verliert 
    // und das mobile Autofill-System irritiert wird.
    event.preventDefault();
    setShowPassword((prev) => !prev);
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

    // Validation checks
    if (/^\d/.test(username)) {
      setError("Username cannot start with a number.");
      setIsSubmitting(false);
      return;
    }

    if (/\s/.test(username)) {
      setError("Username must not contain spaces.");
      setIsSubmitting(false);
      return;
    }

    // Username injection regex (Consistent with Register)
    const usernameInjectionRegex = /[;$"'\\/<>,. ]/;
    if (usernameInjectionRegex.test(username)) {
      setError("Special characters are not allowed in the username.");
      setIsSubmitting(false);
      return;
    }

    if (!/\d/.test(password)) {
      setError("Password must contain at least one digit.");
      setIsSubmitting(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
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
        <div className="bingo-rain-container">
          {[...Array(12)].map((_, i) => (
            <span key={i} className="rain-item">VisionQuest</span>
          ))}
        </div>
        <h1 className="auth-title">Login &amp; Play</h1>

        <form className="auth-form-card" onSubmit={handleLogin}>
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
              autoComplete="username"
              onBeforeInput={handleUsernameBeforeInput}
              onKeyDown={handleUsernameKeyDown}
              onChange={(e) => validateField("username", e.target.value)}
              pattern="[a-zA-Z][a-zA-Z0-9]*"
              title="Username must start with a letter and contain only alphanumeric characters without spaces"
            />
            {usernameError && (
              <span style={{ fontSize: "0.85rem", color: "#f40303cd", marginTop: "0.25rem", display: "block", fontWeight: 700, textShadow: "0 0 3px rgba(255,255,255,0.9)" }}>
                {usernameError}
              </span>
            )}
          </label>

          <label className="field-group">
            <span className="field-label">Password</span>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
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
                onChange={(e) => validateField("password", e.target.value)}
                style={{ paddingRight: "3.5rem" }}
              />
              <button
                type="button"
                onMouseDown={handleTogglePassword}
                onTouchStart={handleTogglePassword}
                disabled={isSubmitting}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  background: "transparent",
                  border: "none",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  color: "#ffffff",
                  padding: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 10,
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
              <span style={{ fontSize: "0.85rem", color: "#e50909d6", marginTop: "0.25rem", display: "block", fontWeight: 700, textShadow: "0 0 3px rgba(255,255,255,0.9)" }}>
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