// ============================================================================
// ARCHIVO: stream-manager.ts
// QUÉ HACE: Gestiona sesiones activas `scrcpy -> ffmpeg`, reconexión acotada
//           y limpieza determinista de procesos sin bucles infinitos.
// CÓMO FUNCIONA: Preserva `restartCount` y `lastRestart` entre reinicios (evita
//           que `MAX_RESTARTS` se reinicie a 0) y bloquea dobles disparos de
//           `exit` mediante la bandera `state.restarting`.
// POR QUÉ: Corregir el bucle infinito de reinicios cuando el dispositivo se
//           desconecta y mantener el archivo < 140 líneas (SRP).
// ============================================================================

import { MjpegFrameHandler } from './mjpeg-frame-handler';
import {
  killStreamProcesses,
  spawnScrcpyFfmpegPipeline,
  type StreamConfig,
  type StreamState,
} from './stream-pipeline-spawn';

export type { StreamConfig };

export class StreamManager {
  private static activeStreams = new Map<string, StreamState>();
  private static readonly MAX_RESTARTS = 3;
  private static readonly RESTART_WINDOW_MS = 30000;
  private static readonly KILL_TIMEOUT_MS = 1000;

  static create(config: StreamConfig): MjpegFrameHandler | null {
    return this.createInternal(config, 0, 0);
  }

  private static createInternal(
    config: StreamConfig,
    restartCount: number,
    lastRestart: number,
  ): MjpegFrameHandler | null {
    const { serial } = config;
    const existing = this.activeStreams.get(serial);
    if (existing && existing.isActive) return existing.frameHandler;

    try {
      const frameHandler = new MjpegFrameHandler({
        serial,
        onClientDisconnect: () => this.cleanup(serial),
      });
      const { scrcpy, ffmpeg } = spawnScrcpyFfmpegPipeline(config, frameHandler);
      const state: StreamState = {
        scrcpy, ffmpeg, frameHandler,
        isActive: true, restarting: false,
        restartCount, lastRestart,
      };
      this.setupExitHandlers(state, config);
      this.activeStreams.set(serial, state);
      return frameHandler;
    } catch (error) {
      console.error(`[StreamManager] Failed to create stream for ${serial}:`, error);
      return null;
    }
  }

  private static setupExitHandlers(state: StreamState, config: StreamConfig): void {
    const { scrcpy, ffmpeg, frameHandler } = state;
    const { serial } = config;

    const handleExit = () => {
      if (!state.isActive || state.restarting) return;
      if (scrcpy.exitCode === 0 && ffmpeg.exitCode === 0) {
        this.cleanup(serial);
        return;
      }

      const now = Date.now();
      const count = now - state.lastRestart > this.RESTART_WINDOW_MS ? 1 : state.restartCount + 1;
      if (count > this.MAX_RESTARTS) {
        console.error(`[StreamManager] Max restarts reached for ${serial}`);
        this.cleanup(serial);
        return;
      }

      state.restarting = true;
      setTimeout(() => {
        if (!state.isActive) return;
        state.isActive = false;
        killStreamProcesses(scrcpy, ffmpeg, this.KILL_TIMEOUT_MS);
        const oldClients = Array.from(frameHandler.getClients());
        this.activeStreams.delete(serial);

        try {
          const nextHandler = this.createInternal(config, count, now);
          frameHandler.destroy();
          if (nextHandler) oldClients.forEach((client) => nextHandler.addClient(client));
        } catch (error) {
          console.error(`[StreamManager] Restart failed for ${serial}:`, error);
          this.cleanup(serial);
        }
      }, 1000);
    };

    scrcpy.once('exit', handleExit);
    ffmpeg.once('exit', handleExit);
    scrcpy.once('error', handleExit);
    ffmpeg.once('error', handleExit);
  }

  static cleanup(serial: string): void {
    const state = this.activeStreams.get(serial);
    if (!state) return;
    state.isActive = false;
    state.frameHandler.destroy();
    killStreamProcesses(state.scrcpy, state.ffmpeg, this.KILL_TIMEOUT_MS);
    this.activeStreams.delete(serial);
  }

  static getFrameHandler(serial: string): MjpegFrameHandler | null {
    return this.activeStreams.get(serial)?.frameHandler || null;
  }

  static isActive(serial: string): boolean {
    return this.activeStreams.get(serial)?.isActive || false;
  }

  static getActiveSerials(): string[] {
    return Array.from(this.activeStreams.keys());
  }

  static cleanupAll(): void {
    for (const serial of this.getActiveSerials()) this.cleanup(serial);
  }
}
