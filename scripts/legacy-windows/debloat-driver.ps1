<#
.SYNOPSIS
    Debloat Driver v1 — clasifica y gestiona bloatware en OPPO CPH2557 (Android 15, sin root).

.DESCRIPTION
    Driver reutilizable para campañas de debloat. Reemplaza a debloat.ps1 (lista
    hardcodeada) con clasificación automática por prefijo de paquete + listas de
    excepción. TODO es reversible:

      - Disable  -> pm disable-user --user 0 (reenable con: .\debloat-driver.ps1 -Restore)
      - Uninstall-> pm uninstall --user 0   (reinstall con: .\debloat-driver.ps1 -Restore)

    Nunca toca paquetes críticos (ver $ProtectedExact/$ProtectedPrefix): telefonía,
    launcher, settings, SystemUI, GMS, Play Store, cámara, seguridad/banca, OTA,
    cuenta OPPO, FIDO. Protección aplicada incluso con -Force.

.PARAMETER Device
    Serial del dispositivo. Default: VGL7MVFMDYQG8T55 (CPH2557).

.PARAMETER Scan
    Muestra la clasificación completa de paquetes sin tocar nada.

.PARAMETER List
    Lista los paquetes de una categoría (critical|bloat|google|user|unknown) sin tocarlos.

.PARAMETER Disable
    Deshabilita (disable-user) los paquetes de las categorías dadas. Reversible.

.PARAMETER Uninstall
    Desinstala (uninstall --user 0) los paquetes de las categorías dadas.
    Paquetes de sistema que no acepten uninstall caen a disable-user.

.PARAMETER Category
    Categoría(s) objetivo: bloat, google, unknown, user. Default: bloat.
    'user' y 'unknown' requieren -Force (pueden contener apps que usas).

.PARAMETER Package
    Paquetes explícitos a gestionar (sustituye a Category).

.PARAMETER Restore
    Revierte todo lo registrado en el manifest (re-enable + reinstall).

.PARAMETER DryRun
    Muestra qué se haría sin ejecutarlo.

.PARAMETER Force
    Confirma acciones sobre categorías 'user'/'unknown' y sobreescribe
    manifest previo.

.EXAMPLE
    .\debloat-driver.ps1 -Scan
    .\debloat-driver.ps1 -List bloat
    .\debloat-driver.ps1 -Disable bloat -DryRun
    .\debloat-driver.ps1 -Uninstall bloat
    .\debloat-driver.ps1 -Package com.heytap.music -Uninstall
    .\debloat-driver.ps1 -Restore
#>
[CmdletBinding()]
param(
    [Parameter(Position = 1)][string]$Device = "VGL7MVFMDYQG8T55",
    [switch]$Scan,
    [ValidateSet("critical","bloat","google","user","unknown")][string[]]$List,
    [switch]$Disable,
    [switch]$Uninstall,
    [Parameter(Position = 0)][ValidateSet("bloat","google","user","unknown")][string[]]$Category = @("bloat"),
    [string[]]$Package,
    [switch]$Restore,
    [switch]$DryRun,
    [switch]$Force
)

$ADB = "C:\Users\emman\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$ManifestPath = Join-Path $PSScriptRoot "debloat-driver-manifest.json"
$LogPath      = Join-Path $PSScriptRoot "debloat-driver.log"

# ============================================================================
# CLASIFICACIÓN — orden de precedencia: Critical > Bloat > Google > User > Unknown
# ============================================================================

