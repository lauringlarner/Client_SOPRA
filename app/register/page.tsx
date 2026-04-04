"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ApiService } from "@/api/apiService";
import { Color } from "antd/es/color-picker";

const api = new ApiService();

export default function RegisterPage() {
  const router = useRouter();
  const { loaded, isAuthenticated, setSession } = useAuthSession();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const userData = Object.fromEntries(formData.entries());

    try {
      // 1. Create the user (POST /users)
      await api.post("/users", userData);

      // 2. Immediately login to get the token (POST /users/login)
      const loginData = await api.post<{ id: string; token: string }>(
        "/users/login",
        {
          username: userData.username,
          password: userData.password,
        }
      );

      // 3. Save session and redirect
      setSession(loginData.token, loginData.id);
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
        <h1 className="auth-title auth-title-register">Create Your Account</h1>

        <form className="auth-form-card auth-form-card-register" onSubmit={handleRegister}>
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
            />
          </label>

          <button 
            type="submit" 
            className="vq-button auth-submit" 
            disabled={isSubmitting} // This makes the button not clickable
            style={{ opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
          >
            Register
          </button>
        </form>

        <button
          className="auth-link-button"
          type="button"
          onClick={() => router.push("/login")}
        >
          Already have an account? Sign in here!
        </button>
      </main>
    </div>
  );
}