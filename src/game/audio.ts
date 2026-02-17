let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'square', volume = 0.1, detune = 0): void {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available
  }
}

function playNoise(duration: number, volume = 0.05): void {
  try {
    const ctx = getCtx();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  } catch {
    // Audio not available
  }
}

export function playFootstep(): void {
  playNoise(0.08, 0.03);
}

export function playJump(): void {
  playTone(300, 0.15, 'sine', 0.08);
  setTimeout(() => playTone(500, 0.1, 'sine', 0.06), 50);
}

export function playLand(): void {
  playNoise(0.12, 0.06);
}

export function playCoinCollect(): void {
  playTone(800, 0.1, 'sine', 0.08);
  setTimeout(() => playTone(1200, 0.15, 'sine', 0.08), 80);
  setTimeout(() => playTone(1600, 0.2, 'sine', 0.06), 160);
}

export function playRobberyAlarm(): void {
  playTone(600, 0.3, 'square', 0.06);
  setTimeout(() => playTone(800, 0.3, 'square', 0.06), 300);
}

export function playSiren(): void {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.5);
    osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 1.0);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.0);
  } catch {
    // Audio not available
  }
}

let engineOsc: OscillatorNode | null = null;
let engineGain: GainNode | null = null;

export function startEngineSound(): void {
  try {
    if (engineOsc) return;
    const ctx = getCtx();
    engineOsc = ctx.createOscillator();
    engineGain = ctx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    engineGain.gain.value = 0.02;
    engineOsc.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
  } catch {
    // Audio not available
  }
}

export function updateEngineSound(speed: number): void {
  if (engineOsc && engineGain) {
    engineOsc.frequency.value = 60 + Math.abs(speed) * 3;
    engineGain.gain.value = 0.01 + Math.abs(speed) * 0.001;
  }
}

export function stopEngineSound(): void {
  try {
    if (engineOsc) {
      engineOsc.stop();
      engineOsc.disconnect();
      engineOsc = null;
    }
    if (engineGain) {
      engineGain.disconnect();
      engineGain = null;
    }
  } catch {
    // Audio not available
  }
}

export function playDoorOpen(): void {
  playTone(200, 0.2, 'triangle', 0.05);
  setTimeout(() => playTone(250, 0.15, 'triangle', 0.04), 100);
}

export function playHit(): void {
  playNoise(0.15, 0.08);
  playTone(150, 0.2, 'square', 0.05);
}

export function playGunshot(): void {
  playNoise(0.1, 0.15);
  playTone(120, 0.08, 'sawtooth', 0.12);
  setTimeout(() => playNoise(0.15, 0.06), 50);
}

export function playStab(): void {
  playTone(100, 0.05, 'sawtooth', 0.15);
  setTimeout(() => playNoise(0.08, 0.12), 30);
  setTimeout(() => playTone(80, 0.1, 'square', 0.08), 60);
}

export function playTeleport(): void {
  playTone(1200, 0.08, 'sine', 0.06);
  setTimeout(() => playTone(800, 0.1, 'sine', 0.08), 40);
  setTimeout(() => playTone(400, 0.15, 'sine', 0.06), 80);
}

export function playNpcDeath(): void {
  playTone(400, 0.15, 'sine', 0.08);
  setTimeout(() => playTone(300, 0.15, 'sine', 0.06), 100);
  setTimeout(() => playTone(200, 0.3, 'sine', 0.05), 200);
}

export function initAudio(): void {
  // Create context on first user interaction
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
}
