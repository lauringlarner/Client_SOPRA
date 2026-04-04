"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ApiService } from "@/api/apiService";

const api = new ApiService();

export default function LoginPage() {
  const router = useRouter();
  const { loaded, isAuthenticated, setSession } = useAuthSession();
  
  // State for error handling and submission status
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    // Capture the username and password from the form
    const formData = new FormData(event.currentTarget);
    const credentials = Object.fromEntries(formData.entries());

    try {
      // Calls your Spring Boot @PostMapping("/users/login")
      // Expects UserLoginResponseDTO { id, token }
      const loginData = await api.post<{ id: string; token: string }>(
        "/users/login",
        credentials
      );

      // Save real session data to localStorage via the hook
      setSession(loginData.token, loginData.id);
      router.push("/menu");
    } catch (err: unknown) {
      // General error handling using our new CSS class
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
          {/* Displaying error using the white-background/red-font template */}
          {error && <div className="error-template">{error}</div>}

          <label className="field-group">
            <span className="field-label">Username</span>
            <input
              name="username" // Added name attribute for API call
              className="field-input"
              placeholder="Enter username"
              required
            />
          </label>

          <label className="field-group">
            <span className="field-label">Password</span>
            <input
              name="password" // Added name attribute for API call
              className="field-input"
              type="password"
              placeholder="Enter password"
              required
            />
          </label>

          <button 
            type="submit" 
            className="vq-button auth-submit" 
            disabled={isSubmitting} // Locks the button while submitting
          >
            Sign In
          </button>
        </form>

        <button
          className="auth-link-button"
          type="button"
          onClick={() => router.push("/register")}
        >
          Don&apos;t have an account? Sign up!
        </button>
      </main>
    </div>
  );
}