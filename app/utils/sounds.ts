let uiClickAudio: HTMLAudioElement | null = null;
let cameraClickAudio: HTMLAudioElement | null = null;

export function playUiBeep() {
  if (typeof window === "undefined") return;
  if (!uiClickAudio) uiClickAudio = new Audio("/sounds/ui_click_beep.wav");
  uiClickAudio.currentTime = 0;
  uiClickAudio.play().catch(() => {});
}

export function playCameraClick() {
  if (typeof window === "undefined") return;
  if (!cameraClickAudio) cameraClickAudio = new Audio("/sounds/camera-click.mp3");
  cameraClickAudio.currentTime = 0;
  cameraClickAudio.play().catch(() => {});
}