# Paquetes que JAMÁS se tocan (exactos). Núcleo de sistema + infraestructura.
# Si rompes algo de aquí, el teléfono puede quedar inestable o sin desbloqueo.
$ProtectedExact = @(
    # --- Google Play Services / infraestructura core ---
    "com.google.android.gms", "com.google.android.gsf",
    "com.google.android.ext.services", "com.google.android.ext.shared",
    "com.google.android.permissioncontroller", "com.google.android.webview",
    "com.google.android.packageinstaller", "com.google.android.sdksandbox",
    "com.google.android.modulemetadata", "com.google.android.networkstack",
    "com.google.android.networkstack.overlay", "com.google.android.networkstack.tethering",
    "com.google.android.configupdater", "com.google.android.onetimeinitializer",
    "com.google.android.partnersetup", "com.google.android.setupwizard",
    "com.google.android.captiveportallogin", "com.google.android.hotspot2.osulogin",
    "com.google.android.rkpdapp", "com.google.android.federatedcompute",
    "com.google.android.safetycenter.resources", "com.google.android.as",
    "com.google.android.as.oss", "com.google.android.safetycore",
    "com.google.android.contactkeys", "com.google.android.apps.subscriptions.red",
    "com.google.android.providers.media.module", "com.google.android.documentsui",
    # --- Apps Google que el usuario mantiene (decidido en campaña previa) ---
    "com.google.android.apps.adm",                          # Find My Device (anti-robo)
    "com.google.android.apps.tachyon",                      # Duo/Meet
    "com.google.android.apps.docs",                         # Docs
    "com.google.android.apps.maps",                         # Maps
    "com.google.android.youtube",                           # YouTube
    "com.google.android.gm",                                # Gmail
    "com.google.android.apps.nbu.files",                    # Files
    "com.google.android.apps.messaging",                    # SMS
    "com.google.android.dialer", "com.google.android.contacts",
    "com.google.android.inputmethod.latin",                 # Gboard
    "com.google.android.googlequicksearchbox",              # Google app
    "com.google.android.tts", "com.google.android.marvin.talkback",
    # --- Telefonía / sistema AOSP ---
    "com.android.phone", "com.android.server.telecom",
    "com.android.settings", "com.android.systemui", "com.android.launcher",
    "com.android.vending",                                  # Play Store
    "com.android.providers.telephony", "com.android.providers.contacts",
    "com.android.providers.media", "com.android.providers.settings",
    "com.android.providers.downloads", "com.android.providers.calendar",
    "com.android.mms.service", "com.android.bluetooth", "com.android.nfc",
    "com.android.se", "com.android.certinstaller", "com.android.keychain",
    "com.android.credentialmanager", "com.android.shell",
    "com.android.inputdevices", "com.android.location.fused",
    "com.android.externalstorage", "com.android.mtp", "com.android.stk",
    "com.android.cellbroadcastreceiver", "com.android.statementservice",
    "com.android.printspooler", "com.android.managedprovisioning",
    "com.android.carrierconfig", "com.android.ons",
    "com.android.pacprocessor", "com.android.proxyhandler", "com.android.vpndialogs",
    "com.android.apps.tag", "com.android.bookmarkprovider",
    "com.android.calllogbackup", "com.android.sharedstoragebackup",
    "com.android.localtransport", "com.android.backupconfirm",
    "com.android.wallpaperbackup", "com.android.htmlviewer",
    "com.android.email.partnerprovider", "com.android.providers.partnerbookmarks",
    "com.android.providers.blockednumber", "com.android.providers.userdictionary",
    "com.android.dynsystem", "com.android.oemextensions", "com.android.simappdialog",
    "com.android.companiondevicemanager", "com.android.devicelockcontroller",
    "com.android.storagemanager", "com.android.settings.intelligence",
    "com.android.intentresolver", "com.android.cts.ctsshim", "com.android.cts.priv.ctsshim",
    "com.android.wallpaper.livepicker", "com.android.role.notes.enabled",
    "com.android.cameraextensions", "com.android.bips", "com.android.fmradio",
    # --- Cámara / galería / seguridad / banca ColorOS (NO tocar) ---
    "com.oplus.camera", "com.coloros.gallery3d",
    "com.coloros.phonemanager", "com.oplus.safecenter",
    "com.coloros.securepay", "com.oplus.pay", "com.oplus.eid",
    "com.oplus.fido.asm", "com.oplus.fido.fido2client", "com.oplus.fido.uafclient",
    "com.oplus.securitykeyboard", "com.oplus.securitypermission",
    "com.oplus.accesscard", "com.oplus.sos", "com.oplus.account",
    "com.oplus.ota", "com.oplus.cota", "com.oplus.romupdate",
    "com.oplus.sau", "com.oplus.sauhelper",
    "com.coloros.activation", "com.coloros.bootreg",
    # --- Utilidades esenciales ColorOS que el usuario usa ---
    "com.coloros.alarmclock", "com.coloros.calculator",
    "com.coloros.filemanager", "com.coloros.scenemode",
    "com.oplus.screenshot", "com.oplus.screenrecorder", "com.oplus.cast",
    "com.oplus.audio.effectcenter", "com.oplus.mediacontroller",
    "com.oplus.gesture", "com.oplus.eyeprotect", "com.oplus.aod",
    "com.oplus.wallpapers", "com.oplus.wifibackuprestore", "com.oplus.wirelesssettings",
    "com.oplus.doublewake.settings", "com.oplus.battery",
    # --- Overlays / RRO / framework (romper = bootloop visual) ---
    "com.android.overlay.gmsconfig.common", "com.oplus.android.overlay.gmsconfig.common",
    "com.android.frameworkres.overlay", "com.oplus.framework.rro.oppo",
    "oplus.frameworkres.overlay.display.product",
    "android.frameworkres.overlay.display.product",
    "android.frameworkres.overlay.Network", "android.connectivity.base.overlay",
    "com.android.wifi.resources.overlay", "com.android.systemui.overlay.fingerprint.anim.none",
    # --- Biometría / FIDO (banca y desbloqueo dependen de esto) ---
    "com.fido.asm", "com.fido.fido2client", "com.fido.uafclient",
    "com.tencent.soter.soterserver",
    # --- Servicios de sistema OPPO de bajo nivel (no tocar) ---
    "com.oplus.exsystemservice", "com.oplus.subsys", "com.oplus.subsys.plugin",
    "com.oplus.exserviceui", "com.oplus.owkservice", "com.oplus.postmanservice",
    "com.oplus.customize.coreapp",
    # --- Red / GPS / conectividad ---
    "com.oplus.location", "com.oplus.locationproxy", "com.oplus.nrMode",
    "com.oplus.tai.wifiqoe", "com.oplus.beaconlink", "com.oplus.nas",
    "com.oplus.ndsf", "com.oplus.nhs", "com.oplus.encryption", "com.oplus.lfeh",
    "com.oplus.stdid", "com.coloros.ocs.opencapabilityservice",
    "com.ses.entitlement.o2", "com.wapi.wapicertmanager"
)

