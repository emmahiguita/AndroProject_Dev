// ============================================================================
// ARCHIVO: app-catalog.ts
// QUÉ HACE: Diccionarios y clasificadores puros de paquetes Android (nombre
//           amigable, bloatware OEM, firmas de malware/spyware/adware y
//           evaluación heurística de amenazas y apps ocultas).
// CÓMO FUNCIONA: Cruza firmas de troyanos/spyware/adware con señales reales de
//           ADB (app oculta sin icono en launcher, proceso oculto en RAM,
//           lectura de notificaciones, overlay publicitario, Accesibilidad,
//           Device Admin e instalador externo sideload).
// POR QUÉ: Garantizar que ninguna app oculta, adware o spyware pase
//          desapercibida en el módulo Aplicaciones (< 180 líneas, SRP).
// ============================================================================

const BLOATWARE_PACKAGES = new Set([
  'com.google.android.apps.tachyon', 'com.google.android.music', 'com.google.android.videos',
  'com.google.android.apps.youtube.music', 'com.google.android.feedback',
  'com.google.android.googlequicksearchbox', 'com.google.android.apps.wellbeing',
  'com.samsung.android.bixby.agent', 'com.samsung.android.bixby.es.globalaction',
  'com.samsung.android.bixby.wakeup', 'com.samsung.android.app.spage',
  'com.samsung.android.game.gamehome', 'com.samsung.android.game.gametools',
  'com.sec.android.app.sbrowser', 'com.samsung.android.email.provider',
  'com.samsung.android.kidsinstaller', 'com.samsung.android.app.watchmanagerstub',
  'com.sec.android.easyMover.Agent', 'com.miui.analytics', 'com.miui.msa.global',
  'com.xiaomi.mipicks', 'com.miui.hybrid', 'com.miui.bugreport', 'com.miui.yellowpage',
  'com.xiaomi.glance.app', 'com.xiaomi.midrop', 'com.miui.videoplayer',
  'com.mi.android.globalminusscreen', 'com.heytap.browser', 'com.heytap.mcs',
  'com.heytap.cloud', 'com.heytap.market', 'com.heytap.pictorial', 'com.oplus.member',
  'com.oplus.pay', 'com.coloros.note', 'com.oplus.appdetail', 'com.oplus.games',
  'com.nearme.atlas', 'com.coloros.phonemanager', 'com.oplus.olc', 'com.oplus.sau',
  'com.huawei.android.hsad', 'com.huawei.appmarket', 'com.huawei.hms',
  'com.huawei.browser', 'com.huawei.music', 'com.huawei.video',
  'com.facebook.katana', 'com.facebook.system', 'com.facebook.appmanager',
  'com.facebook.services', 'com.netflix.mediaclient', 'com.netflix.partner.activation',
  'com.amazon.mShop.android.shopping', 'com.spotify.music', 'com.ebay.mobile',
  'com.zhiliaoapp.musically', 'com.bytecreative.promoresources',
]);

const BLOAT_PREFIXES = [
  'com.heytap.', 'com.miui.', 'com.xiaomi.', 'com.oplus.', 'com.coloros.',
  'com.facebook.', 'com.samsung.android.bixby', 'com.huawei.android.hsad',
  'com.huawei.appmarket', 'com.carrier.',
];

