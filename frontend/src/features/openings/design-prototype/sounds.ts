// PROTOTYPE — sons de bois synthétisés (Web Audio), pour juger l'effet sans fichier audio.
import { useSyncExternalStore } from 'react';

export type WoodSound = 'clack' | 'capture' | 'tock' | 'plunger' | 'paper';

let context: AudioContext | null = null;
let muted = false;
const listeners = new Set<() => void>();

function audio(): AudioContext {
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
  return context;
}

function noise(ctx: AudioContext, seconds: number): AudioBufferSourceNode {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
}

function burst(ctx: AudioContext, at: number, { freq, q, gain, decay }: { freq: number; q: number; gain: number; decay: number }) {
  const source = noise(ctx, decay + 0.02);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(gain, at);
  envelope.gain.exponentialRampToValueAtTime(0.001, at + decay);
  source.connect(filter).connect(envelope).connect(ctx.destination);
  source.start(at);
}

function thump(ctx: AudioContext, at: number, { from, to, gain, decay }: { from: number; to: number; gain: number; decay: number }) {
  const oscillator = ctx.createOscillator();
  oscillator.frequency.setValueAtTime(from, at);
  oscillator.frequency.exponentialRampToValueAtTime(to, at + decay);
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(gain, at);
  envelope.gain.exponentialRampToValueAtTime(0.001, at + decay);
  oscillator.connect(envelope).connect(ctx.destination);
  oscillator.start(at);
  oscillator.stop(at + decay + 0.02);
}

export function play(sound: WoodSound) {
  if (muted) return;
  const ctx = audio();
  const now = ctx.currentTime;
  switch (sound) {
    case 'clack':
      burst(ctx, now, { freq: 2400, q: 2.5, gain: 0.5, decay: 0.05 });
      thump(ctx, now, { from: 240, to: 130, gain: 0.35, decay: 0.07 });
      break;
    case 'capture':
      burst(ctx, now, { freq: 2000, q: 2, gain: 0.6, decay: 0.06 });
      thump(ctx, now, { from: 200, to: 100, gain: 0.5, decay: 0.09 });
      burst(ctx, now + 0.035, { freq: 2800, q: 3, gain: 0.3, decay: 0.04 });
      break;
    case 'tock':
      thump(ctx, now, { from: 640, to: 470, gain: 0.22, decay: 0.08 });
      burst(ctx, now, { freq: 1300, q: 4, gain: 0.25, decay: 0.03 });
      break;
    case 'plunger':
      burst(ctx, now, { freq: 3800, q: 1.5, gain: 0.45, decay: 0.025 });
      thump(ctx, now + 0.01, { from: 180, to: 90, gain: 0.3, decay: 0.06 });
      break;
    case 'paper':
      burst(ctx, now, { freq: 4500, q: 0.6, gain: 0.12, decay: 0.16 });
      burst(ctx, now + 0.05, { freq: 3200, q: 0.8, gain: 0.08, decay: 0.12 });
      break;
  }
}

export function useSoundToggle(): [boolean, () => void] {
  const isMuted = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => muted,
  );
  const toggle = () => {
    muted = !muted;
    listeners.forEach((listener) => listener());
  };
  return [!isMuted, toggle];
}
