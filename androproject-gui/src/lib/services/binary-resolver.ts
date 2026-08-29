/**
 * BinaryResolver - SRP: Resolve binary paths with caching
 * Single Responsibility: Finding and caching binary paths
 */
import path from 'path';
import fs from 'fs';

interface BinaryCache {
  scrcpy: string | null;
  ffmpeg: string | null;
  timestamp: number;
}

const CACHE_DURATION_MS = 300_000; // 5 minutes
let binaryCache: BinaryCache = { scrcpy: null, ffmpeg: null, timestamp: 0 };

class BinaryResolver {
  private static wingetPackagesPath = path.join(
    process.env.LOCALAPPDATA || '',
    'Microsoft',
    'WinGet',
    'Packages'
  );

  private static findInWinGet(pattern: string, exePath: string): string[] {
    const candidates: string[] = [];
    try {
      for (const pkg of fs.readdirSync(this.wingetPackagesPath)) {
        if (!pkg.startsWith(pattern)) continue;
        const pkgDir = path.join(this.wingetPackagesPath, pkg);
        try {
          const subdirs = fs.readdirSync(pkgDir);
          for (const sub of subdirs) {
            const exe = path.join(pkgDir, sub, exePath);
            if (fs.existsSync(exe)) candidates.push(exe);
          }
        } catch {}
      }
    } catch {}
    return candidates;
  }

  private static findScrcpyCandidates(): string[] {
    const candidates = this.findInWinGet('Genymobile.scrcpy', 'scrcpy.exe');
    if (process.env.ANDROPROJECT_BIN_PATH) {
      candidates.push(process.env.ANDROPROJECT_BIN_PATH);
    }
    candidates.push('C:\\Program Files\\scrcpy\\scrcpy.exe', 'scrcpy');
    return candidates;
  }

  private static findFfmpegCandidates(): string[] {
    const candidates = this.findInWinGet('Gyan.FFmpeg', 'bin\\ffmpeg.exe');
    
    const linkPath = path.join(
      process.env.LOCALAPPDATA || '',
      'Microsoft',
      'WinGet',
      'Links',
      'ffmpeg.exe'
    );
    if (fs.existsSync(linkPath)) candidates.push(linkPath);
    
    candidates.push('C:\\ffmpeg\\bin\\ffmpeg.exe', 'ffmpeg');
    return candidates;
  }

  private static findExisting(candidates: string[]): string | null {
    for (const candidate of candidates) {
      try {
        if (candidate && fs.existsSync(candidate)) return candidate;
      } catch {}
    }
    return null;
  }

  static resolveScrcpy(): string {
    if (binaryCache.scrcpy && Date.now() - binaryCache.timestamp < CACHE_DURATION_MS) {
      return binaryCache.scrcpy;
    }

    const candidates = this.findScrcpyCandidates();
    const found = this.findExisting(candidates);
    
    binaryCache.scrcpy = found || 'scrcpy';
    binaryCache.timestamp = Date.now();
    
    return binaryCache.scrcpy;
  }

  static resolveFfmpeg(): string {
    if (binaryCache.ffmpeg && Date.now() - binaryCache.timestamp < CACHE_DURATION_MS) {
      return binaryCache.ffmpeg;
    }

    const candidates = this.findFfmpegCandidates();
    const found = this.findExisting(candidates);
    
    binaryCache.ffmpeg = found || 'ffmpeg';
    binaryCache.timestamp = Date.now();
    
    return binaryCache.ffmpeg;
  }

  static clearCache(): void {
    binaryCache = { scrcpy: null, ffmpeg: null, timestamp: 0 };
  }
}

export { BinaryResolver };