const MALWARE_SIGNATURES: Array<{ key: string; name: string; severity: 'medium' | 'high' | 'critical' }> = [
  { key: 'anubis', name: 'Troyano Bancario Anubis', severity: 'critical' },
  { key: 'cerberus', name: 'Troyano Bancario Cerberus', severity: 'critical' },
  { key: 'teabot', name: 'Troyano Bancario TeaBot', severity: 'critical' },
  { key: 'flubot', name: 'Troyano Bancario FluBot', severity: 'critical' },
  { key: 'sharkbot', name: 'Troyano Bancario SharkBot', severity: 'critical' },
  { key: 'xenomorph', name: 'Troyano Bancario Xenomorph', severity: 'critical' },
  { key: 'hydra', name: 'Troyano Bancario Hydra', severity: 'critical' },
  { key: 'ermac', name: 'Troyano Bancario Ermac', severity: 'critical' },
  { key: 'hookbot', name: 'Troyano Bancario Hook', severity: 'critical' },
  { key: 'lockerpin', name: 'Ransomware LockerPin', severity: 'critical' },
  { key: 'doublelocker', name: 'Ransomware DoubleLocker', severity: 'critical' },
  { key: 'svpeng', name: 'Ransomware Svpeng', severity: 'critical' },
  { key: 'chamois', name: 'Botnet Chamois', severity: 'critical' },
  { key: 'triada', name: 'Botnet Triada', severity: 'critical' },
  { key: 'moqhao', name: 'Botnet MoqHao', severity: 'critical' },
  { key: 'xhelper', name: 'Troyano Persistente XHelper', severity: 'critical' },
  { key: 'necro', name: 'Trojan Dropper Necro', severity: 'critical' },
  { key: 'joker', name: 'Spyware / Billing Fraud Joker', severity: 'critical' },
  { key: 'harly', name: 'Troyano Suscriptor Harly', severity: 'high' },
  { key: 'ahmyth', name: 'RAT de Acceso Remoto AhMyth', severity: 'critical' },
  { key: 'androrat', name: 'RAT de Acceso Remoto AndroRAT', severity: 'critical' },
  { key: 'spynote', name: 'RAT de Acceso Remoto SpyNote', severity: 'critical' },
  { key: 'craxsrat', name: 'RAT de Acceso Remoto CraxsRAT', severity: 'critical' },
  { key: 'pegasus', name: 'Spyware Pegasus', severity: 'critical' },
  { key: 'hermit', name: 'Spyware Hermit', severity: 'high' },
  { key: 'predator', name: 'Spyware Predator', severity: 'high' },
  { key: 'phonespy', name: 'Spyware PhoneSpy', severity: 'high' },
  { key: 'mspy', name: 'Stalkerware mSpy', severity: 'high' },
  { key: 'flexispy', name: 'Stalkerware FlexiSPY', severity: 'high' },
  { key: 'cocospy', name: 'Stalkerware Cocospy', severity: 'high' },
  { key: 'spyic', name: 'Stalkerware Spyic', severity: 'high' },
  { key: 'hoverwatch', name: 'Stalkerware Hoverwatch', severity: 'high' },
  { key: 'hiddenads', name: 'Adware HiddenAds', severity: 'high' },
  { key: 'fakeadblocker', name: 'Adware FakeAdBlocker', severity: 'medium' },
  { key: 'agentsmith', name: 'Adware Agent Smith', severity: 'high' },
  { key: 'mobidash', name: 'Adware MobiDash', severity: 'medium' },
  { key: 'ewind', name: 'Adware Ewind', severity: 'medium' },
  { key: 'hiddad', name: 'Adware Hiddad (Popups Ocultos)', severity: 'high' },
  { key: 'andreed', name: 'Adware Andreed', severity: 'medium' },
  { key: 'kaleidoscope', name: 'Adware Kaleidoscope', severity: 'high' },
];

const ADWARE_KEYWORDS_RE = /(?:clean(?:er)?master|supercleaner|junkclean|phonebooster|rambooster|batterybooster|fastcharger|coolermaster|viruscleaner|antivirusfree|luckywheel|cashreward|freemoney|popad|adpush)/i;
const TRUSTED_USER_PREFIXES = ['com.google.', 'com.android.', 'com.whatsapp', 'com.instagram.', 'com.facebook.', 'com.spotify.', 'com.netflix.', 'org.telegram.', 'com.microsoft.', 'com.Truecaller', 'com.nequi.', 'com.davivienda.', 'com.bancolombia.', 'sinet.startup.inDriver', 'com.deepseek.'];
// Plugins legítimos sin icono (bibliotecas de sistema/tricorder/codecs) que no deben dar falso positivo
const LEGIT_HEADLESS_RE = /(?:\.overlay|\.rro|auto_generated|trichromelibrary|webview|tts|gboard|inputmethod|speechservices|ar\.core|play\.games| PrintService|MidiService)/i;

