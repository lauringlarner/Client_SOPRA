"use client";

import { useCallback } from "react";
import useLocalStorage from "@/hooks/useLocalStorage";

const TOKEN_KEY = "token";
const USER_ID_KEY = "userId";

interface AuthSession {
  token: string;
  userId: string;
  username: string;
  loaded: boolean;
  isAuthenticated: boolean;
  setSession: (token: string, userId: string, username: string) => void;
  logout: () => void;
}

export function useAuthSession(): AuthSession {
  const tokenStorage = useLocalStorage<string>(TOKEN_KEY, "");
  const userIdStorage = useLocalStorage<string>(USER_ID_KEY, "");
  // 1. Add the username storage
  const usernameStorage = useLocalStorage<string>("username", "");

  const loaded = tokenStorage.loaded && userIdStorage.loaded && usernameStorage.loaded;
  const isAuthenticated = tokenStorage.value.trim() !== "";
  
  const setSession = useCallback((token: string, userId: string, username: string): void => {
    tokenStorage.set(token);
    userIdStorage.set(userId);
    usernameStorage.set(username);
    
  }, [tokenStorage.set, userIdStorage.set, usernameStorage.set]);

  const logout = useCallback((): void => {
    tokenStorage.clear();
    userIdStorage.clear();
    usernameStorage.clear(); 
  }, [tokenStorage.clear, userIdStorage.clear, usernameStorage.clear]);

  return {
    token: tokenStorage.value,
    userId: userIdStorage.value,
    username: usernameStorage.value,
    loaded,
    isAuthenticated,
    setSession,
    logout,
  };
}
