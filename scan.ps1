<#
.SYNOPSIS
    Escaneo de red automatizado con nmap
.DESCRIPTION
    Ejecuta nmap -sT contra un target desde Ubuntu en el teléfono.
.PARAMETER Target
    IP o rango a escanear. Default: gateway (192.168.0.1/24)
.EXAMPLE
    .\scan.ps1                          # Escanea la red local
    .\scan.ps1 192.168.1.0/24           # Escanea otro rango
    .\scan.ps1 -Target 10.0.0.1 -Ports 1-1000  # Puertos específicos
#>
param(
    [string]$Target = "192.168.0.0/24",
    [string]$Ports = "",
    [switch]$Aggressive = $false
)

$ADB = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$PHONE = "VGL7MVFMDYQG8T55"

Write-Host "`n  ╔══════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║     NMAP SCAN from OPPO CPH2557  ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════╝`n" -ForegroundColor Cyan

# Verify ADB
$dev = & $ADB devices 2>&1 | Where-Object { $_ -match "$PHONE.*device" }
if (-not $dev) {
    Write-Host "  Conectando..." -ForegroundColor Yellow
    & $ADB connect 192.168.0.13:5555 2>&1 | Out-Null
    Start-Sleep -Seconds 2
}

# Build nmap command
$nmapCmd = "nmap -sT --host-timeout 10s"
if ($Ports) { $nmapCmd += " -p $Ports" }
if ($Aggressive) { $nmapCmd += " -A -T4" }
else { $nmapCmd += " -F" }
$nmapCmd += " $Target 2>&1"

Write-Host "  Target : $Target" -ForegroundColor Yellow
Write-Host "  Command: $nmapCmd" -ForegroundColor Gray
Write-Host ""

# Execute
$result = & $ADB -s $PHONE shell "run-as com.termux /data/data/com.termux/files/usr/bin/bash -c `"PATH=/data/data/com.termux/files/usr/bin proot-distro login ubuntu -- $nmapCmd`"" 2>&1

Write-Host $result
Write-Host "`n  ═══════════════════════════════════`n" -ForegroundColor Cyan
