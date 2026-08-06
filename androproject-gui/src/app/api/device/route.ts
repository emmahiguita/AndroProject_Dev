export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ADB } from '@/lib/config';

const execAsync = promisify(exec);

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedSerial = searchParams.get('serial');

    // 1. Get all connected devices
    const { stdout: devicesOut } = await execAsync(`"${ADB}" devices -l`, { timeout: 3000 });
    const lines = devicesOut.trim().split('\n').slice(1);

    const devicesList: Array<{ serial: string; model: string; connectionType: string; state: string }> = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const serial = parts[0];
        const state = parts[1]; // 'device', 'offline', 'unauthorized', etc.

        if (['device', 'offline', 'unauthorized', 'recovery', 'sideload'].includes(state)) {
          let model = 'Dispositivo';
          const modelMatch = line.match(/model:(\S+)/);
          if (modelMatch) {
            model = modelMatch[1].replace(/_/g, ' ');
          } else {
            model = `Dispositivo (${state})`;
          }
          const isWifi = !!serial.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+\b/);
          const connectionType = isWifi ? 'Wi-Fi' : 'USB';
          devicesList.push({ serial, model, connectionType, state });
        }
      }
    }

    // CORREGIDO: Deduplicar si el mismo modelo está conectado por USB y Wi-Fi (preferir Wi-Fi)
    const uniqueDevices = new Map<string, (typeof devicesList)[number]>();
    for (const device of devicesList) {
      const existing = uniqueDevices.get(device.model);
      if (!existing || (device.connectionType === 'Wi-Fi' && existing.connectionType !== 'Wi-Fi')) {
        uniqueDevices.set(device.model, device);
      }
    }
    // La selección explícita tiene prioridad sobre la preferencia automática USB/Wi-Fi.
    const requestedDevice = requestedSerial
      ? devicesList.find(device => device.serial === requestedSerial)
      : undefined;
    if (requestedDevice) uniqueDevices.set(requestedDevice.model, requestedDevice);

    const finalDevicesList = Array.from(uniqueDevices.values());

    finalDevicesList.sort((a, b) => {
      if (a.connectionType === 'Wi-Fi' && b.connectionType !== 'Wi-Fi') return -1;
      if (b.connectionType === 'Wi-Fi' && a.connectionType !== 'Wi-Fi') return 1;
      return 0;
    });

    if (finalDevicesList.length === 0) {
      // Hardware fallback: Check if device is in bootloader/fastboot or offline charging via raw USB
      const psScript = `Get-PnpDevice -PresentOnly | Where-Object FriendlyName -match 'Android|Fastboot|SAMSUNG Mobile|ADB' | Where-Object Class -match 'USB|Modem|AndroidUsbDeviceClass' | Select-Object -ExpandProperty FriendlyName -First 1`;
      try {
        const { stdout } = await execAsync(`powershell -NoProfile -Command "${psScript}"`, { timeout: 4000 });
        const hwName = stdout.trim();
        if (hwName) {
          const cleanName = hwName.replace(/Mobile|USB|CDC|Composite|Device|Modem|#\\d+/ig, '').trim() || 'Dispositivo Hardware';
          const fallbackDev = {
            connected: true,
            connectionType: 'USB (Bootloader / Cargando)',
            model: cleanName,
            androidVersion: 'Modo Offline Especial',
            serial: 'Hardware Level',
            ram: '--',
            storage: '--',
            battery: 0,
            isCharging: true,
            temperature: '--',
            state: 'offline',
            oemUnlockAllowed: false,
            bootloaderLocked: true,
            verifiedBootState: 'unknown',
            vbmetaState: 'unknown'
          };
          return NextResponse.json({
            connected: true,
            devices: [{ serial: 'Hardware Level', model: cleanName, connectionType: 'USB', state: 'offline' }],
            activeDevice: fallbackDev
          }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
        }
      } catch {}

      return NextResponse.json({ connected: false, devices: [], activeDevice: null }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }

    // Determine target device
    let targetDevice = finalDevicesList[0];
    let serialChanged = false;
    if (requestedSerial && requestedSerial !== 'Hardware Level') {
      const found = finalDevicesList.find(d => d.serial === requestedSerial);
      if (found) {
        targetDevice = found;
      } else if (finalDevicesList.length > 0) {
        serialChanged = true;
      }
    }

    // If target device is not online ('device'), return a fallback info immediately
    if (targetDevice.state !== 'device') {
      let friendlyModel = targetDevice.model;
      if (targetDevice.state === 'unauthorized') {
        friendlyModel = `${targetDevice.model} (No Autorizado)`;
      } else if (targetDevice.state === 'offline') {
        friendlyModel = `${targetDevice.model} (Offline)`;
      }

      return NextResponse.json({
        connected: true,
        devices: finalDevicesList,
        serialChanged,
        activeDevice: {
          connected: true,
          connectionType: targetDevice.connectionType,
          model: friendlyModel,
          androidVersion: 'Requiere Autorización',
          serial: targetDevice.serial,
          ram: '--',
          storage: '--',
          battery: 0,
          isCharging: false,
          temperature: '--',
          state: targetDevice.state,
          oemUnlockAllowed: false,
          bootloaderLocked: true,
          verifiedBootState: 'unknown',
          vbmetaState: 'unknown'
        }
      }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }

    const adbTarget = `"${ADB}" -s ${targetDevice.serial}`;

    // 2. Fetch all properties needed
    const { stdout: getpropOut } = await execAsync(`${adbTarget} shell getprop`, { timeout: 3000 });

    const props: Record<string, string> = {};
    const propLines = getpropOut.split('\n');
    for (const line of propLines) {
      const match = line.match(/^\[(.*?)\]: \[(.*?)\]/);
      if (match) {
        props[match[1]] = match[2];
      }
    }

    // 3. Fetch battery and temperature
    const { stdout: batteryOut } = await execAsync(`${adbTarget} shell dumpsys battery`, { timeout: 2000 });
    let batteryLevel = 0;
    let tempRaw = 0;
    let isCharging = false;

    batteryOut.split('\n').forEach(line => {
      if (line.includes('level:')) batteryLevel = parseInt(line.split(':')[1].trim());
      if (line.includes('temperature:')) tempRaw = parseInt(line.split(':')[1].trim());
      if (line.includes('status:')) {
        const statusStr = line.split(':')[1].trim();
        if (statusStr === '2' || statusStr === '5') isCharging = true;
      }
    });

    const temperature = (tempRaw / 10).toFixed(1);

    // 4. Fetch RAM (requires parsing /proc/meminfo)
    const { stdout: memOut } = await execAsync(`${adbTarget} shell cat /proc/meminfo`, { timeout: 2000 });
    let totalMemKB = 0;
    memOut.split('\n').forEach(line => {
      if (line.startsWith('MemTotal:')) {
        totalMemKB = parseInt(line.replace(/[^0-9]/g, ''));
      }
    });
    const ramGB = Math.round(totalMemKB / 1024 / 1024);

    // 5. Fetch Storage Capacity
    let storageCap = 'Desconocido';
    try {
      const { stdout: dfOut } = await execAsync(`${adbTarget} shell df -h /data`, { timeout: 2000 });
      const dfLines = dfOut.trim().split('\n');
      if (dfLines.length > 1) {
        const columns = dfLines[1].trim().split(/\s+/);
        if (columns.length >= 2) {
          const rawSize = parseFloat(columns[1].replace(/[^0-9.]/g, ''));
          // Round to nearest standard storage capacity (32, 64, 128, 256, 512, 1024)
          const standards = [8, 16, 32, 64, 128, 256, 512, 1024];
          let bestFit = standards[0];
          for (const s of standards) {
            if (rawSize <= s * 0.98) {
              bestFit = s;
              break;
            }
          }
          if (rawSize > 1000) bestFit = Math.ceil(rawSize); // Fallback
          storageCap = `${bestFit} GB`;
        }
      }
    } catch {
      storageCap = '128 GB';
    }

    // 6. Fetch Screen Resolution
    let resolution = 'Desconocida';
    try {
      const { stdout: sizeOut } = await execAsync(`${adbTarget} shell wm size`, { timeout: 2000 });
      const sizeMatch = sizeOut.match(/Physical size:\s*(\d+x\d+)/);
      if (sizeMatch) {
        resolution = sizeMatch[1].replace('x', ' × ');
      }
    } catch {}

    // Replace the quick model with the one fetched from getprop if available
    const rawModel = props['ro.product.model'] || targetDevice.model;
    const marketName = props['ro.product.marketname'] ||
                       props['ro.vendor.oplus.market.name'] ||
                       props['bluetooth.device.default_name'] ||
                       rawModel;
    const preciseModel = (marketName !== rawModel && rawModel !== 'Dispositivo') ? `${marketName} (${rawModel})` : marketName;

    return NextResponse.json({
      connected: true,
      devices: finalDevicesList,
      serialChanged,
      activeDevice: {
        connected: true,
        connectionType: targetDevice.connectionType,
        model: preciseModel,
        androidVersion: props['ro.build.version.release'] || 'Unknown',
        serial: targetDevice.serial,
        resolution,
        ram: `${ramGB} GB`,
        storage: storageCap,
        battery: batteryLevel,
        isCharging,
        temperature,
        state: 'device',
        oemUnlockAllowed: props['sys.oem_unlock_allowed'] === '1',
        bootloaderLocked: props['ro.boot.flash.locked'] !== '0',
        verifiedBootState: props['ro.boot.verifiedbootstate'] || 'unknown',
        vbmetaState: props['ro.boot.vbmeta.device_state'] || 'unknown'
      }
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });

  } catch (error: unknown) {
    console.error("ADB Error:", error);
    return NextResponse.json({ connected: false, devices: [], activeDevice: null, error: getErrorMessage(error) }, { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
