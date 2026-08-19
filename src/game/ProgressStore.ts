import { config } from '../config';

const CURRENT_VERSION = 1;

export interface LevelRecord {
  bestTimeMs: number,
  noDamage: boolean,
}

interface ProgressData {
  version: number,
  levels: Record<string, LevelRecord>,
  totalBestMs?: number,
}

export function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const tenths = Math.floor((total % 1000) / 100);

  return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
}

function emptyProgress(): ProgressData {
  return { version: CURRENT_VERSION, levels: {} };
}

function isLevelRecord(value: unknown): value is LevelRecord {
  if (!value || typeof value !== 'object') return false;

  const record = value as LevelRecord;

  return Number.isFinite(record.bestTimeMs) && typeof record.noDamage === 'boolean';
}

function readProgress(): ProgressData {
  try {
    const raw = localStorage.getItem(config.records.storageKey);

    if (!raw) return emptyProgress();

    const data = JSON.parse(raw) as ProgressData;

    if (data.version !== CURRENT_VERSION || !data.levels || typeof data.levels !== 'object') {
      return emptyProgress();
    }

    const levels: Record<string, LevelRecord> = {};

    for (const [key, record] of Object.entries(data.levels)) {
      if (isLevelRecord(record)) {
        levels[key] = { bestTimeMs: record.bestTimeMs, noDamage: record.noDamage };
      }
    }

    const totalBestMs = Number.isFinite(data.totalBestMs) ? data.totalBestMs : undefined;

    return { version: CURRENT_VERSION, levels, totalBestMs };
  } catch {
    return emptyProgress();
  }
}

function writeProgress(data: ProgressData) {
  try {
    localStorage.setItem(config.records.storageKey, JSON.stringify(data));
  } catch {
    // Private mode and quota errors must not block the scene change.
  }
}

/**
 * Level times live in memory for the current dive and in localStorage for personal bests.
 * A bad payload is treated as a fresh save rather than trusted.
 */
export class ProgressStore {
  private data = readProgress();
  private runTimes: Record<string, number> = {};
  private lastResult?: {
    levelKey: string,
    timeMs: number,
    bestTimeMs: number,
    isRecord: boolean,
    noDamage: boolean,
  };

  beginRun() {
    this.runTimes = {};
    this.lastResult = undefined;
  }

  finishLevel(levelKey: string, timeMs: number, noDamage: boolean) {
    this.runTimes[levelKey] = timeMs;

    const previous = this.data.levels[levelKey];
    const isRecord = !previous || timeMs < previous.bestTimeMs;
    const bestTimeMs = previous ? Math.min(previous.bestTimeMs, timeMs) : timeMs;

    this.data.levels[levelKey] = {
      bestTimeMs,
      noDamage: Boolean(previous?.noDamage) || noDamage,
    };

    this.lastResult = { levelKey, timeMs, bestTimeMs, isRecord, noDamage };
    writeProgress(this.data);

    return this.lastResult;
  }

  finishRun() {
    const totalMs = this.getRunTotal();

    if (totalMs > 0 && (!this.data.totalBestMs || totalMs < this.data.totalBestMs)) {
      this.data.totalBestMs = totalMs;
      writeProgress(this.data);
    }

    return {
      totalMs,
      bestTotalMs: this.data.totalBestMs,
      isRecord: totalMs > 0 && this.data.totalBestMs === totalMs,
    };
  }

  getBest(levelKey: string) {
    return this.data.levels[levelKey];
  }

  getRunTotal() {
    return Object.values(this.runTimes).reduce((sum, time) => sum + time, 0);
  }

  getTotalBest() {
    return this.data.totalBestMs;
  }

  getLastResult() {
    return this.lastResult;
  }
}

export const progressStore = new ProgressStore();
