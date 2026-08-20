import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ADB } from '@/lib/config';

const execAsync = promisify(exec);

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

// Dictionary of known bloatware package prefixes and exact names
const BLOATWARE_PACKAGES = new Set([
  // Google
  'com.google.android.apps.tachyon', // Duo / Meet
  'com.google.android.music', // Play Music
  'com.google.android.videos', // Play Movies
  'com.google.android.apps.youtube.music',
  'com.google.android.feedback',
  'com.google.android.googlequicksearchbox', // Google Assistant App
  'com.google.android.apps.wellbeing', // Digital Wellbeing
  // Samsung
  'com.samsung.android.bixby.agent',
  'com.samsung.android.bixby.es.globalaction',
  'com.samsung.android.bixby.wakeup',
  'com.samsung.android.app.spage',
  'com.samsung.android.game.gamehome',
  'com.samsung.android.game.gametools',
  'com.sec.android.app.sbrowser',
  'com.samsung.android.email.provider',
  'com.samsung.android.kidsinstaller',
  'com.samsung.android.app.watchmanagerstub',
  'com.sec.android.easyMover.Agent',
  // Xiaomi
  'com.miui.analytics',
  'com.miui.msa.global',
  'com.xiaomi.mipicks', // GetApps
  'com.miui.hybrid', // Quick Apps
  'com.miui.bugreport',
  'com.miui.yellowpage',
  'com.xiaomi.glance.app',
  'com.xiaomi.midrop', // ShareMe
  'com.miui.videoplayer',
  'com.mi.android.globalminusscreen',
  // Oppo / Realme / OnePlus
  'com.heytap.browser',
  'com.heytap.mcs',
  'com.heytap.cloud',
  'com.heytap.market',
  'com.heytap.pictorial',
  'com.oplus.member',
  'com.oplus.pay',
  'com.coloros.note',
  'com.oplus.appdetail',
  'com.oplus.games',
  'com.nearme.atlas',
  'com.coloros.phonemanager',
  'com.oplus.olc',
  'com.oplus.sau',
  // Huawei / Honor
  'com.huawei.android.hsad',
  'com.huawei.appmarket',
  'com.huawei.hms',
  'com.huawei.browser',
  'com.huawei.music',
  'com.huawei.video',
  // Preloads / Stubs / Social
  'com.facebook.katana',
  'com.facebook.system',
  'com.facebook.appmanager',
  'com.facebook.services',
  'com.netflix.mediaclient',
  'com.netflix.partner.activation',
  'com.amazon.mShop.android.shopping',
  'com.spotify.music',
  'com.ebay.mobile',
  'com.zhiliaoapp.musically', // TikTok
  'com.bytecreative.promoresources'
]);

function isBloatwarePackage(pkg: string, isSystem: boolean): boolean {
  if (!isSystem) return false;
  if (BLOATWARE_PACKAGES.has(pkg)) return true;
  
  const bloatPrefixes = [
    'com.heytap.',
    'com.miui.',
    'com.xiaomi.',
    'com.oplus.',
    'com.coloros.',
    'com.facebook.',
    'com.samsung.android.bixby',
    'com.huawei.android.hsad',
    'com.huawei.appmarket',
    'com.carrier.'
  ];
  return bloatPrefixes.some(prefix => pkg.startsWith(prefix));
}

