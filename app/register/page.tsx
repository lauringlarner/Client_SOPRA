"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";

export default function RegisterPage() {
  const router = useRouter();
  const { loaded, isAuthenticated, loginAsMock } = useAuthSession();

  const handleRegister = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    loginAsMock();
    router.push("/menu");
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

        <form
          className="auth-form-card auth-form-card-register"
          onSubmit={handleRegister}
        >
          <label className="field-group">
            <span className="field-label">Username</span>
            <input
              className="field-input"
              placeholder="Enter username"
              required
            />
          </label>

          <label className="field-group">
            <span className="field-label">Password</span>
            <input
              className="field-input"
              type="password"
              placeholder="Enter password"
              required
            />
          </label>

          <label className="field-group">
            <span className="field-label">Bio</span>
            <textarea
              className="field-input field-input-textarea"
              placeholder="Short bio"
              required
            />
          </label>

          <button type="submit" className="vq-button auth-submit">
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
