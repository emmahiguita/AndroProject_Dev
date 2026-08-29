/**
 * StreamManager - SRP: Manage scrcpy+ffmpeg pipeline lifecycle
 * Single Responsibility: Pipeline creation, monitoring, and cleanup
 * Optimizations:
 * - Efficient process management
 * - Silent logging for performance
 * - Clean resource cleanup
 */
import { ChildProcess, spawn } from 'child_process';
import { ADB } from '@/lib/config';
import { BinaryResolver } from './binary-resolver';
import { MjpegFrameHandler } from './mjpeg-frame-handler';

interface StreamConfig {
  serial: string;
  maxSize?: string;
  maxFps?: string;
  bitRate?: string;
}

interface StreamState {
  scrcpy: ChildProcess;
  ffmpeg: ChildProcess;
  frameHandler: MjpegFrameHandler;
  isActive: boolean;
  restartCount: number;
  lastRestart: number;
}

export class StreamManager {
  private static activeStreams = new Map<string, StreamState>();
  private static readonly MAX_RESTARTS = 3;
  private static readonly RESTART_WINDOW_MS = 30000; // 30 seconds
  private static readonly KILL_TIMEOUT_MS = 1000;

  private static get scrcpyPath(): string {
    const path = BinaryResolver.resolveScrcpy();
    if (!path || path === 'scrcpy') {
      console.warn('[StreamManager] scrcpy binary not found, using system PATH');
    }
    return path;
  }

  private static get ffmpegPath(): string {
    const path = BinaryResolver.resolveFfmpeg();
    if (!path || path === 'ffmpeg') {
      console.warn('[StreamManager] ffmpeg binary not found, using system PATH');
    }
    return path;
  }

  static create(config: StreamConfig): MjpegFrameHandler | null {
    const { serial } = config;
    
    // Check if stream already exists
    const existing = this.activeStreams.get(serial);
    if (existing && existing.isActive) {
      return existing.frameHandler;
    }

    try {
      const frameHandler = new MjpegFrameHandler({
        serial,
        onClientDisconnect: () => this.cleanup(serial),
      });

      const { scrcpy, ffmpeg } = this.spawnPipeline(config, frameHandler);
      
      const state: StreamState = {
        scrcpy,
        ffmpeg,
        frameHandler,
        isActive: true,
        restartCount: 0,
        lastRestart: 0,
      };

      this.setupExitHandlers(state, config);
      this.activeStreams.set(serial, state);

      return frameHandler;
    } catch (error) {
      console.error(`[StreamManager] Failed to create stream for ${serial}:`, error);
      return null;
    }
  }

  private static spawnPipeline(
    config: StreamConfig,
    frameHandler: MjpegFrameHandler
  ): { scrcpy: ChildProcess; ffmpeg: ChildProcess } {
    const { serial, maxSize = '720', maxFps = '30', bitRate = '4M' } = config;

    const scrcpy = spawn(this.scrcpyPath, [
      '-s', serial,
      '--no-playback',
      '--no-audio',
      '--display-id=0',
      '--video-codec=h264',
      '--max-size', maxSize,
      '--max-fps', maxFps,
      '-b', bitRate,
      '--video-buffer=0',
      '--stay-awake',
      '--record=-',
      '--record-format=mkv',
    ], {
      env: { ...process.env, ADB },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const ffmpeg = spawn(this.ffmpegPath, [
      '-f', 'matroska',
      '-i', 'pipe:0',
      '-an',
      '-f', 'mjpeg',
      '-q:v', '4', // Balanced quality for real-time streaming
      '-r', maxFps,
      '-g', '5', // Very small GOP for minimum latency
      '-threads', '1', // Single thread for minimum overhead
      '-preset', 'ultrafast',
      '-tune', 'zerolatency', // Zero latency tuning
      'pipe:1',
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    // Pipe scrcpy → ffmpeg
    scrcpy.stdout?.pipe(ffmpeg.stdin);

    // Attach frame handler to ffmpeg output
    ffmpeg.stdout?.on('data', (chunk: Buffer) => {
      frameHandler.processChunk(chunk);
    });

    // Silent error logging (only on exit)
    scrcpy.stderr?.on('data', () => {}); // Suppress scrcpy stderr
    ffmpeg.stderr?.on('data', () => {}); // Suppress ffmpeg stderr

    return { scrcpy, ffmpeg };
  }

  private static setupExitHandlers(state: StreamState, config: StreamConfig): void {
    const { scrcpy, ffmpeg, frameHandler } = state;
    const { serial } = config;

    const handleExit = () => {
      if (!state.isActive) return;

      const scrcpyCode = scrcpy.exitCode;
      const ffmpegCode = ffmpeg.exitCode;

      // Clean exit
      if (scrcpyCode === 0 && ffmpegCode === 0) {
        this.cleanup(serial);
        return;
      }

      // Check restart limits
      const now = Date.now();
      if (now - state.lastRestart > this.RESTART_WINDOW_MS) {
        state.restartCount = 0;
      }

      if (state.restartCount >= this.MAX_RESTARTS) {
        console.error(`[StreamManager] Max restarts reached for ${serial}`);
        this.cleanup(serial);
        return;
      }

      // Attempt restart
      state.restartCount++;
      state.lastRestart = now;

      setTimeout(() => {
        if (!state.isActive) return;
        
        this.killProcesses(scrcpy, ffmpeg);
        
        try {
          const newFrameHandler = this.create(config);
          if (newFrameHandler) {
            // Transfer clients from old handler to new handler
            const oldClients = Array.from(frameHandler.getClients());
            frameHandler.destroy(); // Clean up old handler
            oldClients.forEach(client => {
              newFrameHandler.addClient(client);
            });
          }
        } catch (error) {
          console.error(`[StreamManager] Restart failed for ${serial}:`, error);
          this.cleanup(serial);
        }
      }, 1000);
    };

    scrcpy.on('exit', handleExit);
    ffmpeg.on('exit', handleExit);
    scrcpy.on('error', () => handleExit());
    ffmpeg.on('error', () => handleExit());
  }

  private static killProcesses(scrcpy: ChildProcess, ffmpeg: ChildProcess): void {
    try { scrcpy.kill('SIGTERM'); } catch {}
    try { ffmpeg.kill('SIGTERM'); } catch {}
    
    setTimeout(() => {
      try { scrcpy.kill('SIGKILL'); } catch {}
      try { ffmpeg.kill('SIGKILL'); } catch {}
    }, this.KILL_TIMEOUT_MS);
  }

  static cleanup(serial: string): void {
    const state = this.activeStreams.get(serial);
    if (!state) return;

    state.isActive = false;
    state.frameHandler.destroy();
    this.killProcesses(state.scrcpy, state.ffmpeg);
    
    this.activeStreams.delete(serial);
  }

  static getFrameHandler(serial: string): MjpegFrameHandler | null {
    const state = this.activeStreams.get(serial);
    return state?.frameHandler || null;
  }

  static isActive(serial: string): boolean {
    const state = this.activeStreams.get(serial);
    return state?.isActive || false;
  }

  static getActiveSerials(): string[] {
    return Array.from(this.activeStreams.keys());
  }

  static cleanupAll(): void {
    for (const serial of this.getActiveSerials()) {
      this.cleanup(serial);
    }
  }
}

export type { StreamConfig };