function getMalwareClassification(pkg: string): { isMalware: boolean; threatName: string; severity: 'low' | 'medium' | 'high' | 'critical' } | null {
  const cleanPkg = pkg.toLowerCase();
  
  // 1. Critical Threats (Trojans, RATs, Ransomware, Botnets)
  const criticalKeywords = [
    { key: 'anubis', name: 'Troyano Bancario Anubis' },
    { key: 'cerberus', name: 'Troyano Bancario Cerberus' },
    { key: 'teabot', name: 'Troyano Bancario TeaBot' },
    { key: 'flubot', name: 'Troyano Bancario FluBot' },
    { key: 'sharkbot', name: 'Troyano Bancario SharkBot' },
    { key: 'xenomorph', name: 'Troyano Bancario Xenomorph' },
    { key: 'lockerpin', name: 'Ransomware LockerPin' },
    { key: 'doublelocker', name: 'Ransomware DoubleLocker' },
    { key: 'svpeng', name: 'Ransomware Svpeng' },
    { key: 'chamois', name: 'Botnet Chamois' },
    { key: 'triada', name: 'Botnet Triada' },
    { key: 'moqhao', name: 'Botnet MoqHao' },
    { key: 'ahmyth', name: 'RAT de Acceso Remoto AhMyth' },
    { key: 'androrat', name: 'RAT de Acceso Remoto AndroRAT' },
    { key: 'spynote', name: 'RAT de Acceso Remoto SpyNote' }
  ];
  
  for (const item of criticalKeywords) {
    if (cleanPkg.includes(item.key)) {
      return { isMalware: true, threatName: item.name, severity: 'critical' };
    }
  }
  
  // 2. High Threats (Spyware / Espionaje)
  const highKeywords = [
    { key: 'pegasus', name: 'Spyware Pegasus (Gubernamental)' },
    { key: 'hermit', name: 'Spyware Hermit' },
    { key: 'predator', name: 'Spyware Predator' },
    { key: 'phonespy', name: 'Spyware PhoneSpy' }
  ];
  
  for (const item of highKeywords) {
    if (cleanPkg.includes(item.key)) {
      return { isMalware: true, threatName: item.name, severity: 'high' };
    }
  }

  // 3. Medium Threats (Adware Famoso)
  const mediumKeywords = [
    { key: 'hiddenads', name: 'Adware HiddenAds' },
    { key: 'fakeadblocker', name: 'Adware FakeAdBlocker' },
    { key: 'agentsmith', name: 'Adware Agent Smith' },
    { key: 'mobidash', name: 'Adware MobiDash' },
    { key: 'ewind', name: 'Adware Ewind' }
  ];
  
  for (const item of mediumKeywords) {
    if (cleanPkg.includes(item.key)) {
      return { isMalware: true, threatName: item.name, severity: 'medium' };
    }
  }

  return null;
}

const APP_NAME_DICT: Record<string, string> = {
  'com.android.chrome': 'Google Chrome',
  'com.google.android.youtube': 'YouTube',
  'com.whatsapp': 'WhatsApp',
  'com.instagram.android': 'Instagram',
  'com.facebook.orca': 'Messenger',
  'com.facebook.katana': 'Facebook',
  'com.facebook.lite': 'Facebook Lite',
  'com.spotify.music': 'Spotify',
  'com.netflix.mediaclient': 'Netflix',
  'com.android.vending': 'Google Play Store',
  'com.google.android.apps.docs': 'Google Drive',
  'com.google.android.apps.docs.editors.sheets': 'Google Sheets',
  'com.google.android.apps.docs.editors.slides': 'Google Slides',
  'com.google.android.apps.docs.editors.docs': 'Google Docs',
  'com.google.android.apps.maps': 'Google Maps',
  'com.google.android.gm': 'Gmail',
  'com.google.android.apps.photos': 'Google Photos',
  'com.google.android.googlequicksearchbox': 'Google App',
  'com.google.android.apps.messaging': 'Mensajes de Google',
  'com.google.android.contacts': 'Contactos de Google',
  'com.google.android.calendar': 'Google Calendar',
  'com.google.android.apps.walletnfcrel': 'Google Wallet',
  'com.google.android.apps.healthdata': 'Health Connect',
  'com.google.android.apps.tachyon': 'Google Meet',
  'com.google.android.apps.wellbeing': 'Bienestar Digital',
  'com.microsoft.office.excel': 'Microsoft Excel',
  'com.microsoft.office.word': 'Microsoft Word',
  'com.microsoft.office.powerpoint': 'Microsoft PowerPoint',
  'com.microsoft.bing': 'Microsoft Bing',
  'com.touchtype.swiftkey': 'Teclado SwiftKey',
  'com.coloros.note': 'Notas (OPPO)',
  'com.oplus.member': 'Mi OPPO',
  'com.oplus.games': 'Espacio de Juegos',
  'com.coloros.phonemanager': 'Gestor del Teléfono',
  'com.oplus.account': 'Cuenta OPPO',
  'com.adobe.psmobile': 'Photoshop Express',
  'com.aomei.anyviewer': 'AnyViewer',
  'com.deepseek.chat': 'DeepSeek',
  'easynotes.notes.notepad.notebook.privatenotes.note': 'Easy Notes',
  'com.google.android.apps.authenticator2': 'Google Authenticator',
  'com.nequi.MobileApp': 'Nequi',
  'com.davivienda.daviviendaapp': 'Davivienda',
  'com.bancolombia.appbilletera': 'Bancolombia A la Mano',
  'com.badoo.mobile': 'Badoo',
  'com.jaumo': 'Jaumo',
  'sinet.startup.inDriver': 'inDrive',
  'com.snaptube.premium': 'SnapTube',
  'com.example.hablalopues': 'Háblalo Pues',
  'com.google.android.photopicker': 'Selector de Fotos',
  'com.google.android.apps.healthconnect': 'Health Connect'
};

