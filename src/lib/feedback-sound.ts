/** Short synthesized tones for scan feedback, so it doesn't depend on bundling audio files. */
function playTone(frequencies: number[], durationMs: number) {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  const ctx = new AudioContextClass();
  const now = ctx.currentTime;
  const step = durationMs / 1000 / frequencies.length;

  frequencies.forEach((freq, i) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, now + i * step);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (i + 1) * step);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now + i * step);
    oscillator.stop(now + (i + 1) * step);
  });

  setTimeout(() => ctx.close(), durationMs + 100);
}

export function playSuccessSound() {
  playTone([880, 1318], 220);
}

export function playErrorSound() {
  playTone([220, 165], 300);
}
