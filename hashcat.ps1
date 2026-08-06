<#
.SYNOPSIS
    Hashcat cracker desde el teléfono
.EXAMPLE
    .\hashcat.ps1 -Hash "hash.txt" -Wordlist "/opt/arsenal/SecLists/Passwords/rockyou.txt"
    .\hashcat.ps1 -Hash "hashes.txt" -Mode 0 -Wordlist wordlist.txt
#>
param(
    [Parameter(Mandatory)][string]$Hash,
    [string]$Wordlist = "/opt/arsenal/SecLists/Passwords/rockyou.txt",
    [int]$Mode = 0,
    [switch]$Benchmark = $false
)

$ADB = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$PHONE = "VGL7MVFMDYQG8T55"

Write-Host "`n  ╔══════════════════════════════════╗" -ForegroundColor Red
Write-Host "  ║     HASHCAT on OPPO CPH2557      ║" -ForegroundColor Red
Write-Host "  ╚══════════════════════════════════╝`n" -ForegroundColor Red

if ($Benchmark) {
    $cmd = "hashcat -b -m $Mode 2>&1 | head -50"
}
else {
    # Push hash file to phone if local
    if (Test-Path $Hash) {
        Write-Host "  Subiendo $Hash al teléfono..." -ForegroundColor Yellow
        & $ADB -s $PHONE push $Hash /sdcard/hash_target.txt 2>&1 | Out-Null
        $remoteHash = "/sdcard/hash_target.txt"
    }
    else {
        $remoteHash = $Hash
    }
    $cmd = "hashcat -m $Mode -a 0 $remoteHash $Wordlist --force 2>&1 | head -100"
}

$result = & $ADB -s $PHONE shell "run-as com.termux /data/data/com.termux/files/usr/bin/bash -c `"PATH=/data/data/com.termux/files/usr/bin proot-distro login ubuntu -- $cmd`"" 2>&1
Write-Host $result
Write-Host "`n  ═══════════════════════════════════`n" -ForegroundColor Red
