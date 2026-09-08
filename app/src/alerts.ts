const REST_SOUND = "gym-rest-sound";
let audio: AudioContext | null = null;

export function soundEnabled(): boolean {
  return localStorage.getItem(REST_SOUND) !== "off";
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(REST_SOUND, enabled ? "on" : "off");
}

export function primeRestAudio(): void {
  if (!soundEnabled()) return;
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    /* Haptics remain available when WebAudio is unavailable. */
  }
}

export function alertRestDone(): void {
  try {
    navigator.vibrate?.([250, 120, 250]);
  } catch {
    /* ignore */
  }
  if (!soundEnabled()) return;
  try {
    audio ??= new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, audio.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.35);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.36);
  } catch {
    /* ignore */
  }
}
