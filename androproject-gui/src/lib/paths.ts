/**
 * Path resolution for AndroProject tooling.
 * Extracted from config.ts — Single Responsibility: only resolves file paths.
 */
import fs from 'fs';
import path from 'path';

export const ANDROPROJECT_HOME =
  process.env.ANDROPROJECT_HOME || 'C:\\AndroProject';

export const SCREENSHOTS_DIR =
  process.env.ANDROPROJECT_CAPTURES_DIR ||
  path.join(ANDROPROJECT_HOME, 'Capturas');

// ── ADB paths ──────────────────────────────────────────────────
const ADB_ENV = process.env.ANDROPROJECT_ADB_PATH;
const ADB_BUNDLED = path.join(ANDROPROJECT_HOME, 'adb.exe');
const ADB_SDK = path.join(
  process.env.ANDROID_SDK_ROOT || process.env.LOCALAPPDATA || '',
  'Android', 'Sdk', 'platform-tools', 'adb.exe',
);
const ADB_SDK_ALT = path.join(
  process.env.USERPROFILE || '',
  'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe',
);

export const ADB = ADB_ENV
  ? (fs.existsSync(ADB_ENV) ? ADB_ENV : 'adb')
  : [ADB_BUNDLED, ADB_SDK, ADB_SDK_ALT, 'adb']
      .find((p) => fs.existsSync(p)) || 'adb';

// ── Fastboot paths ─────────────────────────────────────────────
const FASTBOOT_ENV = process.env.ANDROPROJECT_FASTBOOT_PATH;
const FASTBOOT_BUNDLED = path.join(ANDROPROJECT_HOME, 'fastboot.exe');
const FASTBOOT_SDK = path.join(
  process.env.ANDROID_SDK_ROOT || process.env.LOCALAPPDATA || '',
  'Android', 'Sdk', 'platform-tools', 'fastboot.exe',
);
const FASTBOOT_SDK_ALT = path.join(
  process.env.USERPROFILE || '',
  'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'fastboot.exe',
);

export const FASTBOOT = FASTBOOT_ENV
  ? (fs.existsSync(FASTBOOT_ENV) ? FASTBOOT_ENV : 'fastboot')
  : [FASTBOOT_BUNDLED, FASTBOOT_SDK, FASTBOOT_SDK_ALT, 'fastboot']
      .find((p) => fs.existsSync(p)) || 'fastboot';

// ── Debug log ──────────────────────────────────────────────────
export const DEBUG_LOG = path.join(ANDROPROJECT_HOME, 'scrcpy_debug.log');
