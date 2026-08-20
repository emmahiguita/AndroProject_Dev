import { NextResponse } from 'next/server';
import { safeExec } from './_lib/helpers';
import { ActionContext } from './_lib/context';

export async function fastbootReboot(ctx: ActionContext) {
  await safeExec(`${ctx.fastbootTarget} reboot`);
  return NextResponse.json({ success: true, message: 'Reiniciando desde Fastboot...' });
}

export async function fastbootRebootRecovery(ctx: ActionContext) {
  await safeExec(`${ctx.fastbootTarget} reboot recovery`);
  return NextResponse.json({ success: true, message: 'Saltando a Recovery desde Fastboot...' });
}

export async function fastbootErase(ctx: ActionContext) {
  await safeExec(`${ctx.fastbootTarget} -w`);
  await safeExec(`${ctx.fastbootTarget} erase metadata`);
  return NextResponse.json({ success: true, message: 'Factory Reset completo. El dispositivo se reiniciará.' });
}
