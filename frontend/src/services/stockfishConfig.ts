/**
 * Shared Stockfish engine configuration.
 *
 * Uses Stockfish 18 NNUE (lite multi-thread build from nmrugg/stockfish.js).
 * The NNUE network is embedded in the .wasm file (~7MB).
 * Multi-threading requires SharedArrayBuffer + COOP/COEP headers (configured
 * in vite.config.ts for dev and nginx.prod.conf for production).
 */

/** Path to the Stockfish Web Worker script (served from public/). */
export const STOCKFISH_WORKER_PATH = '/stockfish-18-lite.js';

/**
 * Determine the optimal number of Stockfish threads for the current device.
 *
 * Strategy:
 * - Mobile devices: 1 thread (preserves battery and UI responsiveness)
 * - Desktop: up to 4 threads, leaving 1 core free for the browser
 * - Falls back to 1 if hardwareConcurrency is unavailable
 */
export function getOptimalThreadCount(): number {
  const cores = navigator?.hardwareConcurrency ?? 1;

  if (isMobileDevice()) {
    // On mobile with many cores (≥ 6), allow 2 threads
    return cores >= 6 ? 2 : 1;
  }

  // Desktop: use up to 4 threads, leaving at least 1 core for the browser/OS
  return Math.max(1, Math.min(cores - 1, 4));
}

/** Simple mobile detection based on touch capability and screen size. */
function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;

  // Primary indicator: coarse pointer (touch screen as primary input)
  if (typeof matchMedia !== 'undefined') {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const smallScreen = matchMedia('(max-width: 768px)').matches;
    if (coarse && smallScreen) return true;
  }

  // Fallback: touch points
  if (navigator.maxTouchPoints > 0 && screen.width < 768) return true;

  return false;
}