const APP_NAME_DICT: Record<string, string> = {
  'com.android.chrome': 'Google Chrome', 'com.google.android.youtube': 'YouTube', 'com.whatsapp': 'WhatsApp',
  'com.instagram.android': 'Instagram', 'com.facebook.orca': 'Messenger', 'com.facebook.katana': 'Facebook',
  'com.facebook.lite': 'Facebook Lite', 'com.spotify.music': 'Spotify', 'com.netflix.mediaclient': 'Netflix',
  'com.android.vending': 'Google Play Store', 'com.google.android.apps.docs': 'Google Drive', 'com.google.android.apps.maps': 'Google Maps',
  'com.google.android.gm': 'Gmail', 'com.google.android.apps.photos': 'Google Photos', 'com.google.android.googlequicksearchbox': 'Google App',
  'com.google.android.apps.messaging': 'Mensajes de Google', 'com.google.android.contacts': 'Contactos de Google',
  'com.google.android.calendar': 'Google Calendar', 'com.google.android.apps.walletnfcrel': 'Google Wallet',
  'com.google.android.apps.tachyon': 'Google Meet', 'com.google.android.apps.wellbeing': 'Bienestar Digital',
  'com.coloros.note': 'Notas (OPPO)', 'com.oplus.member': 'Mi OPPO', 'com.oplus.games': 'Espacio de Juegos',
  'com.coloros.phonemanager': 'Gestor del Teléfono', 'com.oplus.account': 'Cuenta OPPO', 'com.deepseek.chat': 'DeepSeek',
  'com.google.android.apps.authenticator2': 'Google Authenticator', 'com.nequi.MobileApp': 'Nequi',
  'com.davivienda.daviviendaapp': 'Davivienda', 'com.bancolombia.appbilletera': 'Bancolombia A la Mano',
  'sinet.startup.inDriver': 'inDrive', 'com.snaptube.premium': 'SnapTube',
};

const SAFE_TO_REMOVE_PACKAGES = new Set([
  'com.facebook.katana', 'com.facebook.orca', 'com.facebook.lite', 'com.facebook.system', 'com.facebook.appmanager',
  'com.facebook.services', 'com.instagram.android', 'com.zhiliaoapp.musically', 'com.twitter.android', 'com.snapchat.android',
  'com.netflix.mediaclient', 'com.spotify.music', 'com.amazon.mShop.android.shopping', 'com.ebay.mobile', 'com.shopee.*',
  'com.google.android.apps.youtube.music', 'com.google.android.apps.tachyon', 'com.google.android.apps.wellbeing',
  'com.google.android.googlequicksearchbox', 'com.heytap.browser', 'com.heytap.cloud', 'com.heytap.market',
  'com.heytap.pictorial', 'com.heytap.mcs', 'com.oplus.member', 'com.oplus.pay', 'com.oplus.games',
  'com.oplus.appdetail', 'com.oplus.sau', 'com.oplus.olc', 'com.coloros.note', 'com.coloros.phonemanager',
  'com.nearme.atlas', 'com.oplus.quicksearch', 'com.samsung.android.bixby.agent', 'com.samsung.android.bixby.wakeup',
  'com.samsung.android.game.gamehome', 'com.samsung.android.app.spage', 'com.samsung.android.email.provider', 'com.carrier.*',
]);

const CRITICAL_SYSTEM_PACKAGES = new Set([
  'android', 'system', 'com.android.providers.*', 'com.android.server.*', 'com.android.phone', 'com.android.systemui',
  'com.android.settings', 'com.android.bluetooth', 'com.android.nfc', 'com.android.wifi', 'com.android.shell',
  'com.android.packageinstaller', 'com.google.android.gms', 'com.google.android.gms.persistent',
  'com.google.android.gsf', 'com.google.android.gsf.login', 'com.android.vending', 'com.qualcomm.*', 'com.mediatek.*',
]);

const matchesSetOrWildcard = (set: Set<string>, pkg: string): boolean => {
  if (set.has(pkg)) return true;
  for (const pattern of set) if (pattern.endsWith('*') && pkg.startsWith(pattern.slice(0, -1))) return true;
  return false;
};

export const isBloatwarePackage = (pkg: string, isSystem: boolean): boolean =>
  isSystem && (BLOATWARE_PACKAGES.has(pkg) || BLOAT_PREFIXES.some((p) => pkg.startsWith(p)));

