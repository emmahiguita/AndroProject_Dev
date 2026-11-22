param(
  [switch]$EnablePcAudio = $false
)

$ErrorActionPreference = "SilentlyContinue"

$ProjectDir = "c:\Users\emman\Desktop\Proyectos\AndroProject_Dev"
$AirPlayDir = Join-Path $ProjectDir "androproject-gui\bin\airplay"
$DaemonCjs  = Join-Path $AirPlayDir "daemon.cjs"
$IniFile    = Join-Path $AirPlayDir "airplay_settings.ini"

# 0. Encender Wi-Fi y activar soporte simultaneo de Red Local (HIGUITA) + Red de Datos (Hotspot / Tethering 172.20.10.x / 192.168.137.1)
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
  [Windows.Devices.Radios.Radio,Windows.System.Devices,ContentType=WindowsRuntime] | Out-Null
  [Windows.Devices.Radios.RadioAccessStatus,Windows.System.Devices,ContentType=WindowsRuntime] | Out-Null
  $t1 = $asTaskGeneric.MakeGenericMethod([Windows.Devices.Radios.RadioAccessStatus]).Invoke($null, @([Windows.Devices.Radios.Radio]::RequestAccessAsync()))
  $t1.Wait(-1) | Out-Null
  $t2 = $asTaskGeneric.MakeGenericMethod([System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]]).Invoke($null, @([Windows.Devices.Radios.Radio]::GetRadiosAsync()))
  $t2.Wait(-1) | Out-Null
  $wifi = $t2.Result | Where-Object { $_.Kind -eq 'WiFi' }
  if ($wifi -and $wifi.State -ne 'On') {
    $t3 = $asTaskGeneric.MakeGenericMethod([Windows.Devices.Radios.RadioAccessStatus]).Invoke($null, @($wifi.SetStateAsync('On')))
    $t3.Wait(-1) | Out-Null
    Start-Sleep -Seconds 2
  }
  $wifiIp = Get-NetIPAddress -InterfaceAlias "Wi-Fi" -AddressFamily IPv4 -ErrorAction SilentlyContinue
  if (-not $wifiIp -or ($wifiIp.IPAddress -notlike "192.168.*" -and $wifiIp.IPAddress -notlike "172.20.10.*")) {
    netsh wlan connect name="HIGUITA " | Out-Null
    Start-Sleep -Seconds 2
  }
  # Activar Zona con cobertura inalambrica movil de Windows (192.168.137.1)
  [Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime] | Out-Null
  [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime] | Out-Null
  [Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime] | Out-Null
  $profile = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
  if ($profile) {
    $tm = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($profile)
    if ($tm -and $tm.TetheringOperationalState -ne 'On') {
      $tHot = $asTaskGeneric.MakeGenericMethod([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult]).Invoke($null, @($tm.StartTetheringAsync()))
      $tHot.Wait(4000) | Out-Null
    }
  }
} catch {}

# 1. Configurar variables de entorno GStreamer
$env:PATH = "$AirPlayDir;$AirPlayDir\lib;$AirPlayDir\lib\gstreamer-1.0;$env:PATH"
$env:GST_PLUGIN_PATH = "$AirPlayDir\lib\gstreamer-1.0"
$env:GST_PLUGIN_SYSTEM_PATH = "$AirPlayDir\lib\gstreamer-1.0"
Remove-Item Env:\SDL_AUDIODRIVER -ErrorAction SilentlyContinue

# 2. Configurar LocalVolume: 0 por defecto (Sonido en el Celular) o 1 si se activa -EnablePcAudio (Opcional en PC)
$volValue = if ($EnablePcAudio) { "1" } else { "0" }
$iniContent = @"
[General]
DeviceName=AndroProject [PC]
QualityPreset=0
AutoFullscreenOnConnect=0
OverlayState=0
ShowOverlay=0

[Security]
RequirePin=0
HidePin=0

[Display]
MatchReceiverMonitor=0
CustomWidth=430
CustomHeight=920

[ScreenCast]
Enabled=1
HideInterface=0
CropToVideo=1

[Audio]
AutoAdjust=0
LocalVolume=$volValue
"@
Set-Content -Path $IniFile -Value $iniContent -Encoding UTF8

# 3. Detener primero el supervisor daemon.cjs y luego AirPlayServer para aplicar el modo de audio en airplay2dll.dll sin bloqueo EBUSY
Get-CimInstance Win32_Process | Where-Object { $_.Name -eq "node.exe" -and $_.CommandLine -match "daemon\.cjs|bonjour_broadcaster" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 300
Stop-Process -Name "AirPlayServer" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "uxplay-windows" -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 600

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  ANDROPROJECT - PROYECTOR NATIVO DE ESCRITORIO iOS" -ForegroundColor Green
Write-Host "  [SONIDO EN CELULAR POR DEFECTO | PC OPCIONAL | MULTI-RED]" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 4. Iniciar daemon.cjs (aplica modo audio a airplay2dll.dll + Supervisor Watchdog + Bonjour Multi-Red)
$startup = New-CimInstance -ClassName Win32_ProcessStartup -Property @{ ShowWindow = [uint16]1 } -ClientOnly
$cmdLine = "`"C:\Program Files\nodejs\node.exe`" `"$DaemonCjs`""
$null = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine = $cmdLine
    CurrentDirectory = $AirPlayDir
    ProcessStartupInformation = $startup
}

Start-Sleep -Seconds 2
$proc = Get-Process -Name "AirPlayServer" -ErrorAction SilentlyContinue | Select-Object -First 1

# 5. Traer ventana nativa AirPlay Receiver al frente del escritorio
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class FocusWin {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
[FocusWin]::EnumWindows({
  param($hWnd, $lParam)
  $sb = New-Object System.Text.StringBuilder 256
  [FocusWin]::GetWindowText($hWnd, $sb, 256) | Out-Null
  if ($sb.ToString() -eq 'AirPlay Receiver') {
    [FocusWin]::ShowWindow($hWnd, 9) | Out-Null
    [FocusWin]::SetForegroundWindow($hWnd) | Out-Null
  }
  return $true
}, [IntPtr]::Zero) | Out-Null

$ips = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | ForEach-Object { "$($_.InterfaceAlias)=$($_.IPAddress)" }) -join ", "
$audioDesc = if ($EnablePcAudio) { "PC ACTIVADO (Opcional)" } else { "CELULAR (Por defecto) - Opcional en PC desde Configuracion" }
Write-Host "[OK] Proyector nativo iOS (AirPlay 2) iniciado con PID: $($proc.Id)" -ForegroundColor Green
Write-Host "[REDES ACTIVAS] $ips" -ForegroundColor Green
Write-Host "[MODO DE AUDIO] $audioDesc" -ForegroundColor Green
Write-Host "[INFO] En tu iPhone: Centro de Control -> Duplicar Pantalla -> 'AndroProject [PC]'`n" -ForegroundColor Cyan
