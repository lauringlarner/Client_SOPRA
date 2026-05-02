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

  // Block specific restricted special characters for the password field
  const handlePasswordBeforeInput = (event: React.FormEvent<HTMLInputElement>) => {
    const char = (event.nativeEvent as InputEvent).data;
    if (char) {
      if (/[<>\/\\;.,:""&|()\[\]{}]/.test(char)) {
        event.preventDefault();
        setPasswordError(`Special character "${char}" is not allowed in password.`);
      }
    }
  };

  const handlePasswordKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === " ") {
      event.preventDefault();
      setPasswordError("Spaces are not allowed in the password.");
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
      if (/\s/.test(value)) {
        setPasswordError("Spaces are not allowed in the password.");
      } else if (value.length > 0 && /[<>\/\\;.,:""&|()\[\]{}]/.test(value)) {
        setPasswordError("Contains forbidden special characters.");
      } else if (value.length > 0 && !/\d/.test(value)) {
        setPasswordError("Password must contain at least one digit!");
      } else if (value.length > 0 && value.length < 12) {
        setPasswordError("Password must be at least 12 characters.");
      } else {
        setPasswordError("");
      }
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

    // Additional validations
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

    // Username injection regex
    const usernameInjectionRegex = /[;$"'\\/<>,. ]/;
    if (usernameInjectionRegex.test(inputUsername)) {
      setError("Special characters are not allowed in the username.");
      setIsSubmitting(false);
      return;
    }

    // Password validation check
    const passwordInjectionRegex = /[<>\/\\;.,:""&|()\[\]{}`']/;
    if (passwordInjectionRegex.test(password)) {
      setError("Invalid characters in password: < > / \\ ; . , : \" \" & | ( ) [ ] { }");
      setIsSubmitting(false);
      return;
    }

    // Digit validation check
    if (!/\d/.test(password)) {
      setError("Password must contain at least one digit!");
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
              onBeforeInput={handleUsernameBeforeInput}
              onKeyDown={handleUsernameKeyDown}
              onChange={(e) => validateField("username", e.target.value)}
              pattern="[a-zA-Z][a-zA-Z0-9]*"
              title="Username must start with a letter and contain only alphanumeric characters without spaces"
            />
            {usernameError && (
              <span style={{ fontSize: "0.75rem", color: "#cc0000", marginTop: "0.25rem", display: "block" }}>
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
                minLength={12}
                maxLength={30}
                onBeforeInput={handlePasswordBeforeInput}
                onKeyDown={handlePasswordKeyDown}
                onChange={(e) => validateField("password", e.target.value)}
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
            {passwordError && (
              <span style={{ fontSize: "0.75rem", color: "#cc0000", marginTop: "0.25rem", display: "block" }}>
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