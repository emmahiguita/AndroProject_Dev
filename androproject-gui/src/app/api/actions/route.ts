import { NextResponse } from 'next/server';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import {
  ADB, ANDROPROJECT_BIN, FASTBOOT, SCREENSHOTS_DIR,
  ANDROPROJECT_HOME, SCRCPY_SERVER_PATH, SCRCPY_ICON_PATH,
  getLockFile, getRecordLockFile, cleanupOrphanedLocks
} from '@/lib/config';

const execAsync = promisify(exec);

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

async function safeExec(cmd: string, timeoutMs: number = 10000) {
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: timeoutMs });
    return { ok: true, out: stdout, err: stderr };
  } catch (error: unknown) {
    const failure = error as { stdout?: unknown };
    const output = typeof failure.stdout === 'string' ? failure.stdout : '';
    return { ok: false, out: output, err: getErrorMessage(error) };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, ip, serial, videoSource } = body;

    const { stdout: devicesOut } = await execAsync(`"${ADB}" devices`);
    const id = devicesOut.split('\n').slice(1).find(l => l.includes('\tdevice'))?.split(/\s+/)[0];
    const targetSerial = serial || ip || id;
    const adbTarget = targetSerial ? `"${ADB}" -s ${targetSerial}` : `"${ADB}"`;
    const fastbootTarget = (serial && serial !== 'Hardware Level') ? `"${FASTBOOT}" -s ${serial}` : `"${FASTBOOT}"`;

    if (action === 'open_screen') {
      if (!targetSerial) {
        return NextResponse.json({ success: false, error: 'No hay un dispositivo Android conectado' }, { status: 400 });
      }
      if (!fs.existsSync(ANDROPROJECT_BIN)) {
        return NextResponse.json({ success: false, error: `No se encontró el motor de transmisión en ${ANDROPROJECT_BIN}` }, { status: 503 });
      }

      const streamLockFile = getLockFile(targetSerial.replace(/[:.]/g, '_'));
      if (fs.existsSync(streamLockFile)) {
        try {
          const lockData = JSON.parse(fs.readFileSync(streamLockFile, 'utf8'));
          const { stdout } = await execAsync(`tasklist /FI "PID eq ${lockData.pid}" /NH`);
          if (stdout.includes(String(lockData.pid))) {
            return NextResponse.json({ success: true, alive: true, message: 'La transmisión ya está activa' });
          }
        } catch {}
        try { fs.unlinkSync(streamLockFile); } catch {}
      }

      const streamArgs = [
        '-s', String(targetSerial),
        '--video-bit-rate=16M', '--max-size=1920', '--max-fps=60',
        '--stay-awake', '--window-title', `AndroProject - ${targetSerial}`,
      ];
      if (videoSource === 'camera') {
        streamArgs.push('--video-source=camera', '--camera-facing=back', '--no-audio');
      }

      const streamProcess = spawn(ANDROPROJECT_BIN, streamArgs, {
        cwd: ANDROPROJECT_HOME,
        env: { ...process.env, ADB },
        windowsHide: false,
      });
      if (!streamProcess.pid) {
        return NextResponse.json({ success: false, error: 'No se pudo iniciar el motor de transmisión' }, { status: 500 });
      }

      fs.writeFileSync(streamLockFile, JSON.stringify({ pid: streamProcess.pid, serial: targetSerial, videoSource, startedAt: Date.now() }));
      const cleanupStreamLock = () => {
        try { if (fs.existsSync(streamLockFile)) fs.unlinkSync(streamLockFile); } catch {}
      };
      streamProcess.once('exit', cleanupStreamLock);
      streamProcess.once('error', cleanupStreamLock);
      return NextResponse.json({
        success: true, alive: true, pid: streamProcess.pid,
        message: videoSource === 'camera' ? 'Cámara del dispositivo abierta en el PC' : 'Pantalla del dispositivo proyectándose en el PC',
      });
    }

    if (action === 'check_screen' || action === 'stop_screen') {
      const streamSerial = targetSerial ? targetSerial.replace(/[:.]/g, '_') : 'default';
      const streamLockFile = getLockFile(streamSerial);
      if (!fs.existsSync(streamLockFile)) {
        return NextResponse.json({ success: true, alive: false, reason: 'La transmisión no está activa' });
      }
      try {
        const lockData = JSON.parse(fs.readFileSync(streamLockFile, 'utf8'));
        const { stdout } = await execAsync(`tasklist /FI "PID eq ${lockData.pid}" /NH`);
        const alive = stdout.includes(String(lockData.pid));
        if (action === 'stop_screen' && alive) {
          await execAsync(`taskkill /PID ${lockData.pid} /T`).catch(() => {});
          try { fs.unlinkSync(streamLockFile); } catch {}
          return NextResponse.json({ success: true, alive: false, message: 'Transmisi\u00f3n detenida' });
        }
        if (!alive) { try { fs.unlinkSync(streamLockFile); } catch {} }
        return NextResponse.json({ success: true, alive, videoSource: lockData.videoSource, reason: alive ? undefined : 'El motor de transmisión se cerró' });
      } catch {
        try { fs.unlinkSync(streamLockFile); } catch {}
        return NextResponse.json({ success: true, alive: false, reason: 'Estado de transmisión inválido' });
      }
    }


    if (action === 'restart_adb') {
      await safeExec(`"${ADB}" kill-server`);
      await safeExec(`"${ADB}" start-server`);
      return NextResponse.json({ success: true, message: 'ADB reiniciado correctamente' });
    }

    if (action === 'enable_wifi') {
      try {
        const rIp = await safeExec(`${adbTarget} shell ip route`);
        if (!rIp.ok) throw new Error('Error ejecutando ip route');
        const ipLine = rIp.out.split('\n').find((line: string) => (line.includes('wlan') || line.includes('eth')) && line.includes('src'));
        if (!ipLine) throw new Error('No se pudo encontrar la IP del celular en la interfaz inalámbrica.');
        const match = ipLine.match(/src\s+([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
        if (!match) throw new Error('No se pudo descifrar la IP del celular.');
        const deviceIp = match[1];

        if (devicesOut.includes(`${deviceIp}:5555`)) {
          return NextResponse.json({ success: true, message: `Wi-Fi silencioso ya activo (${deviceIp}).`, ip: deviceIp });
        }

        const rTcp = await safeExec(`${adbTarget} shell cat /proc/net/tcp`);
        const isTcpipReady = rTcp.ok && rTcp.out.includes(':15B3');

        if (!isTcpipReady) {
          await safeExec(`${adbTarget} tcpip 5555`);
          await new Promise(r => setTimeout(r, 2000));
        }
        await safeExec(`"${ADB}" connect ${deviceIp}:5555`);

        return NextResponse.json({ success: true, message: `Conexión Wi-Fi establecida en segundo plano (${deviceIp}).`, ip: deviceIp });
      } catch (err: unknown) {
        return NextResponse.json({ success: false, error: getErrorMessage(err) });
      }
    }

    if (action === 'radar') {
      // Limpiar locks huérfanos al iniciar radar
      await cleanupOrphanedLocks().catch(() => {});

      const psScript = `
        $localIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -match 'Wi-Fi|Ethernet' -and $_.IPAddress -notmatch '^169\\.' } | Select-Object -First 1).IPAddress
        if (-not $localIp) { exit }
        $base = $localIp.Substring(0, $localIp.LastIndexOf('.'))
        $ips = 1..254 | ForEach-Object { "$base.$_" }
        $tasks = foreach ($ip in $ips) {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $ar = $tcp.BeginConnect($ip, 5555, $null, $null)
            [PSCustomObject]@{ IP = $ip; AR = $ar; TCP = $tcp }
        }
        Start-Sleep -Milliseconds 500
        foreach ($t in $tasks) {
            if ($t.AR.IsCompleted -and $t.TCP.Connected) {
                Write-Output $t.IP
                $t.TCP.Close()
                exit
            }
            $t.TCP.Close()
        }
      `;
      try {
        const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
        const rScan = await safeExec(`powershell -ExecutionPolicy Bypass -NoProfile -EncodedCommand ${encoded}`, 10000);
        const ip = rScan.ok ? rScan.out.trim() : '';
        if (ip) {
          await safeExec(`"${ADB}" connect ${ip}:5555`);
          return NextResponse.json({ success: true, message: `Radar exitoso. Conectado a ${ip}` });
        } else {
          throw new Error('No se encontraron celulares con el puerto 5555 abierto.');
        }
      } catch (err: unknown) {
        return NextResponse.json({ success: false, error: getErrorMessage(err) });
      }
    }

    if (action === 'reboot') {
      await safeExec(`${adbTarget} reboot`);
      return NextResponse.json({ success: true, message: 'Reiniciando dispositivo...' });
    }

    if (action === 'reboot_bootloader') {
      await safeExec(`${adbTarget} reboot bootloader`);
      return NextResponse.json({ success: true, message: 'Reiniciando en modo Bootloader...' });
    }

    if (action === 'reboot_recovery') {
      await safeExec(`${adbTarget} reboot recovery`);
      return NextResponse.json({ success: true, message: 'Reiniciando en modo Recovery...' });
    }

    if (action === 'power_off') {
      await safeExec(`${adbTarget} shell reboot -p`);
      return NextResponse.json({ success: true, message: 'Apagando dispositivo...' });
    }

    if (action === 'get_foreground_app') {
      const [windowResult, activityResult] = await Promise.all([
        safeExec(`${adbTarget} shell dumpsys window windows`),
        safeExec(`${adbTarget} shell dumpsys activity activities`),
      ]);
      const output = `${windowResult.out || ''}\n${activityResult.out || ''}`;
      const match =
        output.match(/mCurrentFocus=.*?\s([A-Za-z0-9._]+)\/[A-Za-z0-9.$_]+/) ||
        output.match(/mResumedActivity:.*?\s([A-Za-z0-9._]+)\/[A-Za-z0-9.$_]+/) ||
        output.match(/topResumedActivity=.*?\s([A-Za-z0-9._]+)\/[A-Za-z0-9.$_]+/);

      if ((!windowResult.ok && !activityResult.ok) || !match?.[1]) {
        return NextResponse.json({
          success: false,
          error: 'No se pudo identificar la aplicación activa',
        });
      }

      return NextResponse.json({ success: true, package: match[1] });
    }
    if (action === 'keyevent') {
      const { keycode } = body;
      await safeExec(`${adbTarget} shell input keyevent ${keycode}`);
      return NextResponse.json({ success: true, message: `Tecla enviada: ${keycode}` });
    }

    // ── Animaciones ─────────────────────────────────────────────────────
    if (action === 'set_animation_batch') {
      const { scales } = body;
      const errors: string[] = [];
      for (const [k, v] of Object.entries(scales || {})) {
        const r = await safeExec(`${adbTarget} shell settings put global ${k} ${v}`);
        if (!r.ok) errors.push(`${k}: ${r.err}`);
      }
      return NextResponse.json({ success: errors.length === 0, message: errors.length ? errors.join('; ') : 'Todas las animaciones aplicadas' });
    }

    if (action === 'set_animation_scale') {
      const { type, value } = body;
      const keys: Record<string, string> = { window: 'window_animation_scale', transition: 'transition_animation_scale', animator: 'animator_duration_scale' };
      const key = keys[type];
      if (!key) return NextResponse.json({ success: false, error: 'Tipo inválido' });
      const r = await safeExec(`${adbTarget} shell settings put global ${key} ${value}`);
      return NextResponse.json({ success: r.ok, message: r.ok ? `${key}=${value}x` : r.err });
    }

    if (action === 'get_animation_scale') {
      const scales: Record<string, string> = {};
      for (const k of ['window_animation_scale','transition_animation_scale','animator_duration_scale']) {
        const r = await safeExec(`${adbTarget} shell settings get global ${k}`);
        scales[k] = (r.ok && r.out) ? r.out.trim() || '1.0' : '1.0';
      }
      return NextResponse.json({ success: true, scales });
    }

    // ── DPI / Display ────────────────────────────────────────────────────
    if (action === 'set_dpi') {
      const r = await safeExec(`${adbTarget} shell wm density ${body.dpi}`);
      return NextResponse.json({ success: r.ok, message: r.ok ? `DPI ajustado a ${body.dpi}` : r.err });
    }

    if (action === 'get_dpi') {
      const r = await safeExec(`${adbTarget} shell wm density`, 5000);
      const match = r.ok ? r.out.match(/\d+/) : null;
      return NextResponse.json({ success: true, dpi: match ? parseInt(match[0]) : 420 });
    }

    if (action === 'set_font_scale') {
      const r = await safeExec(`${adbTarget} shell settings put system font_scale ${body.scale}`);
      return NextResponse.json({ success: r.ok, message: r.ok ? `Escala: ${body.scale}x` : r.err });
    }

    if (action === 'set_screen_timeout') {
      const r = await safeExec(`${adbTarget} shell settings put system screen_off_timeout ${body.timeout}`);
      return NextResponse.json({ success: r.ok, message: r.ok ? `Timeout: ${body.timeout}ms` : r.err });
    }

    if (action === 'set_peak_refresh') {
      const r = await safeExec(`${adbTarget} shell settings put system peak_refresh_rate ${body.hz}`);
      return NextResponse.json({ success: r.ok, message: r.ok ? `Refresco: ${body.hz}Hz` : r.err });
    }

    if (action === 'set_night_mode') {
      const r = await safeExec(`${adbTarget} shell settings put secure ui_night_mode ${body.mode}`);
      return NextResponse.json({ success: r.ok, message: r.ok ? `Modo noche: ${body.mode}` : r.err });
    }

    if (action === 'set_auto_brightness') {
      const r = await safeExec(`${adbTarget} shell settings put system screen_brightness_mode ${body.enabled ? '1' : '0'}`);
      return NextResponse.json({ success: r.ok, message: r.ok ? `Auto-brillo: ${body.enabled ? 'ON' : 'OFF'}` : r.err });
    }

    if (action === 'set_stay_awake') {
      // 0=off, 3=USB, 7=USB+AC
      const r = await safeExec(`${adbTarget} shell settings put global stay_on_while_plugged_in ${body.enabled ? '7' : '0'}`);
      return NextResponse.json({ success: r.ok, message: r.ok ? `Stay awake: ${body.enabled ? 'ON' : 'OFF'}` : r.err });
    }

    if (action === 'set_demo_mode') {
      const r = await safeExec(`${adbTarget} shell settings put global sysui_demo_allowed ${body.enabled ? '1' : '0'}`);
      return NextResponse.json({ success: r.ok, message: r.ok ? 'Demo mode activado (batería 100%, sin notifs)' : r.err });
    }

    if (action === 'set_show_touches') {
      const r = await safeExec(`${adbTarget} shell settings put system show_touches ${body.enabled ? '1' : '0'}`);
      return NextResponse.json({ success: r.ok, message: r.ok ? `Show touches: ${body.enabled ? 'ON' : 'OFF'}` : r.err });
    }

    // ── GPU & Render ─────────────────────────────────────────────────────
    if (action === 'set_gpu_tweak') {
      const gpuKeys: Record<string, string> = { force_gpu: 'hardware.hwui.renderer', disable_overlays: 'hardware.hwui.disable_overlays', force_msaa: 'hardware.hwui.msaa' };
      const settingKey = gpuKeys[body.key];
      if (!settingKey) return NextResponse.json({ success: false, error: 'Clave GPU inválida' });
      let r;
      if (body.reset) {
        r = await safeExec(`${adbTarget} shell settings delete global ${settingKey}`);
      } else {
        r = await safeExec(`${adbTarget} shell settings put global ${settingKey} ${body.value}`);
      }
      return NextResponse.json({ success: r.ok, message: r.ok ? `${body.key}=${body.reset ? 'reset' : body.value}` : r.err });
    }

    if (action === 'get_gpu_status') {
      const info: Record<string, string> = {};
      const r1 = await safeExec(`${adbTarget} shell dumpsys SurfaceFlinger | findstr GLES`);
      info.gles = r1.ok ? (r1.out.trim() || 'desconocido') : 'error';
      return NextResponse.json({ success: true, info });
    }

    // ── Background Process Limit ─────────────────────────────────────────
    if (action === 'set_background_limit') {
      const { limit } = body;
      let r;
      if (limit === 'standard') {
        r = await safeExec(`${adbTarget} shell settings delete global activity_manager_constants`);
      } else {
        r = await safeExec(`${adbTarget} shell settings put global activity_manager_constants max_cached_processes=${limit}`);
      }
      return NextResponse.json({ success: r.ok, message: r.ok ? `Límite: ${limit}` : r.err });
    }

    // ── Audio / Bluetooth Codec ──────────────────────────────────────────
    if (action === 'set_bluetooth_codec') {
      const { codec, sampleRate, bitsPerSample, ldacQuality } = body;
      const codecMap: Record<string, string> = { sbc:'0', aac:'1', aptx:'2', aptx_hd:'3', ldac:'4', lhdc:'5' };
      const codecVal = codecMap[codec];
      const errors: string[] = [];
      if (codecVal) { const r = await safeExec(`${adbTarget} shell settings put global bluetooth_a2dp_codec_selection ${codecVal}`); if (!r.ok) errors.push(`codec:${r.err}`); }
      if (sampleRate) { const r = await safeExec(`${adbTarget} shell settings put global bluetooth_a2dp_sample_rate_selection ${sampleRate}`); if (!r.ok) errors.push(`rate:${r.err}`); }
      if (bitsPerSample) { const r = await safeExec(`${adbTarget} shell settings put global bluetooth_a2dp_bits_per_sample_selection ${bitsPerSample}`); if (!r.ok) errors.push(`bits:${r.err}`); }
      if (codec === 'ldac' && ldacQuality) { const r = await safeExec(`${adbTarget} shell settings put global bluetooth_a2dp_ldac_playback_quality ${ldacQuality}`); if (!r.ok) errors.push(`ldac:${r.err}`); }
      return NextResponse.json({ success: errors.length === 0, message: errors.length ? errors.join('; ') : `Codec: ${(codec||'').toUpperCase()}` });
    }

    if (action === 'get_bluetooth_codec') {
      const info: Record<string, string> = {};
      for (const k of ['bluetooth_a2dp_codec_selection','bluetooth_a2dp_sample_rate_selection','bluetooth_a2dp_bits_per_sample_selection','bluetooth_a2dp_ldac_playback_quality','bluetooth_disable_absolute_volume']) {
        const r = await safeExec(`${adbTarget} shell settings get global ${k}`);
        info[k] = r.ok ? (r.out.trim() || 'default') : 'error';
      }
      return NextResponse.json({ success: true, info });
    }

    if (action === 'set_bluetooth_absolute_volume') {
      const r = await safeExec(`${adbTarget} shell settings put global bluetooth_disable_absolute_volume ${body.disable}`);
      return NextResponse.json({ success: r.ok, message: r.ok ? `Vol.absoluto: ${body.disable==='1'?'OFF':'ON'}` : r.err });
    }

    // ── WiFi / Red ────────────────────────────────────────────────────────
    if (action === 'set_wifi_scan_interval') {
      const { interval } = body;
      const r1 = await safeExec(`${adbTarget} shell settings put global wifi_scan_throttle_enabled ${interval===0?'0':'1'}`);
      if (interval > 0 && r1.ok) { await safeExec(`${adbTarget} shell settings put global wifi_scan_interval_ms ${interval}`); }
      return NextResponse.json({ success: r1.ok, message: r1.ok ? `Scan: ${interval}ms` : r1.err });
    }

    if (action === 'set_wifi_power_save') {
      const r = await safeExec(`${adbTarget} shell settings put global wifi_power_save ${body.enabled?'1':'0'}`);
      return NextResponse.json({ success: r.ok, message: r.ok ? `WiFi PS: ${body.enabled?'ON':'OFF'}` : r.err });
    }

    if (action === 'set_private_dns') {
      const { mode, hostname } = body;
      let r = await safeExec(`${adbTarget} shell settings put global private_dns_mode ${mode}`);
      if (r.ok && mode === 'hostname' && hostname) { r = await safeExec(`${adbTarget} shell settings put global private_dns_specifier ${hostname}`); }
      return NextResponse.json({ success: r.ok, message: r.ok ? `DNS: ${mode}` : r.err });
    }

    // ── Notification Shade / iOS Style ────────────────────────────────────
    if (action === 'set_shade_style') {
      const { highContrast, reduceBlur, boldText, solidTheme, animationsFast } = body;
      const errors: string[] = [];

      // Alto Contraste — texto más legible sobre fondos borrosos
      if (highContrast !== undefined) {
        const r = await safeExec(`${adbTarget} shell settings put secure high_text_contrast_enabled ${highContrast ? '1' : '0'}`);
        if (!r.ok) errors.push(`contraste:${r.err}`);
      }

      // Reducir transparencia/blur — animaciones más rápidas = menos blur visible
      if (reduceBlur !== undefined) {
        // Intentar desactivar blur del sistema (funciona en varios fabricantes)
        const rBlur = await safeExec(`${adbTarget} shell settings put global disable_blur ${reduceBlur ? '1' : '0'}`);
        // También intentar setting específico de OPPO/ColorOS
        const rOppo = await safeExec(`${adbTarget} shell settings put system oplus_disable_blur_effect ${reduceBlur ? '1' : '0'}`);
        if (!rBlur.ok && !rOppo.ok) {
          errors.push(`desenfoque:${rBlur.err || rOppo.err}`);
        }
      }

      // Animaciones rápidas — reduce tiempo de blur visible al bajar notificaciones
      if (animationsFast !== undefined) {
        const scale = animationsFast ? '0.5' : '1.0';
        for (const k of ['window_animation_scale', 'transition_animation_scale', 'animator_duration_scale']) {
          const r = await safeExec(`${adbTarget} shell settings put global ${k} ${scale}`);
          if (!r.ok) errors.push(`${k}:${r.err}`);
        }
      }

      // Texto negrita/legible — escala de fuente ligeramente mayor
      if (boldText) {
        const r = await safeExec(`${adbTarget} shell settings put system font_scale 1.1`);
        if (!r.ok) errors.push(`font:${r.err}`);
      } else if (boldText === false) {
        const r = await safeExec(`${adbTarget} shell settings put system font_scale 1.0`);
        if (!r.ok) errors.push(`font:${r.err}`);
      }

      // Tema sólido oscuro — fuerza modo noche para menos transparencia
      if (solidTheme) {
        const r = await safeExec(`${adbTarget} shell settings put secure ui_night_mode 2`);
        if (!r.ok) errors.push(`night:${r.err}`);
      }

      return NextResponse.json({
        success: errors.length === 0,
        message: errors.length ? errors.join('; ') : 'Estilo iOS aplicado — panel de notificaciones optimizado'
      });
    }

    // ── Leer TODOS los ajustes del optimizador en una sola llamada ADB ───
    if (action === 'get_optimizer_settings') {
      const cmds = [
        'settings get global window_animation_scale',
        'settings get global transition_animation_scale',
        'settings get global animator_duration_scale',
        'wm density',
        'settings get global hardware.hwui.renderer',
        'settings get global hardware.hwui.disable_overlays',
        'settings get global hardware.hwui.msaa',
        'settings get global activity_manager_constants',
        'settings get system screen_off_timeout',
        'settings get system peak_refresh_rate',
        'settings get secure ui_night_mode',
        'settings get system screen_brightness_mode',
        'settings get global stay_on_while_plugged_in',
        'settings get global sysui_demo_allowed',
        'settings get system show_touches',
        'settings get global wifi_scan_throttle_enabled',
        'settings get global wifi_scan_interval_ms',
        'settings get global wifi_power_save',
        'settings get global private_dns_mode',
        'settings get global private_dns_specifier',
        'settings get global bluetooth_a2dp_codec_selection',
        'settings get global bluetooth_a2dp_sample_rate_selection',
        'settings get global bluetooth_a2dp_bits_per_sample_selection',
        'settings get global bluetooth_a2dp_ldac_playback_quality',
        'settings get global bluetooth_disable_absolute_volume',
        'settings get secure high_text_contrast_enabled',
        'settings get system font_scale',
      ].join('; echo __SEP__; ');

      const r = await safeExec(`${adbTarget} shell "${cmds}"`, 20000);
      if (!r.ok) return NextResponse.json({ success: false, error: r.err });

      const parts = r.out.split('__SEP__').map((s: string) => s.replace(/\r?\n/g, ' ').trim());
      const [
        windowAnim, transitionAnim, animatorAnim,
        densityRaw, gpuRenderer, gpuOverlays, gpuMsaa,
        bgLimit, screenTimeoutRaw, peakRefreshRaw,
        nightModeRaw, autoBrightnessRaw, stayAwakeRaw, demoModeRaw, showTouchesRaw,
        wifiScanThrottleRaw, wifiScanIntervalRaw, wifiPowerSaveRaw,
        privateDnsModeRaw, privateDnsSpecifierRaw,
        btCodecRaw, btSampleRateRaw, btBitsPerSampleRaw, btLdacQualityRaw, btAbsoluteVolumeRaw,
        highContrastRaw, fontScaleRaw,
      ] = parts;

      // Parsear DPI (preferir override si existe)
      const densityStr = densityRaw || '';
      const dpiMatch = densityStr.match(/Override density:\s*(\d+)/) || densityStr.match(/Physical density:\s*(\d+)/);
      const dpi = dpiMatch ? parseInt(dpiMatch[1]) : 420;

      // Parsear límite de background
      let bgLimitVal = 'standard';
      if (bgLimit && bgLimit.trim() !== 'null') {
        const maxCached = bgLimit.match(/max_cached_processes[^0-9]*(\d+)/);
        if (maxCached) bgLimitVal = maxCached[1];
      }

      // Parsear WiFi scan interval
      const wifiThrottle = (wifiScanThrottleRaw || '').trim();
      const wifiInterval = wifiThrottle === '0'
        ? 0
        : (parseInt((wifiScanIntervalRaw || '').trim()) || 15000);

      return NextResponse.json({
        success: true,
        settings: {
          animScales: {
            window_animation_scale: (windowAnim || '1.0').trim(),
            transition_animation_scale: (transitionAnim || '1.0').trim(),
            animator_duration_scale: (animatorAnim || '1.0').trim(),
          },
          dpi,
          gpuTweaks: {
            force_gpu: (gpuRenderer || '').trim() === 'skiavk',
            disable_overlays: (gpuOverlays || '').trim() === 'true',
            force_msaa: (gpuMsaa || '').trim() === '4',
          },
          backgroundLimit: bgLimitVal,
          screenTimeout: (screenTimeoutRaw || '1800000').trim(),
          peakRefreshRate: (peakRefreshRaw || '60').trim(),
          nightMode: (nightModeRaw || '2').trim(),
          autoBrightness: (autoBrightnessRaw || '').trim() === '1',
          stayAwake: ['3','7'].includes((stayAwakeRaw || '').trim()),
          demoMode: (demoModeRaw || '').trim() === '1',
          showTouches: (showTouchesRaw || '').trim() === '1',
          wifiScanInterval: wifiInterval,
          wifiPowerSave: (wifiPowerSaveRaw || '').trim() === '1',
          privateDnsMode: (privateDnsModeRaw || 'automatic').trim(),
          privateDnsSpecifier: (privateDnsSpecifierRaw || '').trim(),
          bluetooth: {
            codec: (btCodecRaw || 'null').trim(),
            sampleRate: (btSampleRateRaw || 'null').trim(),
            bitsPerSample: (btBitsPerSampleRaw || 'null').trim(),
            ldacQuality: (btLdacQualityRaw || 'null').trim(),
            disableAbsoluteVolume: (btAbsoluteVolumeRaw || '').trim() === '1',
          },
          shade: {
            highContrast: (highContrastRaw || '').trim() === '1',
            fontScale: (fontScaleRaw || '1.0').trim(),
          },
        },
      });
    }

    // ── Trimming / Storage ───────────────────────────────────────────────
    if (action === 'run_trim') {
      const r = await safeExec(`${adbTarget} shell cmd package trim-caches 999999999`, 30000);
      return NextResponse.json({ success: r.ok, message: r.ok ? 'Caché limpiada' : r.err });
    }

    // ── Diagnóstico Completo del Sistema ──────────────────────────────────
    if (action === 'get_diagnostics') {
      const diag: Record<string, string | string[] | Record<string, string>> = {};
      try {
        const { stdout } = await execAsync(`${adbTarget} shell dumpsys battery`);
        for (const line of stdout.split('\n')) {
          const m = line.match(/^\s*(\w[\w\s]*?):\s*(.+)/);
          if (m) diag['battery_' + m[1].trim().replace(/\s+/g, '_').toLowerCase()] = m[2].trim();
        }
      } catch {}
      try {
        const { stdout } = await execAsync(`${adbTarget} shell cat /proc/cpuinfo`);
        const cpu: Record<string, string> = {};
        cpu.raw = stdout.slice(0, 500);
        const hw = stdout.match(/Hardware\s*:\s*(.+)/);
        if (hw) cpu.hardware = hw[1].trim();
        const proc = stdout.match(/Processor\s*:\s*(.+)/);
        if (proc) cpu.processor = proc[1].trim();
        const cores = stdout.match(/processor\s*:\s*\d+/g);
        if (cores) cpu.cores = cores.length.toString();
        diag.cpu = cpu;
      } catch {}
      try {
        const { stdout } = await execAsync(`${adbTarget} shell cat /proc/meminfo`);
        const ram: Record<string, string> = {};
        for (const line of stdout.split('\n')) {
          const m = line.match(/^(\w+):\s+(\d+)\s*kB/);
          if (m) ram[m[1].toLowerCase()] = (parseInt(m[2]) / 1024).toFixed(0) + ' MB';
        }
        diag.ram = ram;
      } catch {}
      try {
        const { stdout } = await execAsync(`${adbTarget} shell df -h /data`);
        const lines = stdout.split('\n');
        if (lines.length >= 2) {
          const parts = lines[1].trim().split(/\s+/);
          diag.storage = { size: parts[1], used: parts[2], free: parts[3], usage: parts[4] };
        }
      } catch {}
      try {
        const { stdout } = await execAsync(`${adbTarget} shell dumpsys thermalservice | findstr "temperature"`);
        const temps: string[] = [];
        for (const line of stdout.split('\n')) {
          const m = line.match(/(\S+).*?(\d+\.?\d*)\s*°?C/);
          if (m) temps.push(`${m[1]}: ${m[2]}°C`);
        }
        diag.thermal = temps.slice(0, 10);
      } catch {}
      try {
        const { stdout: wm } = await execAsync(`${adbTarget} shell wm size`);
        diag.display_resolution = wm.trim();
        const { stdout: dpi } = await execAsync(`${adbTarget} shell wm density`);
        diag.display_dpi = dpi.trim();
      } catch {}
      try {
        const { stdout } = await execAsync(`${adbTarget} shell cat /proc/uptime`);
        const secs = parseFloat(stdout.split(' ')[0]);
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        diag.uptime = `${h}h ${m}m`;
      } catch {}
      try {
        const { stdout: arch } = await execAsync(`${adbTarget} shell getprop ro.product.cpu.abi`);
        diag.arch = arch.trim();
        const { stdout: sdk } = await execAsync(`${adbTarget} shell getprop ro.build.version.sdk`);
        diag.sdk = sdk.trim();
        const { stdout: kernel } = await execAsync(`${adbTarget} shell uname -r`);
        diag.kernel = kernel.trim();
      } catch {}
      return NextResponse.json({ success: true, diagnostics: diag });
    }

    // ── Fastboot Commands ──
    if (action === 'fastboot_reboot') {
      await safeExec(`${fastbootTarget} reboot`);
      return NextResponse.json({ success: true, message: 'Reiniciando desde Fastboot...' });
    }

    if (action === 'fastboot_reboot_recovery') {
      await safeExec(`${fastbootTarget} reboot recovery`);
      return NextResponse.json({ success: true, message: 'Saltando a Recovery desde Fastboot...' });
    }

    if (action === 'fastboot_erase') {
      await safeExec(`${fastbootTarget} -w`);
      await safeExec(`${fastbootTarget} erase metadata`);
      return NextResponse.json({ success: true, message: 'Factory Reset completo. El dispositivo se reiniciará.' });
    }

    if (action === 'screenshot') {
      if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const devicePath = `/sdcard/screenshot_${timestamp}.png`;
      const localPath = path.join(SCREENSHOTS_DIR, `screenshot_${timestamp}.png`);

      await safeExec(`${adbTarget} shell screencap -p "${devicePath}"`);
      await safeExec(`${adbTarget} pull "${devicePath}" "${localPath}"`);
      await safeExec(`${adbTarget} shell rm "${devicePath}"`);

      exec(`explorer "${SCREENSHOTS_DIR}"`);
      return NextResponse.json({ success: true, message: `Captura guardada en Capturas\\` });
    }

    if (action === 'start_record') {
      const recordLockFile = getRecordLockFile(targetSerial || 'default');

      if (fs.existsSync(recordLockFile)) {
        let stillRunning = false;
        try {
          const raw = fs.readFileSync(recordLockFile, 'utf8').trim();
          const pid = raw.startsWith('{') ? JSON.parse(raw).pid : parseInt(raw, 10);
          if (pid) {
            await execAsync(`tasklist /FI "PID eq ${pid}" /NH`).then(() => { stillRunning = true; }).catch(() => {});
          }
        } catch { }
        if (stillRunning) {
          return NextResponse.json({ success: false, error: 'Ya hay una grabación en curso para este dispositivo' });
        }
        try { fs.unlinkSync(recordLockFile); } catch {}
      }

      if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const recordPath = path.join(SCREENSHOTS_DIR, `grabacion_${timestamp}.mp4`);

      const recordArgs: string[] = [];
      if (targetSerial) recordArgs.push('-s', String(targetSerial));
      recordArgs.push(
        '--video-codec',   'h265',
        '-b',              '128M',
        '--max-fps',       '60',
        '--max-size',      '0',
        '--audio-codec',   'opus',
        '--audio-bit-rate', '192k',
        '--audio-buffer',  '4',
        '--no-window',
        '--record', recordPath
      );
      if (videoSource === 'camera') {
        recordArgs.push('--video-source', 'camera');
        recordArgs.push('--no-audio');
      }

      const proc = spawn(ANDROPROJECT_BIN, recordArgs, {
        cwd: ANDROPROJECT_HOME,
        env: {
          ...process.env,
          ADB: ADB,
          SCRCPY_SERVER_PATH: SCRCPY_SERVER_PATH,
          SCRCPY_ICON_PATH: SCRCPY_ICON_PATH,
        },
        windowsHide: true,
      });

      if (proc.pid) {
        fs.writeFileSync(recordLockFile, JSON.stringify({ pid: proc.pid, path: recordPath }));
        proc.on('exit', () => {
          try { if (fs.existsSync(recordLockFile)) fs.unlinkSync(recordLockFile); } catch {}
        });
        proc.on('error', () => {
          try { if (fs.existsSync(recordLockFile)) fs.unlinkSync(recordLockFile); } catch {}
        });
      }
      return NextResponse.json({ success: true, message: 'Grabación silenciosa iniciada', recordPath, startedAt: Date.now() });
    }

    if (action === 'stop_record') {
      const recordLockFile = getRecordLockFile(targetSerial || 'default');
      let recordedPath: string | null = null;

      if (fs.existsSync(recordLockFile)) {
        try {
          const raw = fs.readFileSync(recordLockFile, 'utf8').trim();
          let pid: number | null = null;
          if (raw.startsWith('{')) {
            const lockData = JSON.parse(raw);
            pid = lockData.pid;
            recordedPath = lockData.path || null;
          } else {
            pid = parseInt(raw, 10);
          }
          if (pid) {
            await execAsync(`taskkill /PID ${pid}`).catch(() => {});
          }
          fs.unlinkSync(recordLockFile);
        } catch {}
      }

      setTimeout(() => exec(`explorer "${SCREENSHOTS_DIR}"`), 1000);
      return NextResponse.json({
        success: true,
        message: recordedPath ? `Grabación guardada: ${path.basename(recordedPath)}` : 'Grabación detenida',
        recordPath: recordedPath
      });
    }

    return NextResponse.json({ success: false, error: 'Acción no reconocida' }, { status: 400 });

  } catch (error: unknown) {
    console.error('[Actions API] Error:', getErrorMessage(error));
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