export const isLegitHeadlessPackage = (pkg: string): boolean => LEGIT_HEADLESS_RE.test(pkg);

export function getMalwareClassification(pkg: string) {
  const cleanPkg = pkg.toLowerCase();
  const hit = MALWARE_SIGNATURES.find((sig) => cleanPkg.includes(sig.key));
  if (hit) return { isMalware: true, threatName: hit.name, severity: hit.severity };
  if (ADWARE_KEYWORDS_RE.test(cleanPkg)) return { isMalware: true, threatName: 'Adware / Falso Optimizador Publicitario', severity: 'medium' as const };
  return null;
}

export function evaluateHeuristicThreat(params: {
  pkg: string; isSystem: boolean; isHidden: boolean; hasOverlay: boolean;
  hasAccessibility: boolean; isDeviceAdmin: boolean; isSideloaded: boolean;
  hasNotificationAccess?: boolean; isRunningInBg?: boolean;
}): { isMalware: boolean; threatName: string; severity: 'medium' | 'high' | 'critical' } | null {
  const { pkg, isSystem, isHidden, hasOverlay, hasAccessibility, isDeviceAdmin, isSideloaded, hasNotificationAccess, isRunningInBg } = params;
  const known = getMalwareClassification(pkg);
  if (known) return known;
  if (isSystem || TRUSTED_USER_PREFIXES.some((p) => pkg.startsWith(p)) || isLegitHeadlessPackage(pkg)) return null;
  if (hasAccessibility && (isSideloaded || isHidden)) return { isMalware: true, threatName: 'Spyware / Troyano con Accesibilidad Activa', severity: 'critical' };
  if (isDeviceAdmin && (isSideloaded || isHidden)) return { isMalware: true, threatName: 'Persistencia Device Admin Sospechosa', severity: 'critical' };
  if (isHidden && hasNotificationAccess) return { isMalware: true, threatName: 'Spyware Oculto con Lectura de Notificaciones', severity: 'critical' };
  if (isHidden && hasOverlay) return { isMalware: true, threatName: 'Adware Oculto con Overlay (Popups de Publicidad)', severity: 'high' };
  if (isHidden && isRunningInBg) return { isMalware: true, threatName: 'App Oculta Activa en RAM (Sin Icono en Launcher)', severity: 'high' };
  if (isHidden && isSideloaded) return { isMalware: true, threatName: 'APK Oculto sin Icono (Instalación Externa)', severity: 'high' };
  if (isHidden) return { isMalware: true, threatName: 'App de Usuario Oculta (Sin Icono en Launcher)', severity: 'medium' };
  if (hasOverlay && isSideloaded) return { isMalware: true, threatName: 'Adware / Overlay Publicitario (APK Externo)', severity: 'medium' };
  return null;
}

export function deriveAppName(apkPath: string, pkg: string): string {
  if (APP_NAME_DICT[pkg]) return APP_NAME_DICT[pkg];
  const parts = apkPath.split('/');
  const lastPart = parts[parts.length - 1];
  if (lastPart && lastPart !== 'base.apk' && lastPart.endsWith('.apk')) return lastPart.replace('.apk', '');
  if (parts.length >= 2) {
    let name = parts[parts.length - 2].split('-')[0];
    if (name.includes('.')) name = name.split('.').pop() || name;
    if (name) return name.charAt(0).toUpperCase() + name.slice(1);
  }
  const lastPkg = pkg.split('.').pop() || pkg;
  return lastPkg.charAt(0).toUpperCase() + lastPkg.slice(1);
}

export const isCriticalSystem = (pkg: string): boolean => matchesSetOrWildcard(CRITICAL_SYSTEM_PACKAGES, pkg);

export function isSafeToRemove(pkg: string, isSystem: boolean): boolean {
  if (isCriticalSystem(pkg)) return false;
  if (matchesSetOrWildcard(SAFE_TO_REMOVE_PACKAGES, pkg)) return true;
  return isSystem && ['com.heytap.', 'com.oplus.', 'com.coloros.', 'com.nearme.'].some((p) => pkg.startsWith(p));
}
