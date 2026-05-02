"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ApiService } from "@/api/apiService";

const api = new ApiService();

export default function RegisterPage() {
  const router = useRouter();
  const { loaded, isAuthenticated, setSession } = useAuthSession();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Block invalid characters as the user tries to type
  const handleBeforeInput = (event: React.FormEvent<HTMLInputElement>) => {
    const char = (event.nativeEvent as InputEvent).data;
    if (char) {
      if (/\s|[;$"'\\/<>.,]/.test(char)) {
        event.preventDefault();
      }
    }
  };

  // Completely block the spacebar character
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === " ") {
      event.preventDefault();
    }
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const userData = Object.fromEntries(formData.entries());
    const inputUsername = userData.username as string;
    const password = userData.password as string;

    // Fallback checks
    if (/\s/.test(inputUsername) || /\s/.test(password)) {
      setError("Username and password must not contain spaces.");
      setIsSubmitting(false);
      return;
    }

    const injectionRegex = /[;$"'\\/<>,. ]/;
    if (injectionRegex.test(inputUsername) || injectionRegex.test(password)) {
      setError("Invalid characters not allowed: spaces, ;, $, \", ', \\, /, <, >, ,, .");
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
            <span key={i} className="rain-item">BINGO</span>
          ))}
        </div>
        <h1 className="auth-title">Create Your Account</h1>

        <form className="auth-form-card" onSubmit={handleRegister}>
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
              onBeforeInput={handleBeforeInput}
              onKeyDown={handleKeyDown}
              pattern="[a-zA-Z0-9]+"
              title="Username cannot contain spaces or special characters"
            />
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
                minLength={12}
                maxLength={30}
                onBeforeInput={handleBeforeInput}
                onKeyDown={handleKeyDown}
                pattern="^\S+$"
                title="Password cannot contain spaces"
                style={{ paddingRight: "3.5rem" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  background: "transparent",
                  border: "none",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  color: "#000000",
                  padding: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {showPassword ? (
                  // Closed Eye (Sleek Contour / ID: closed-eye-contour)
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    style={{ color: "#000000" }}
                  >
                    <path d="M2 12s3.75 6 10 6 10-6 10-6" />
                  </svg>
                ) : (
                  // Open Eye
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    style={{ color: "#000000" }}
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
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