# Prefijos que NUNCA se tocan (sistema AOSP/MTK/overlay/framework).
$ProtectedPrefix = @(
    "android.", "com.android.", "com.mediatek.",
    "com.google.android.gms.", "com.google.mainline.",
    "com.google.android.overlay.", "com.google.android.connectivity",
    "com.google.android.cellbroadcast", "com.google.android.wifi",
    "com.google.android.server.deviceconfig",
    "com.oplus.framework.", "com.oplus.framework_", "oplus.frameworkres",
    "oplus", "vendor.", "com.android.apex.",
    "com.oplus.android.overlay.", "android.autoinstalls.config",
    "com.android.internal.display.cutout", "com.android.internal.systemui",
    "com.android.systemui.overlay", "com.android.theme.", "com.android.wifi.",
    "com.android.safetycenter", "com.google.android.networkstack",
    "com.oplus.keyguard.clock", "com.oplus.systemui"
)

# Bloatware confirmado (campañas previas + identificados como seguros).
# TODO reversible con -Restore.
$BloatExact = @(
    # --- Juegos preinstalados ---
    "com.king.candycrushsaga", "com.king.candycrushsodasaga",
    "com.oakever.tiletrip", "com.oakever.arrows", "com.fullmetalgamedev.fruitshooting",
    "com.katanlabs.worm.ioeatemall", "com.KatanLabs.tilematchpuzzlemaster",
    "com.katanlabs.bubblepop", "com.vitastudio.mahjong", "com.block.juggle",
    # --- Redes sociales / bloat de terceros ---
    "com.facebook.katana", "com.facebook.appmanager", "com.facebook.services",
    "com.facebook.system", "com.linkedin.android", "com.zhiliaoapp.musically",
    "com.lemon.lvoverseas", "com.truecaller", "com.einnovation.temu",
    "com.booking", "com.netflix.mediaclient",
    # --- Telemetría / debug / ingeniería OPPO+MTK ---
    "com.debug.loggerui", "com.daemon.shelper",
    "com.oplus.logkit", "com.oplus.crashbox", "com.oplus.onetrace",
    "com.oplus.powermonitor", "com.oplus.engineercamera", "com.oplus.engineermode",
    "com.oplus.engineernetwork", "com.oplus.statistics.rom",
    "com.mediatek.magtapp", "com.mediatek.gnssdebugreport", "com.mediatek.atci.service",
    # --- HeyTap/ColorOS apps duplicadas o marketing ---
    "com.heytap.browser", "com.heytap.market", "com.heytap.music",
    "com.heytap.pictorial", "com.heytap.accessory", "com.heytap.htms",
    "com.coloros.karaoke", "com.coloros.childrenspace", "com.coloros.operationManual",
    "com.coloros.oshare", "com.coloros.smartsidebar", "com.coloros.video",
    "com.coloros.healthcheck", "com.coloros.lockassistant", "com.coloros.compass2",
    "com.coloros.onekeylockscreen", "com.coloros.note", "com.coloros.musiclink",
    "com.coloros.backuprestore", "com.coloros.soundrecorder", "com.coloros.floatassistant",
    "com.coloros.weather2", "com.coloros.weather.service",
    "com.oplus.games", "com.oplus.themestore", "com.oplus.upgradeguide",
    "com.oplus.vip", "com.oplus.pscanvas", "com.oplus.apprecover",
    "com.oplus.member", "andes.oplus.documentsreader", "cn.wps.moffice_eng",
    # --- Google apps que el usuario decidió quitar ---
    "com.google.android.videos", "com.google.android.apps.youtube.music",
    "com.google.android.apps.chromecast.app",
    "com.google.android.apps.photos", "com.google.android.calendar",
    "com.google.android.keep", "com.google.android.apps.walletnfcrel",
    "com.google.android.apps.healthdata", "com.google.android.apps.restore",
    "com.google.android.health.connect.backuprestore",
    "com.google.android.feedback", "com.google.android.apps.wellbeing",
    "com.google.android.projection.gearhead", "com.google.ar.lens",
    # --- Bloat puro AOSP (huevo pascua, tracing, screensaver) ---
    "com.android.egg", "com.android.traceur", "com.android.dreams.basic",
    # --- Investigado en campaña 3: IA OPPO, telemetría, placebos ---
    "com.heytap.colorfulengine",                   # Colorful Engine (mejora color marketing)
    "com.heytap.mcs",                              # HeyTap System Messages (cloud/telemetria)
    "com.microsoftsdk.crossdeviceservicebroker",   # Microsoft Phone Link (bloat cruzado)
    "com.nearme.instant.platform",                 # NearMe Instant apps
    "com.oplus.aiunit", "com.oplus.athena", "com.oplus.atlas",
    "com.oplus.obrain", "com.oplus.deepthinker", "com.oplus.smartengine",
    "com.oplus.cosa",                              # App Enhancement (telemetria)
    "com.oplus.appbooster", "com.oplus.appplatform",
    "com.oplus.healthservice",                     # nube de salud (telemetria)
    "com.oplus.linker",                            # OPSynergy cross-device
    "com.oplus.mediaturbo", "com.oplus.trafficmonitor",
    "com.oplus.qualityprotect",                    # telemetria de calidad
    "com.oplus.uiengine",                          # Diverse engine (UI marketing)
    "com.oplus.virtualcomm",                       # cross-device calls
    "com.oppo.quicksearchbox"                      # Global Search (duplica Google)
)

