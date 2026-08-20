// ── Core interfaces for service layer ────────────────────────────────

/** Result of a shell command execution */
export interface CommandResult {
  ok: boolean;
  out: string;
  err: string;
}

/** Abstraction over shell command execution — replaceable for testing */
export interface ICommandExecutor {
  exec(cmd: string, timeoutMs?: number): Promise<CommandResult>;
}

/** Configuration for the ADB command executor */
export interface AdbConfig {
  adbPath: string;
  fastbootPath: string;
  deviceSerial?: string;
}
