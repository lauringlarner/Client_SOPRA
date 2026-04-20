const LAST_SUBMISSION_WORD_KEY = "lastSubmissionWord";

export function getLastSubmissionWord(): string | null {
  if (typeof globalThis === "undefined" || !("sessionStorage" in globalThis)) {
    return null;
  }

  return globalThis.sessionStorage.getItem(LAST_SUBMISSION_WORD_KEY);
}

export function setLastSubmissionWord(word: string): void {
  if (typeof globalThis === "undefined" || !("sessionStorage" in globalThis)) {
    return;
  }

  globalThis.sessionStorage.setItem(LAST_SUBMISSION_WORD_KEY, word);
}

export function clearLastSubmissionWord(): void {
  if (typeof globalThis === "undefined" || !("sessionStorage" in globalThis)) {
    return;
  }

  globalThis.sessionStorage.removeItem(LAST_SUBMISSION_WORD_KEY);
}