function deriveAppName(apkPath: string, pkg: string): string {
  if (APP_NAME_DICT[pkg]) {
    return APP_NAME_DICT[pkg];
  }

  const parts = apkPath.split('/');
  const lastPart = parts[parts.length - 1];
  
  if (lastPart && lastPart !== 'base.apk' && lastPart.endsWith('.apk')) {
    return lastPart.replace('.apk', '');
  }
  
  if (parts.length >= 2) {
    const parentDir = parts[parts.length - 2];
    let name = parentDir.split('-')[0]; // Strip hash
    if (name.includes('.')) {
      const nameParts = name.split('.');
      name = nameParts[nameParts.length - 1];
    }
    if (name) {
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }
  
  const pkgParts = pkg.split('.');
  const lastPkgPart = pkgParts[pkgParts.length - 1];
  return lastPkgPart.charAt(0).toUpperCase() + lastPkgPart.slice(1);
}

// ── Safe-to-remove classification ────────────────────────────────
// Apps that are SAFE to uninstall without affecting core functionality
const SAFE_TO_REMOVE_PACKAGES = new Set([
  // Social media bloatware
  'com.facebook.katana', 'com.facebook.orca', 'com.facebook.lite',
  'com.facebook.system', 'com.facebook.appmanager', 'com.facebook.services',
  'com.instagram.android', 'com.zhiliaoapp.musically', // TikTok
  'com.twitter.android', 'com.snapchat.android',
  // Entertainment bloatware
  'com.netflix.mediaclient', 'com.spotify.music', 'com.amazon.mShop.android.shopping',
  'com.ebay.mobile', 'com.shopee.*',
  // Google optional
  'com.google.android.apps.youtube.music',
  'com.google.android.apps.tachyon', // Meet
  'com.google.android.apps.wellbeing', // Digital Wellbeing
  'com.google.android.googlequicksearchbox', // Google App
  // OEM bloatware (OPPO/Realme/OnePlus)
  'com.heytap.browser', 'com.heytap.cloud', 'com.heytap.market',
  'com.heytap.pictorial', 'com.heytap.mcs',
  'com.oplus.member', 'com.oplus.pay', 'com.oplus.games',
  'com.oplus.appdetail', 'com.oplus.sau', 'com.oplus.olc',
  'com.coloros.note', 'com.coloros.phonemanager',
  'com.nearme.atlas', 'com.oplus.quicksearch',
  // Samsung bloatware
  'com.samsung.android.bixby.agent', 'com.samsung.android.bixby.wakeup',
  'com.samsung.android.game.gamehome', 'com.samsung.android.app.spage',
  'com.samsung.android.email.provider',
  // Carrier bloatware
  'com.carrier.*',
]);

// Critical system packages — NEVER suggest removing these
const CRITICAL_SYSTEM_PACKAGES = new Set([
  'android', 'system', 'com.android.providers.*', 'com.android.server.*',
  'com.android.phone', 'com.android.systemui', 'com.android.settings',
  'com.android.bluetooth', 'com.android.nfc', 'com.android.wifi',
  'com.android.shell', 'com.android.packageinstaller',
  'com.google.android.gms', 'com.google.android.gms.persistent',
  'com.google.android.gsf', 'com.google.android.gsf.login',
  'com.android.vending', // Play Store — technically removable but risky
  'com.qualcomm.*', 'com.mediatek.*',
]);

function isCriticalSystem(pkg: string): boolean {
  // Direct match
  if (CRITICAL_SYSTEM_PACKAGES.has(pkg)) return true;
  // Prefix match for wildcard patterns
  for (const pattern of CRITICAL_SYSTEM_PACKAGES) {
    if (pattern.endsWith('*') && pkg.startsWith(pattern.slice(0, -1))) return true;
  }
  return false;
}

function isSafeToRemove(pkg: string, isSystem: boolean): boolean {
  // Never mark critical system packages as safe
  if (isCriticalSystem(pkg)) return false;
  // Direct match
  if (SAFE_TO_REMOVE_PACKAGES.has(pkg)) return true;
  // Prefix match for wildcard patterns
  for (const pattern of SAFE_TO_REMOVE_PACKAGES) {
    if (pattern.endsWith('*') && pkg.startsWith(pattern.slice(0, -1))) return true;
  }
  // Heuristic: OEM-specific packages that aren't critical are usually safe
  if (isSystem && (
    pkg.startsWith('com.heytap.') || pkg.startsWith('com.oplus.') ||
    pkg.startsWith('com.coloros.') || pkg.startsWith('com.nearme.')
  )) return true;
  return false;
}

// ── Handler ──────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, packageName, serial } = body;
    
    // Resolve ADB command target
    const { stdout: devicesOut } = await execAsync(`"${ADB}" devices`);
    const id = devicesOut.split('\n').slice(1).find(l => l.includes('\tdevice'))?.split(/\s+/)[0];
    const targetSerial = serial || id;
    
    if (!targetSerial) {
      return NextResponse.json({ success: false, error: 'Dispositivo no detectado' }, { status: 400 });
    }
    
    const adbTarget = (targetSerial && targetSerial !== 'Hardware Level')
      ? `"${ADB}" -s ${targetSerial}`
      : `"${ADB}"`;

    // Action 1: List all packages with deep classification
    if (action === 'list') {
      const launcherCommand = `cmd package query-activities -c android.intent.category.LAUNCHER -a android.intent.action.MAIN | grep packageName= | cut -d= -f2 | sort -u`;
      const statsCommand = `${adbTarget} shell "pm list packages -f | cut -d: -f2- | sed 's/=[^=]*$//' | xargs stat -c '%s|%Y|%n' 2>/dev/null"`;

      const [allPkgsRes, systemPkgsRes, disabledPkgsRes, launcherPkgsRes, appopsRes, statsRes] = await Promise.all([
        execAsync(`${adbTarget} shell pm list packages -f`, { timeout: 6000 }),
        execAsync(`${adbTarget} shell pm list packages -s`, { timeout: 4000 }).catch(() => ({ stdout: '' })),
        execAsync(`${adbTarget} shell pm list packages -d`, { timeout: 4000 }).catch(() => ({ stdout: '' })),
        execAsync(`${adbTarget} shell "${launcherCommand}"`, { timeout: 5000 }).catch(() => ({ stdout: '' })),
        execAsync(`${adbTarget} shell dumpsys appops`, { timeout: 8000 }).catch(() => ({ stdout: '' })),
        execAsync(statsCommand, { timeout: 10000 }).catch(() => ({ stdout: '' }))
      ]);

      const allPkgsOut = allPkgsRes.stdout;
      const systemPkgsOut = systemPkgsRes.stdout;
      const disabledPkgsOut = disabledPkgsRes.stdout;
      const launcherPkgsOut = launcherPkgsRes.stdout;
      const appopsOut = appopsRes.stdout;
      const statsOut = statsRes.stdout;

      const systemSet = new Set(
        systemPkgsOut.trim().split('\n').map(l => l.replace('package:', '').trim()).filter(Boolean)
      );

      const disabledSet = new Set(
        disabledPkgsOut.trim().split('\n').map(l => l.replace('package:', '').trim()).filter(Boolean)
      );

      const launcherSet = new Set(
        launcherPkgsOut.trim().split('\n').map(l => l.trim()).filter(Boolean)
      );

      const overlaySet = new Set<string>();
      try {
        const appopsLines = appopsOut.split('\n');
        let currentPkg = '';
        for (const line of appopsLines) {
          const pkgMatch = line.match(/^\s*Package\s+(\S+):/);
          if (pkgMatch) {
            currentPkg = pkgMatch[1];
          } else if (line.includes('SYSTEM_ALERT_WINDOW') && (line.includes('allow') || line.includes('default'))) {
            if (currentPkg) {
              overlaySet.add(currentPkg);
            }
          }
        }
      } catch (e) {
        console.error('Error parsing appops for overlay:', e);
      }

      const statsMap = new Map<string, { size: number; date: number }>();
      if (statsOut) {
        const statsLines = statsOut.trim().split('\n');
        for (const line of statsLines) {
          const parts = line.trim().split('|');
          if (parts.length === 3) {
            const size = parseInt(parts[0], 10);
            const date = parseInt(parts[1], 10) * 1000;
            const apkPath = parts[2];
            statsMap.set(apkPath, { size, date });
          }
        }
      }

      // 6. Build the final parsed app list
      const allPkgsLines = allPkgsOut.trim().split('\n');
      const apps = [];

      for (const line of allPkgsLines) {
        if (!line.includes('package:') || !line.includes('=')) continue;
        
        // Format: package:<apkPath>=<packageName>
        const cleanLine = line.replace('package:', '').trim();
        const equalsIdx = cleanLine.lastIndexOf('=');
        if (equalsIdx === -1) continue;
        
        const apkPath = cleanLine.substring(0, equalsIdx);
        const pkg = cleanLine.substring(equalsIdx + 1);
        
        const isSystem = systemSet.has(pkg);
        const isDisabled = disabledSet.has(pkg);
        const isHidden = !launcherSet.has(pkg);
        const hasOverlay = overlaySet.has(pkg);
        const isBloatware = isBloatwarePackage(pkg, isSystem);
        const friendlyName = deriveAppName(apkPath, pkg);
        const stats = statsMap.get(apkPath) || { size: 0, date: 0 };
        const isGoogle = pkg.startsWith('com.google.android.') || 
                         pkg.startsWith('com.google.mainline.') || 
                         pkg === 'com.android.vending';

        const malwareInfo = getMalwareClassification(pkg);
        const isMalware = malwareInfo !== null;
        const threatName = malwareInfo ? malwareInfo.threatName : '';
        const threatSeverity = malwareInfo ? malwareInfo.severity : '';
        const safeToDel = isSafeToRemove(pkg, isSystem);
        const critical = isCriticalSystem(pkg);

        apps.push({
          packageName: pkg,
          name: friendlyName,
          apkPath,
          isSystem,
          isBloatware,
          isHidden,
          hasOverlay,
          isDisabled,
          size: stats.size,
          date: stats.date,
          isGoogle,
          isMalware,
          threatName,
          threatSeverity,
          safeToRemove: safeToDel,
          criticalSystem: critical,
        });
      }

      // Sort apps: User apps first, then alphabetically
      apps.sort((a, b) => {
        if (a.isSystem !== b.isSystem) {
          return a.isSystem ? 1 : -1;
        }
        return a.name.localeCompare(b.name);
      });

      return NextResponse.json({ success: true, apps });
    }

    // Action 2: Uninstall (Debloat if system app)
    if (action === 'uninstall') {
      if (!packageName) throw new Error('Nombre de paquete requerido');
      
      // Check if it is a system app
      const { stdout: pathCheck } = await execAsync(`${adbTarget} shell pm path ${packageName}`).catch(() => ({ stdout: '' }));
      const isSystem = pathCheck.includes('/system/') || 
                       pathCheck.includes('/system_ext/') || 
                       pathCheck.includes('/product/') || 
                       pathCheck.includes('/vendor/') || 
                       pathCheck.includes('/apex/');
                       
      if (isSystem) {
        // Debloat system app for user 0 without requiring root
        await execAsync(`${adbTarget} shell pm uninstall -k --user 0 ${packageName}`);
        return NextResponse.json({ success: true, message: `Aplicación de fábrica ${packageName} desinstalada de forma segura.` });
      } else {
        // Normal uninstall
        await execAsync(`${adbTarget} shell pm uninstall ${packageName}`);
        return NextResponse.json({ success: true, message: `Aplicación ${packageName} desinstalada correctamente.` });
      }
    }

    // Action 3: Disable app
    if (action === 'disable') {
      if (!packageName) throw new Error('Nombre de paquete requerido');
      await execAsync(`${adbTarget} shell pm disable-user --user 0 ${packageName}`);
      return NextResponse.json({ success: true, message: `Aplicación ${packageName} deshabilitada correctamente.` });
    }

    // Action 4: Enable app
    if (action === 'enable') {
      if (!packageName) throw new Error('Nombre de paquete requerido');
      await execAsync(`${adbTarget} shell pm enable ${packageName}`);
      return NextResponse.json({ success: true, message: `Aplicación ${packageName} habilitada y lista para usar.` });
    }

    // Action 5: Force stop app
    if (action === 'force_stop') {
      if (!packageName) throw new Error('Nombre de paquete requerido');
      await execAsync(`${adbTarget} shell am force-stop ${packageName}`);
      return NextResponse.json({ success: true, message: `Proceso de ${packageName} detenido inmediatamente.` });
    }

    // Action 6: Clear app data
    if (action === 'clear_data') {
      if (!packageName) throw new Error('Nombre de paquete requerido');
      await execAsync(`${adbTarget} shell pm clear ${packageName}`);
      return NextResponse.json({ success: true, message: `Datos y caché de ${packageName} purgados.` });
    }

    return NextResponse.json({ success: false, error: 'Acción no reconocida' }, { status: 400 });

  } catch (error: unknown) {
    console.error('[Apps API] Error:', getErrorMessage(error));
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
