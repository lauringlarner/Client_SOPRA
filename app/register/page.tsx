"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ApiService } from "@/api/apiService";
import type { ApplicationError } from "@/types/error";
import { playUiBeep } from "@/utils/sounds";

const api = new ApiService();
const MIN_PASSWORD_LENGTH = 8;

function validateNewPassword(password: string): string | null {
  if (password.trim().length === 0) {
    return "Password cannot be empty.";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }
  if (!/\d/.test(password)) {
    return "Password must contain at least one digit.";
  }

  return null;
}

function getFriendlyRegisterError(error: unknown): string {
  const applicationError = error as Partial<ApplicationError> | undefined;
  const reason = applicationError?.reason?.toLowerCase() ?? "";

  if (applicationError?.status === 409) {
    return "This username is already taken.";
  }
  if (reason.includes("username") && reason.includes("empty")) {
    return "Username cannot be empty.";
  }
  if (reason.includes("password") && reason.includes("empty")) {
    return "Password cannot be empty.";
  }
  if (reason.includes("at least 8 characters")) {
    return "Password must be at least 8 characters long.";
  }
  if (reason.includes("at least one digit")) {
    return "Password must contain at least one digit.";
  }

  return "Something went wrong. Please try again.";
}

export default function RegisterPage() {
  const router = useRouter();
  const { loaded, isAuthenticated, setSession } = useAuthSession();
  
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");

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
      setPasswordError(
        value.length > 0 ? validateNewPassword(value) ?? "" : ""
      );
    }
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    playUiBeep();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const userData = Object.fromEntries(formData.entries());
    const inputUsername = userData.username as string;
    const password = userData.password as string;

    if (inputUsername.trim().length === 0) {
      setError("Username cannot be empty.");
      setIsSubmitting(false);
      return;
    }

    if (/^\d/.test(inputUsername)) {
      setError("Username cannot start with a number.");
      setIsSubmitting(false);
      return;
    }

    if (/\s/.test(inputUsername)) {
      setError("Username must not contain spaces.");
      setIsSubmitting(false);
      return;
    }

    const usernameInjectionRegex = /[;$"'\\/<>,. ]/;
    if (usernameInjectionRegex.test(inputUsername)) {
      setError("Special characters are not allowed in the username.");
      setIsSubmitting(false);
      return;
    }

    const passwordValidationError = validateNewPassword(password);
    if (passwordValidationError) {
      setPasswordError(passwordValidationError);
      setIsSubmitting(false);
      return;
    }

    try {
      await api.post("/users", userData);

      const loginData = await api.post<{ id: string; token: string, username: string}>(
        "/users/login",
        {
          username: inputUsername,
          password: userData.password,
        }
      );

      setSession(loginData.token, loginData.id, loginData.username);
      router.push("/menu");
    } catch (err: unknown) {
      setError(getFriendlyRegisterError(err));
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
        <h1 className="auth-title">Create Your Account</h1>

        <form className="auth-form-card" onSubmit={handleRegister} noValidate>
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
              onBeforeInput={handleUsernameBeforeInput}
              onKeyDown={handleUsernameKeyDown}
              onChange={(e) => validateField("username", e.target.value)}
              pattern="[a-zA-Z][a-zA-Z0-9]*"
              title="Username must start with a letter and contain only alphanumeric characters without spaces"
            />
            {usernameError && (
              <span style={{ fontSize: "0.85rem", color: "#e50909d6", marginTop: "0.25rem", display: "block", fontWeight: 700, textShadow: "0 0 3px rgba(255,255,255,0.9)" }}>
                {usernameError}
              </span>
            )}
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
                onChange={(e) => validateField("password", e.target.value)}
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
            {isSubmitting ? "Registering..." : "Register"}
          </button>
        </form>

        <button
          className="auth-link-button"
          type="button"
          onClick={() => router.push("/login")}
          disabled={isSubmitting}
        >
          Already have an account? Sign in here!
        </button>
      </main>
    </div>
  );
}