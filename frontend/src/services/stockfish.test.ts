import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stockfishService } from './stockfish';

/**
 * Fake Worker that records posted messages and lets tests drive the
 * onmessage / onerror / onmessageerror handlers manually.
 */
class FakeWorker {
  static instances: FakeWorker[] = [];

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  posted: string[] = [];
  terminated = false;

  constructor(public scriptURL: string) {
    FakeWorker.instances.push(this);
  }

  postMessage(command: string): void {
    this.posted.push(command);
  }

  terminate(): void {
    this.terminated = true;
  }

  /** Simulate a line emitted by the engine. */
  emit(line: string): void {
    this.onmessage?.({ data: line } as MessageEvent);
  }

  /** Drive the UCI handshake so the service flips to ready. */
  handshake(): void {
    this.emit('uciok');
    this.emit('readyok');
  }
}

describe('stockfishService', () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker);
    // Ensure a clean singleton between tests.
    stockfishService.terminate();
  });

  afterEach(() => {
    stockfishService.terminate();
    vi.unstubAllGlobals();
  });

  const latestWorker = () => FakeWorker.instances[FakeWorker.instances.length - 1];

  it('re-applies MultiPV after terminate and re-initialize', () => {
    // First session: consumer requests MultiPV=3.
    stockfishService.initialize();
    let worker = latestWorker();
    worker.handshake();

    stockfishService.analyzePosition('startpos', 12, 3);
    expect(worker.posted).toContain('setoption name MultiPV value 3');

    // Navigate away: tear the worker down.
    stockfishService.terminate();
    expect(worker.terminated).toBe(true);

    // Navigate back: fresh worker starts at engine default (MultiPV=1).
    stockfishService.initialize();
    worker = latestWorker();
    worker.handshake();

    // Requesting MultiPV=3 again MUST re-send the setoption on the new worker.
    stockfishService.analyzePosition('startpos', 12, 3);
    expect(worker.posted).toContain('setoption name MultiPV value 3');
  });

  it('terminate() resets cached MultiPV state', () => {
    stockfishService.initialize();
    latestWorker().handshake();
    stockfishService.analyzePosition('startpos', 12, 3);

    stockfishService.terminate();

    // A new worker that only ever requests MultiPV=3 should still receive the
    // setoption, proving the cached value was reset to the default.
    stockfishService.initialize();
    const worker = latestWorker();
    worker.handshake();
    stockfishService.analyzePosition('startpos', 12, 3);
    expect(worker.posted).toContain('setoption name MultiPV value 3');
  });

  it('recovers in-session after a worker error', () => {
    const onError = vi.fn();
    stockfishService.setCallbacks({ onError });

    stockfishService.initialize();
    const deadWorker = latestWorker();
    deadWorker.handshake();
    expect(stockfishService.isEngineReady()).toBe(true);

    // Simulate a worker crash.
    deadWorker.onerror?.({ message: 'boom' } as ErrorEvent);

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('boom'));
    expect(deadWorker.terminated).toBe(true);
    expect(stockfishService.isEngineReady()).toBe(false);

    // initialize() must create a brand-new worker, not early-return on a stale ref.
    stockfishService.initialize();
    const freshWorker = latestWorker();
    expect(freshWorker).not.toBe(deadWorker);
    freshWorker.handshake();
    expect(stockfishService.isEngineReady()).toBe(true);
  });

  it('handles onmessageerror by tearing the worker down', () => {
    const onError = vi.fn();
    stockfishService.setCallbacks({ onError });

    stockfishService.initialize();
    const worker = latestWorker();
    worker.handshake();

    expect(worker.onmessageerror).toBeTypeOf('function');
    worker.onmessageerror?.({ data: 'bad' } as MessageEvent);

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('bad'));
    expect(worker.terminated).toBe(true);
    expect(stockfishService.isEngineReady()).toBe(false);
  });

  it('initialize() is a no-op while a live worker exists', () => {
    stockfishService.initialize();
    const first = latestWorker();
    stockfishService.initialize();
    expect(latestWorker()).toBe(first);
    expect(FakeWorker.instances).toHaveLength(1);
  });
});
