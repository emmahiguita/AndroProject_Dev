// ============================================================================
// ARCHIVO: screenshot-diag.ts
// QUÉ HACE: Diagnostica y repara bloqueos de captura de pantalla en Android
//           (`FLAG_SECURE`, `disable_screen_shot`, gestos ColorOS, DevicePolicy).
// CÓMO FUNCIONA: Prueba `screencap -p` en `/data/local/tmp`, limpia ajustes
//           restrictivos si detecta bloqueo y reinicia `SystemUI` si aplicó fix.
// POR QUÉ: Aislar el diagnóstico de capturas mantiene `diagnostics.ts` < 200L.
// ============================================================================

import { NextResponse } from 'next/server';
import { safeExec } from './helpers';
import type { ActionContext } from './context';

export async function diagnoseScreenshot(ctx: ActionContext) {
  const findings: string[] = [];
  const repaired: string[] = [];

  const screencapPath = await safeExec(`${ctx.adbTarget} shell which screencap`);
  if (!screencapPath.out?.includes('/system/bin/screencap')) {
    findings.push('SCREENCAP_MISSING: binario screencap no encontrado');
  }

  const testPath = '/data/local/tmp/_ap_diag_test.png';
  await safeExec(`${ctx.adbTarget} shell screencap -p ${testPath}`);
  const sizeOut = await safeExec(`${ctx.adbTarget} shell stat -c %s ${testPath} 2>/dev/null || wc -c < ${testPath} 2>/dev/null`);
  const testSize = parseInt((sizeOut.out || '0').replace(/\D/g, ''), 10) || 0;
  await safeExec(`${ctx.adbTarget} shell rm -f ${testPath}`);

  if (testSize < 5000 && testSize > 0) {
    findings.push(`FLAG_SECURE_DETECTED: captura genera archivo diminuto (${testSize} bytes) — app foreground bloquea`);
  } else if (testSize === 0) {
    findings.push('SCREENCAP_FAILED: screencap no genera archivo — posible error del display HAL');
  }

  const globalDisable = await safeExec(`${ctx.adbTarget} shell settings get global disable_screen_shot`);
  if ((globalDisable.out || '').trim() === '1') {
    findings.push('GLOBAL_DISABLE: disable_screen_shot=1 bloquea todas las capturas');
    await safeExec(`${ctx.adbTarget} shell settings delete global disable_screen_shot`);
    await safeExec(`${ctx.adbTarget} shell settings put global disable_screen_shot 0`);
    repaired.push('GLOBAL_DISABLE: eliminado');
  }

  const threeFinger = await safeExec(`${ctx.adbTarget} shell settings get system oppo_three_finger_screenshot`);
  if ((threeFinger.out || '').trim() === '0') {
    findings.push('THREE_FINGER_OFF: gesto de tres dedos desactivado');
    await safeExec(`${ctx.adbTarget} shell settings put system oppo_three_finger_screenshot 1`);
    await safeExec(`${ctx.adbTarget} shell settings put system three_gesture_screenshot 1`);
    await safeExec(`${ctx.adbTarget} shell settings put system oppo_screenshot_gesture 1`);
    await safeExec(`${ctx.adbTarget} shell settings put secure screenshot_enabled 1`);
    repaired.push('THREE_FINGER: activado');
  }

  const dpm = await safeExec(`${ctx.adbTarget} shell dumpsys device_policy | grep -i 'mScreenCaptureDisabled\\|screenshot'`);
  if ((dpm.out || '').toLowerCase().includes('true') || (dpm.out || '').toLowerCase().includes('disabled')) {
    findings.push('DEVICE_POLICY: política de administrador bloquea capturas');
  }

  const users = await safeExec(`${ctx.adbTarget} shell pm list users`);
  if ((users.out || '').includes(':20}')) {
    findings.push('WORK_PROFILE: perfil de trabajo detectado — puede tener restricciones');
  }

  if (repaired.length > 0) {
    await safeExec(`${ctx.adbTarget} shell pkill -f com.android.systemui`);
    repaired.push('SystemUI: reiniciado');
  }

  await safeExec(`${ctx.adbTarget} shell input keyevent 120`);
  await new Promise((r) => setTimeout(r, 1000));
  const finalCheck = await safeExec(`${ctx.adbTarget} shell ls -lt /sdcard/Pictures/Screenshots/ | head -3`);
  const finalOk = (finalCheck.out || '').includes('.png');

  return NextResponse.json({
    success: true,
    repaired: repaired.length > 0,
    findings,
    fixes: repaired,
    captureTestOk: finalOk,
    message: finalOk
      ? 'Captura funcionando correctamente'
      : findings.length > 0
        ? `Problemas encontrados: ${findings.join('; ')}`
        : 'Sin problemas detectados pero la captura de prueba falló. Probá manualmente Power+Vol Down.',
  });
}
