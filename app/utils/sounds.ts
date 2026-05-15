let uiClickAudio: HTMLAudioElement | null = null;
let cameraClickAudio: HTMLAudioElement | null = null;
//UI beep sound
export function playUiBeep() {
  if (typeof window === "undefined") return;
  if (!uiClickAudio) uiClickAudio = new Audio("/sounds/ui_click_beep.wav");
  uiClickAudio.currentTime = 0;
  uiClickAudio.play().catch(() => {});
}
//Camera shutter sound
export function playCameraClick() {
  if (typeof window === "undefined") return;
  if (!cameraClickAudio) cameraClickAudio = new Audio("/sounds/camera-click.mp3");
  cameraClickAudio.currentTime = 0;
  cameraClickAudio.play().catch(() => {});
}

let successAudio: HTMLAudioElement | null = null;
let errorAudio: HTMLAudioElement | null = null;
let countdownAudio: HTMLAudioElement | null = null;

//success
export function successClick() {
  if (typeof window === "undefined") return;
  if (!successAudio) successAudio = new Audio("/sounds/correct.mp3");
  successAudio.currentTime = 0;
  successAudio.play().catch(() => {});
}
//countdown warning
export function playCountdown() {
  if (typeof window === "undefined") return;
  if (!countdownAudio) countdownAudio = new Audio("/sounds/countdown-10s.mp3");
  countdownAudio.currentTime = 0;
  countdownAudio.play().catch(() => {});
}
//error
export function errorClick() {
  if (typeof window === "undefined") return;
  if (!errorAudio) errorAudio = new Audio("/sounds/failed.mp3");
  errorAudio.currentTime = 0;
  errorAudio.play().catch(() => {});
}