# Apps de usuario instaladas — se listan pero NO se tocan sin -Force.
$UserKnown = @(
    "com.mercadolibre", "com.spotify.music", "com.openai.chatgpt", "com.fintech.life",
    "dev.nanoai.mobile"   # app IA instalada por el usuario (data/app, no bloat)
)

# Prefijos de fabricante NO clasificados explícitamente: candidatos a revisar
# (nunca automáticos, aparecen como 'unknown').
$OemPrefix = @(
    "com.oplus.", "com.coloros.", "com.heytap.", "com.nearme.", "com.oppo.", "com.mediatek."
)

# Coherencia: nada puede ser crítico y bloat a la vez. BloatExact gana.
$ProtectedExact = @($ProtectedExact | Where-Object { $BloatExact -notcontains $_ })

# ============================================================================
# HELPERS
# ============================================================================

function Invoke-Adb {
    param([string[]]$Cmd)
    # 2>&1 mezcla stderr como ErrorRecord; solo se devuelven líneas string.
    & $ADB -s $Device @Cmd 2>&1 | ForEach-Object { if ($_ -is [string]) { $_ } }
}

function Write-Log([string]$Line) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -LiteralPath $LogPath -Value "[$ts] $Line"
    Write-Host $Line
}

function Get-Category {
    param([string]$Pkg)
    # BloatExact primero: excepciones curadas a mano que ganan a prefijos protectores
    # (ej. com.mediatek.magtapp es debug, no sistema MTK core).
    if ($BloatExact -contains $Pkg) { return "bloat" }
    if ($ProtectedExact -contains $Pkg) { return "critical" }
    foreach ($pfx in $ProtectedPrefix) { if ($Pkg.StartsWith($pfx, [StringComparison]::OrdinalIgnoreCase)) { return "critical" } }
    if ($UserKnown -contains $Pkg) { return "user" }
    foreach ($pfx in $OemPrefix) { if ($Pkg.StartsWith($pfx, [StringComparison]::OrdinalIgnoreCase)) { return "unknown" } }
    if ($Pkg -match "^com\.(king|oakever|katanlabs|fullmetalgamedev|vitastudio|block|einnovation|zhiliaoapp|lemon|linkedin|truecaller|booking|netflix|spotify|openai)") { return "unknown" }
    if ($Pkg -match "^com\.google\.") { return "google" }
    return "unknown"
}

