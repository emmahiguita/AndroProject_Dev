// ============================================================================
// ARCHIVO: app-launcher.ts
// QUÉ HACE: Lanza aplicaciones Android vía ADB de forma resiliente, evitando
//           errores crudos de `monkey` en servicios o paquetes sin actividad
//           LAUNCHER (como `com.heytap.accessory`).
// CÓMO FUNCIONA:
//   1. Resuelve la actividad LAUNCHER real con `cmd package resolve-activity`
//      y la inicia limpiamente con `am start -n <componente>`.
//   2. Si falla o el dispositivo es antiguo, intenta `monkey` con captura segura.
//   3. Si el paquete está deshabilitado, devuelve un mensaje claro.
//   4. Si el paquete no tiene pantalla de inicio (servicio en segundo plano),
//      abre su ficha en Ajustes (`APPLICATION_DETAILS_SETTINGS`) como respaldo.
// POR QUÉ EXISTE: Eliminar fallos HTTP 500 con trazas crudas de ADB cuando el
//           usuario intenta abrir módulos/servicios headless del sistema.
// ============================================================================

export type ExecAdbFn = (
  command: string,
  options?: { timeout?: number },
) => Promise<{ stdout: string; stderr?: string }>;

export interface LaunchResult {
  success: boolean;
  status: number;
  message?: string;
  error?: string;
  openedSettings?: boolean;
}

const ADB_ERROR_RE = /Failure|Exception|Error:|No activities found|monkey aborted/i;

/** Extrae el componente `pkg/Activity` devuelto por `cmd package resolve-activity --brief`. */
function extractResolvedComponent(stdout: string, pkg: string): string | null {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (line.startsWith(`${pkg}/`) && !/\s/.test(line)) {
      return line;
    }
  }
  return null;
}

/** Verifica si el paquete figura en la lista de paquetes deshabilitados del dispositivo. */
async function isPackageDisabled(
  adbTarget: string,
  safePkg: string,
  execAsync: ExecAdbFn,
): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `${adbTarget} shell pm list packages -d ${safePkg}`,
      { timeout: 5000 },
    );
    return stdout
      .split(/\r?\n/)
      .some((line) => line.trim() === `package:${safePkg}`);
  } catch {
    return false;
  }
}

/** Lanza un paquete Android con resolución de actividad LAUNCHER y respaldo a Ajustes. */
export async function launchDevicePackage(
  adbTarget: string,
  safePkg: string,
  execAsync: ExecAdbFn,
): Promise<LaunchResult> {
  // 1. Resolver actividad LAUNCHER explícita y abrir con `am start` (más limpio que `monkey`).
  try {
    const { stdout: resolvedOut } = await execAsync(
      `${adbTarget} shell cmd package resolve-activity --brief -c android.intent.category.LAUNCHER ${safePkg}`,
      { timeout: 6000 },
    );
    const component = extractResolvedComponent(resolvedOut, safePkg);
    if (component) {
      const { stdout: startOut } = await execAsync(
        `${adbTarget} shell am start -n ${component}`,
        { timeout: 8000 },
      );
      if (!ADB_ERROR_RE.test(startOut)) {
        return {
          success: true,
          status: 200,
          message: `Aplicación ${safePkg} abierta en el dispositivo.`,
        };
      }
    }
  } catch {
    // Continuar al respaldo con monkey en caso de Android antiguo o error transitorio.
  }

  // 2. Respaldo compatible con versiones antiguas de Android mediante `monkey`.
  try {
    const { stdout: monkeyOut } = await execAsync(
      `${adbTarget} shell monkey -p ${safePkg} -c android.intent.category.LAUNCHER 1`,
      { timeout: 8000 },
    );
    if (!ADB_ERROR_RE.test(monkeyOut)) {
      return {
        success: true,
        status: 200,
        message: `Aplicación ${safePkg} abierta en el dispositivo.`,
      };
    }
  } catch {
    // `monkey` devuelve exit code 252 cuando el paquete no tiene actividad LAUNCHER.
  }

  // 3. Distinguir paquete deshabilitado frente a servicio en segundo plano sin interfaz.
  if (await isPackageDisabled(adbTarget, safePkg, execAsync)) {
    return {
      success: false,
      status: 422,
      error: `La aplicación ${safePkg} está deshabilitada. Habilítala primero para abrirla.`,
    };
  }

  // 4. Respaldo amigable: abrir la ficha de información de la app en Ajustes de Android.
  try {
    const { stdout: settingsOut } = await execAsync(
      `${adbTarget} shell am start -a android.settings.APPLICATION_DETAILS_SETTINGS -d package:${safePkg}`,
      { timeout: 8000 },
    );
    if (!ADB_ERROR_RE.test(settingsOut)) {
      return {
        success: true,
        status: 200,
        openedSettings: true,
        message: `${safePkg} no tiene pantalla de inicio (servicio en segundo plano). Se abrió su ficha en Ajustes.`,
      };
    }
  } catch {
    // Si Ajustes tampoco pudo abrirse, retornar error limpio y legible.
  }

  return {
    success: false,
    status: 422,
    error: `${safePkg} no tiene actividad de inicio (es un servicio o módulo en segundo plano).`,
  };
}
