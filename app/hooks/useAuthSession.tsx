"use client";

import { useCallback } from "react";
import useLocalStorage from "@/hooks/useLocalStorage";

const TOKEN_KEY = "token";
const USER_ID_KEY = "userId";
const MOCK_TOKEN = "mock-token";

interface AuthSession {
  token: string;
  userId: string;
  loaded: boolean;
  isAuthenticated: boolean;
  loginAsMock: (userId?: string) => void;
  logout: () => void;
}

export function useAuthSession(): AuthSession {
  const tokenStorage = useLocalStorage<string>(TOKEN_KEY, "");
  const userIdStorage = useLocalStorage<string>(USER_ID_KEY, "");

  const loaded = tokenStorage.loaded && userIdStorage.loaded;
  const isAuthenticated = tokenStorage.value.trim() !== "";

  const loginAsMock = useCallback((userId = "1"): void => {
    tokenStorage.set(MOCK_TOKEN);
    userIdStorage.set(userId);
  }, [tokenStorage.set, userIdStorage.set]);

  const logout = useCallback((): void => {
    tokenStorage.clear();
    userIdStorage.clear();
  }, [tokenStorage.clear, userIdStorage.clear]);

  return {
    token: tokenStorage.value,
    userId: userIdStorage.value,
    loaded,
    isAuthenticated,
    loginAsMock,
    logout,
  };
}