function Get-PackageSnapshot {
    # pkg | categoria | enabled
    $all = Invoke-Adb @("shell", "pm", "list", "packages")
    $disabled = Invoke-Adb @("shell", "pm", "list", "packages", "-d")
    $snap = @()
    foreach ($line in $all) {
        $pkg = ($line -replace "^package:", "").Trim()
        if (-not $pkg) { continue }
        $snap += [PSCustomObject]@{
            Package  = $pkg
            Category = (Get-Category $pkg)
            Enabled  = ($disabled -notcontains $line)
        }
    }
    return $snap | Sort-Object Package
}

function Show-Table {
    param($Snap)
    Write-Host ""
    Write-Host ("{0,-6} {1,-52} {2,-10} {3,-9}" -f "N", "PAQUETE", "CATEGORIA", "ESTADO") -ForegroundColor Cyan
    Write-Host ("{0,-6} {1,-52} {2,-10} {3,-9}" -f "--", "------", "--------", "------") -ForegroundColor DarkGray
    $i = 0
    foreach ($s in $Snap) {
        $i++
        $color = switch ($s.Category) {
            "critical" { "Gray" }
            "bloat"    { "Yellow" }
            "google"   { "Magenta" }
            "user"     { "Green" }
            "unknown"  { "Red" }
        }
        $state = if ($s.Enabled) { "enabled" } else { "disabled" }
        Write-Host ("{0,-6} {1,-52} {2,-10} {3,-9}" -f $i, $s.Package, $s.Category, $state) -ForegroundColor $color
    }
    Write-Host ""
    $counts = $Snap | Group-Object Category | ForEach-Object { "$($_.Name)=$($_.Count)" }
    Write-Host "Resumen: $($counts -join '  ')" -ForegroundColor Cyan
}

function Get-Manifest {
    if (Test-Path -LiteralPath $ManifestPath) {
        return (Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json)
    }
    return $null
}

function Save-Manifest {
    param($Entries)
    $json = @{
        timestamp = (Get-Date -Format "o")
        entries   = @($Entries)
    } | ConvertTo-Json -Depth 4
    Set-Content -LiteralPath $ManifestPath -Value $json
}

# ============================================================================
# PRE-FLIGHT
# ============================================================================

if (-not (Test-Path -LiteralPath $ADB)) { throw "ADB no encontrado: $ADB" }
if ($Disable -and $Uninstall) { throw "Elige Disable o Uninstall, no ambos." }

$conn = (Invoke-Adb @("get-state") | Out-String).Trim()
if ($conn -ne "device") { throw "Dispositivo $Device no conectado (estado=$conn). Conecta USB/WiFi primero." }

# ============================================================================
# RESTORE MODE
# ============================================================================

if ($Restore) {
    $m = Get-Manifest
    if (-not $m -or -not $m.entries) {
        Write-Host "Manifest vacio o inexistente: $ManifestPath" -ForegroundColor Yellow
        Write-Host "Nada que restaurar." -ForegroundColor Yellow
        exit 0
    }
    Write-Host "Restaurando $($m.entries.Count) paquetes..." -ForegroundColor Cyan
    $ok = 0; $fail = 0
    foreach ($e in $m.entries) {
        if ($e.action -eq "uninstall") {
            $r = Invoke-Adb @("shell", "pm", "install-existing", "--user", "0", $e.package)
            if ($r -match "Success|already exists|INSTALL_FAILED_ALREADY_EXISTS") { $ok++ }
            else {
                $r2 = Invoke-Adb @("shell", "pm", "enable", "--user", "0", $e.package)
                if ($r2 -match "new state: enabled") { $ok++ } else { $fail++; Write-Host "FAIL $($e.package): $r | $r2" -ForegroundColor Red }
            }
        } else {
            $r = Invoke-Adb @("shell", "pm", "enable", "--user", "0", $e.package)
            if ($r -match "new state: enabled") { $ok++ } else { $fail++; Write-Host "FAIL $($e.package): $r" -ForegroundColor Red }
        }
    }
    Write-Host "Restore completo. OK=$ok FAIL=$fail" -ForegroundColor Green
    if ($fail -eq 0) { Remove-Item -LiteralPath $ManifestPath -Force -ErrorAction SilentlyContinue }
    exit 0
}

