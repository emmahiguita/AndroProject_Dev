/**
 * Lock file management for concurrent processes (scrcpy, recording).
 * Extracted from config.ts — Single Responsibility: process lock lifecycle.
 */
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ANDROPROJECT_HOME } from './paths';

const execAsync = promisify(exec);

// ── Lock file paths ─────────────────────────────────────────────
export const getLockFile = (serial: string): string =>
  path.join(ANDROPROJECT_HOME, `.androproject_active_${serial.replace(/[:.]/g, '_')}`);

export const getRecordLockFile = (serial: string): string =>
  path.join(ANDROPROJECT_HOME, `.androproject_record_${serial.replace(/[:.]/g, '_')}`);

// ── Lock lifecycle ──────────────────────────────────────────────
export function writeLock(lockFile: string, data: { pid: number; serial: string; path?: string }): void {
  fs.writeFileSync(lockFile, JSON.stringify({ ...data, startedAt: Date.now() }));
}

export function readLock(lockFile: string): Record<string, unknown> | null {
  if (!fs.existsSync(lockFile)) return null;
  try {
    const raw = fs.readFileSync(lockFile, 'utf8').trim();
    return raw.startsWith('{') ? JSON.parse(raw) : { pid: parseInt(raw, 10) };
  } catch {
    return null;
  }
}

export function deleteLock(lockFile: string): void {
  try { if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile); } catch { /* ignore */ }
}

// ── Lock validation ─────────────────────────────────────────────
export async function isLockAlive(lockFile: string, processPattern?: string): Promise<boolean> {
  const lock = readLock(lockFile);
  if (!lock?.pid) return false;

  try {
    const { stdout } = await execAsync(`tasklist /FI "PID eq ${lock.pid}" /NH`);
    if (!stdout.includes(String(lock.pid))) return false;
    if (processPattern && !stdout.includes(processPattern)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function killLockedProcess(lockFile: string): Promise<boolean> {
  const lock = readLock(lockFile);
  if (!lock?.pid) { deleteLock(lockFile); return false; }

  try {
    await execAsync(`taskkill /PID ${lock.pid} /T`);
    deleteLock(lockFile);
    return true;
  } catch {
    deleteLock(lockFile);
    return false;
  }
}

// ── Orphan cleanup ──────────────────────────────────────────────
export async function cleanupOrphanedLocks(): Promise<void> {
  if (!fs.existsSync(ANDROPROJECT_HOME)) return;
  const files = fs.readdirSync(ANDROPROJECT_HOME);
  for (const file of files) {
    if (!file.startsWith('.androproject_active_') && !file.startsWith('.androproject_record_')) continue;
    const lockPath = path.join(ANDROPROJECT_HOME, file);
    const alive = await isLockAlive(lockPath, 'scrcpy');
    if (!alive) deleteLock(lockPath);
  }
}
