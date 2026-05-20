export function getSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem("soundEnabled") !== "false";
}

export function setSoundEnabled(val: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("soundEnabled", val ? "true" : "false");
}

let uiClickAudio: HTMLAudioElement | null = null;
let cameraClickAudio: HTMLAudioElement | null = null;
//UI beep sound
export function playUiBeep() {
  if (typeof window === "undefined" || !getSoundEnabled()) return;
  if (!uiClickAudio) uiClickAudio = new Audio("/sounds/ui_click_beep.wav");
  uiClickAudio.currentTime = 0;
  uiClickAudio.play().catch(() => {});
}
//Camera shutter sound
export function playCameraClick() {
  if (typeof window === "undefined" || !getSoundEnabled()) return;
  if (!cameraClickAudio) cameraClickAudio = new Audio("/sounds/camera-click.mp3");
  cameraClickAudio.currentTime = 0;
  cameraClickAudio.play().catch(() => {});
}

let successAudio: HTMLAudioElement | null = null;
let errorAudio: HTMLAudioElement | null = null;
let countdownAudio: HTMLAudioElement | null = null;

//success
export function successClick() {
  if (typeof window === "undefined" || !getSoundEnabled()) return;
  if (!successAudio) successAudio = new Audio("/sounds/correct.mp3");
  successAudio.currentTime = 0;
  successAudio.play().catch(() => {});
}
//countdown warning
export function playCountdown() {
  if (typeof window === "undefined" || !getSoundEnabled()) return;
  if (!countdownAudio) countdownAudio = new Audio("/sounds/countdown-10s.mp3");
  countdownAudio.currentTime = 0;
  countdownAudio.play().catch(() => {});
}
//error
export function errorClick() {
  if (typeof window === "undefined" || !getSoundEnabled()) return;
  if (!errorAudio) errorAudio = new Audio("/sounds/failed.mp3");
  errorAudio.currentTime = 0;
  errorAudio.play().catch(() => {});
}

let backgroundAudio: HTMLAudioElement | null = null;

export function playBackground() {
  if (typeof window === "undefined" || !getSoundEnabled()) return;
  if (!backgroundAudio) {
    backgroundAudio = new Audio("/sounds/backgroundsound.mp3");
    backgroundAudio.loop = true;
  }
  backgroundAudio.play().catch(() => {});
}