# ============================================================================
# SCAN MODE
# ============================================================================

if ($Scan) {
    Write-Host "Escaneando $Device..." -ForegroundColor Cyan
    $snap = Get-PackageSnapshot
    Show-Table $snap
    exit 0
}

# ============================================================================
# LIST MODE
# ============================================================================

if ($List) {
    $snap = Get-PackageSnapshot
    foreach ($cat in $List) {
        $items = @($snap | Where-Object { $_.Category -eq $cat })
        Write-Host "`n[$cat] $($items.Count) paquetes:" -ForegroundColor Cyan
        if ($cat -eq "critical") {
            Write-Host "  (protegidos - el driver nunca los toca)" -ForegroundColor Gray
            $items | ForEach-Object { Write-Host "  $($_.Package)" -ForegroundColor Gray }
        } else {
            $items | ForEach-Object { Write-Host "  $($_.Package)" -ForegroundColor White }
        }
    }
    exit 0
}

# ============================================================================
# DISABLE / UNINSTALL MODE
# ============================================================================

if (-not ($Disable -or $Uninstall)) {
    Write-Host "Sin accion. Usa: -Scan | -List <cat> | -Disable | -Uninstall | -Restore" -ForegroundColor Yellow
    Write-Host "Ejemplos:" -ForegroundColor Yellow
    Write-Host "  .\debloat-driver.ps1 -Scan" -ForegroundColor Gray
    Write-Host "  .\debloat-driver.ps1 -List unknown" -ForegroundColor Gray
    Write-Host "  .\debloat-driver.ps1 -Disable bloat -DryRun" -ForegroundColor Gray
    Write-Host "  .\debloat-driver.ps1 -Uninstall bloat" -ForegroundColor Gray
    Write-Host "  .\debloat-driver.ps1 -Package com.heytap.music -Disable" -ForegroundColor Gray
    Write-Host "  .\debloat-driver.ps1 -Restore" -ForegroundColor Gray
    exit 0
}

$snap = Get-PackageSnapshot

# Selección de objetivos
if ($Package) {
    $targets = @()
    foreach ($p in $Package) {
        $found = $snap | Where-Object { $_.Package -eq $p }
        if ($found) { $targets += $found } else { Write-Host "Paquete no instalado: $p" -ForegroundColor Yellow }
    }
} else {
    $targets = @($snap | Where-Object { $Category -contains $_.Category })
}

if ($targets.Count -eq 0) {
    Write-Host "Ningun paquete coincide con la seleccion." -ForegroundColor Yellow
    exit 0
}

# Filtro incremental: solo se procesan paquetes habilitados (los ya gestionados
# en campañas previas se saltan para mantener el manifest limpio).
$skipped = @($targets | Where-Object { -not $_.Enabled })
$targets = @($targets | Where-Object { $_.Enabled })
if ($skipped.Count -gt 0) {
    Write-Host "Ya gestionados en campañas previas (skip): $($skipped.Count)" -ForegroundColor DarkGray
}

# Filtro de protección (aplica SIEMPRE, incluso con -Force)
$unsafe = @($targets | Where-Object { $_.Category -eq "critical" })
$targets = @($targets | Where-Object { $_.Category -ne "critical" })
if ($unsafe.Count -gt 0) {
    Write-Host "PROTEGIDOS - no se tocan (criticos):" -ForegroundColor Red
    $unsafe | ForEach-Object { Write-Host "  $($_.Package)" -ForegroundColor Red }
}

