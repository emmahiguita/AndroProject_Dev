# debloat.ps1 - Remove OPPO/HeyTap/ColorOS bloatware from CPH2557 (user 0)
#
# Reversible: run with -Restore to reinstall/reenable everything removed.
# Logs every action to debloat.log and records state in debloat-manifest.json.
#
# NEVER in this list: systemui, launcher, settings, camera, dialer, phone,
# gms/vending (Play), banking, fido, oplus.pay/eid/accesscard, OTA updaters.
# Everything here is safe-to-remove OPPO/HeyTap/MediaTek marketing/telemetry.

param(
    [switch]$Restore,
    [string]$Device = "VGL7MVFMDYQG8T55"
)

$ADB = "C:\Users\emman\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$Manifest = Join-Path $PSScriptRoot "debloat-manifest.json"
$Log = Join-Path $PSScriptRoot "debloat.log"

# Package | why-removed (comments stay in the script, not the device)
$Bloat = @(
    "com.heytap.market",                       # OPPO app store
    "com.heytap.htms",                         # HeyTap services
    "com.oplus.themestore",                    # theme store
    "com.coloros.weather2",                    # weather (ads)
    "com.coloros.musiclink",                   # music
    "com.oplus.musiclink",                     # music
    "com.coloros.oshare",                      # OPPO share
    "com.coloros.lockassistant",               # lockscreen magazine
    "com.coloros.bootreg",                     # carrier registration
    "android.autoinstalls.config.oppo",        # carrier auto-install config
    "com.oplus.atlas",                         # preload app framework
    "com.oplus.aiunit",                        # OPPO AI
    "com.oplus.deepthinker",                   # OPPO AI
    "com.oplus.athena",                        # OPPO AI assistant
    "com.oplus.pscanvas",                      # PS canvas
    "com.oplus.upgradeguide",                  # upgrade guide
    "com.oplus.multiapp",                      # app cloning
    "com.oplus.virtualcomm",                   # cross-device calls
    "com.oplus.statistics.rom",                # telemetry
    "com.oplus.logkit",                        # logging/telemetry
    "com.oplus.onetrace",                      # telemetry
    "com.oplus.crashbox",                      # crash reporting
    "com.oplus.healthservice",                 # health cloud
    "com.nearme.instant.platform",             # nearme platform
    "com.mediatek.magtapp",                    # MTK antenna test app
    "com.oplus.trafficmonitor",                # traffic monitor
    "com.oplus.appbooster",                    # placebo booster
    "com.oplus.mediaturbo",                    # media turbo
    "com.oplus.account",                       # OPPO account
    "com.oplus.appplatform",                   # app platform
    "com.oplus.engineernetwork",               # network test
    "com.oplus.keyguard.clock.magazine"        # magazine lockscreen clock
)

function Invoke-Adb {
    param([string[]]$Cmd)
    & $ADB -s $Device @Cmd 2>&1
}

function Write-Log([string]$Line) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -LiteralPath $Log -Value "[$ts] $Line"
    Write-Host $Line
}

# --- Pre-flight -------------------------------------------------------------
if (-not (Test-Path -LiteralPath $ADB)) { throw "ADB not found: $ADB" }
$conn = Invoke-Adb @("get-state")
if ($conn -ne "device") { throw "Device $Device not connected (state=$conn). Connect via USB/WiFi first." }

# --- Restore mode -----------------------------------------------------------
if ($Restore) {
    Write-Log "=== RESTORE MODE ==="
    $restored = @()
    foreach ($pkg in $Bloat) {
        $r1 = Invoke-Adb @("shell","pm","install-existing","--user","0",$pkg)
        if ($r1 -match "Failure" -or $r1 -match "Unknown package") {
            $r2 = Invoke-Adb @("shell","pm","enable","--user","0",$pkg)
            Write-Log "  $pkg -> enable: $r2"
        } else {
            Write-Log "  $pkg -> install-existing: $r1"
        }
        $restored += $pkg
    }
    $json = @{ timestamp = (Get-Date -Format o); mode = "restored"; packages = $restored } | ConvertTo-Json
    Set-Content -LiteralPath $Manifest -Value $json
    Write-Log "Restore done. $($restored.Count) packages processed."
    exit 0
}

# --- Debloat mode -----------------------------------------------------------
Write-Log "=== DEBLOAT MODE ==="
$results = @()
foreach ($pkg in $Bloat) {
    $r = Invoke-Adb @("shell","pm","uninstall","--user","0",$pkg)
    $status = if ($r -match "Success") { "uninstalled" }
              elseif ($r -match "Failure|Unknown package") {
                  # Fall back to disable-user (system packages that cannot be user-uninstalled)
                  $r2 = Invoke-Adb @("shell","pm","disable-user","--user","0",$pkg)
                  if ($r2 -match "disabled") { "disabled" } else { "FAILED: $r | $r2" }
              }
              else { "unknown: $r" }
    Write-Log "  $pkg -> $status"
    $results += [PSCustomObject]@{ package = $pkg; status = $status }
}

$json = @{ timestamp = (Get-Date -Format o); mode = "debloated"; packages = $Bloat; results = $results } | ConvertTo-Json
Set-Content -LiteralPath $Manifest -Value $json

# --- Post-check -------------------------------------------------------------
$sys = Invoke-Adb @("shell","pm","list","packages")
$still = @($Bloat | Where-Object { $sys -match [regex]::Escape($_) })
Write-Log "=== DONE ==="
Write-Log "Bloat remaining: $($still.Count) / $($Bloat.Count) (still-present list below, expected for disable-only pkgs)"
$still | ForEach-Object { Write-Log "  REMAINS: $_" }
Write-Log "Restore anytime with: .\debloat.ps1 -Restore"