# Categorías 'user'/'unknown' requieren -Force
$risky = @($targets | Where-Object { $_.Category -in @("user","unknown") })
if ($risky.Count -gt 0 -and -not $Force) {
    Write-Host "REVISA - categorias user/unknown requieren -Force:" -ForegroundColor Yellow
    $risky | ForEach-Object { Write-Host "  [$($_.Category)] $($_.Package)" -ForegroundColor Yellow }
    $targets = @($targets | Where-Object { $_.Category -notin @("user","unknown") })
    Write-Host "(sin -Force, solo se procesan bloat/google: $($targets.Count))" -ForegroundColor Gray
}

if ($targets.Count -eq 0) { Write-Host "Nada que procesar tras filtros." -ForegroundColor Yellow; exit 0 }

$actionName = if ($Disable) { "disable" } else { "uninstall" }
Write-Host "`nObjetivo: $($targets.Count) paquetes -> $actionName" -ForegroundColor Cyan
if ($DryRun) {
    $targets | ForEach-Object { Write-Host "  [DRY] $actionName $($_.Package)" -ForegroundColor Gray }
    Write-Host "`nDry-run: nada ejecutado. Quita -DryRun para aplicar." -ForegroundColor Yellow
    exit 0
}

if (-not $Force) {
    $resp = Read-Host "Confirmar $actionName de $($targets.Count) paquetes? [y/N]"
    if ($resp -notmatch "^[ys]$") { Write-Host "Cancelado." -ForegroundColor Yellow; exit 0 }
}

# Ejecución
$entries = @()
$ok = 0; $fail = 0
foreach ($t in $targets) {
    if ($Disable) {
        $r = Invoke-Adb @("shell", "pm", "disable-user", "--user", "0", $t.Package)
        if ($r -match "new state: disabled") {
            $ok++; $entries += [PSCustomObject]@{ package = $t.Package; action = "disable" }
            Write-Log "  OK disable  $($t.Package)"
        } else {
            $fail++; Write-Log "  FAIL disable $($t.Package) -> $r"
        }
    } else {
        # Uninstall; fallback a disable-user si es paquete de sistema
        $r = Invoke-Adb @("shell", "pm", "uninstall", "--user", "0", $t.Package)
        if ($r -match "Success") {
            $ok++; $entries += [PSCustomObject]@{ package = $t.Package; action = "uninstall" }
            Write-Log "  OK uninstall $($t.Package)"
        } elseif ($r -match "Failure|Unknown package") {
            $r2 = Invoke-Adb @("shell", "pm", "disable-user", "--user", "0", $t.Package)
            if ($r2 -match "new state: disabled") {
                $ok++; $entries += [PSCustomObject]@{ package = $t.Package; action = "disable" }
                Write-Log "  OK disable (fallback) $($t.Package)"
            } else {
                $fail++; Write-Log "  FAIL $($t.Package) -> $r | $r2"
            }
        } else {
            $fail++; Write-Log "  FAIL $($t.Package) -> $r"
        }
    }
}

# Merge con manifest previo (para que -Restore cubra TODAS las campañas)
$prev = Get-Manifest
$all = @($entries)
if ($prev -and $prev.entries) { $all = @($prev.entries) + @($entries) }
Save-Manifest $all

Write-Host "`n=== ${actionName}: OK=$ok FAIL=$fail ===" -ForegroundColor Green
Write-Host "Rollback en cualquier momento: .\debloat-driver.ps1 -Restore" -ForegroundColor Cyan

# Post-check de integridad
Write-Host "`nVerificando integridad de paquetes criticos..." -ForegroundColor Cyan
$crit = Invoke-Adb @("shell", "pm", "list", "packages", "-d")
$m = Get-Manifest
$managed = @()
if ($m -and $m.entries) { $managed = @($m.entries | ForEach-Object { $_.package }) }
# Críticos deshabilitados por EL DRIVER (en manifest) son el problema real.
# Deshabilitados de fábrica (devicelockcontroller, gms.supervision...) no.
$broken = @($crit | ForEach-Object { ($_ -replace "^package:", "").Trim() } |
    Where-Object { $ProtectedExact -contains $_ -and $managed -contains $_ })
if ($broken.Count -eq 0) {
    Write-Host "Integridad OK: ningun paquete critico fue deshabilitado por el driver." -ForegroundColor Green
} else {
    Write-Host "ALERTA - criticos deshabilitados por el driver:" -ForegroundColor Red
    $broken | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    Write-Host "Restaura inmediatamente: .\debloat-driver.ps1 -Restore" -ForegroundColor Red
}
