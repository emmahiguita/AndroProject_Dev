# Samsung A30s (SM-A307G) - Toolkit ADB completo
# Auto-selecciona transporte: WiFi (mDNS) preferido, USB como respaldo.
# Uso:  powershell -ExecutionPolicy Bypass -File samsung-adb.ps1 <op> [args...]
# Ops:  status | wake | sleep | screencap [file] | record [sec] [file]
#       input <text|tap x y|swipe x1 y1 x2 y2|keyevent N> | shell <cmd...>
#       install <apk> | uninstall <pkg> | apps | fstop <pkg>
#       pull <remote> [local] | push <local> <remote>
#       battery | info | open <url|pkg> | reconnect | help

param(
    [Parameter(Position=0)][string]$Op = "status",
    [Parameter(Position=1, ValueFromRemainingArguments=$true)][string[]]$Rest
)

function Resolve-AdbBinary {
    $candidates = @(
        "C:\AndroProject\adb.exe",
        "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
        "C:\Program Files\Android\platform-tools\adb.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    $cmd = Get-Command adb.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return "adb.exe"
}
$AdbPath     = Resolve-AdbBinary
$PhoneSerial = "R58N21SVSPE"
$FallbackIp  = "192.168.0.2:5555"
$TempDir     = "C:\AndroProject\temp"
if (-not (Test-Path $TempDir)) { New-Item -ItemType Directory -Path $TempDir -Force | Out-Null }

function Invoke-AdbTimeout([string]$Arguments, [int]$timeoutSec = 15) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $AdbPath
    $psi.Arguments = $Arguments
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    try {
        $p = [System.Diagnostics.Process]::Start($psi)
        # Lectura asincrona: evita deadlock con salidas grandes (>4KB pipe buffer)
        $outTask = $p.StandardOutput.ReadToEndAsync()
        $errTask = $p.StandardError.ReadToEndAsync()
        if (-not $p.WaitForExit($timeoutSec * 1000)) {
            $p.Kill()
            $p.WaitForExit()
            return @(-1, "TIMEOUT")
        }
        return @($p.ExitCode, ($outTask.Result + $errTask.Result))
    } catch { return @(-2, $_.Exception.Message) }
}

function Resolve-Target {
    # WiFi via mDNS
    $r = Invoke-AdbTimeout "mdns services" 6
    if ($r[0] -eq 0) {
        foreach ($line in ("$($r[1])" -split "`r?`n")) {
            if ($line -match "adb-$PhoneSerial.*\t([0-9.]+:[0-9]+)") {
                $ip = $Matches[1]
                $h = Invoke-AdbTimeout "-s $ip shell echo ok" 5
                if ($h[0] -eq 0) { return $ip }
            }
        }
    }
    # USB como respaldo
    $h = Invoke-AdbTimeout "-s $PhoneSerial shell echo ok" 5
    if ($h[0] -eq 0) { return $PhoneSerial }
    # Ultimo recurso: fallback fijo
    $h = Invoke-AdbTimeout "-s $FallbackIp shell echo ok" 5
    if ($h[0] -eq 0) { return $FallbackIp }
    return $null
}

function Show-Help {
    @"
Toolkit ADB Samsung A30s
  status                     Estado completo (transporte, bateria, pantalla)
  wake                       Encender pantalla y desbloquear
  sleep                      Apagar pantalla
  screencap [file]           Captura de pantalla PNG
  record [sec] [file]        Grabacion de pantalla (def 15s)
  input <...>                text|tap X Y|swipe X1 Y1 X2 Y2|keyevent N
  shell <cmd...>             Comando shell arbitrario
  install <apk>              Instalar APK
  uninstall <pkg>            Desinstalar paquete
  apps                       Listar apps de usuario instaladas
  fstop <pkg>                Forzar detencion de app
  pull <remote> [local]      Copiar archivo del telefono al PC
  push <local> <remote>      Copiar archivo del PC al telefono
  battery                    Estado de bateria
  info                       Informacion completa del dispositivo
  open <url|pkg>             Abrir URL o app
  reconnect                  Forzar reconexion ADB
  help                       Esta ayuda
"@
}

$op = $Op.ToLower()

switch ($op) {
    "help"   { Show-Help }

    "status" {
        $t = Resolve-Target
        if (-not $t) { Write-Error "Telefono no alcanzable (ni WiFi ni USB). Revisa el watchdog."; exit 1 }
        Write-Host "=== Samsung SM-A307G ($t) ==="
        $info = Invoke-AdbTimeout "-s $t shell getprop ro.build.version.release; getprop ro.product.model; cat /proc/uptime" 8
        $lines = ("$($info[1])" -split "`r?`n") | Where-Object { $_ }
        if ($lines.Count -ge 1) { Write-Host "Android: $($lines[0])" }
        if ($lines.Count -ge 2) { Write-Host "Modelo:  $($lines[1])" }
        if ($lines.Count -ge 3) { $up = [double]($lines[2] -split ' ')[0]; Write-Host ("Uptime:  {0:N1} horas" -f ($up/3600)) }
        $bat = Invoke-AdbTimeout "-s $t shell dumpsys battery" 8
        ("$($bat[1])" -split "`r?`n") | Where-Object { $_ -match "level:|status:|temperature:|technology:" } | ForEach-Object { Write-Host ("Bateria: {0}" -f ($_ -replace "^\s+", "")) }
        $scr = Invoke-AdbTimeout "-s $t shell dumpsys display" 8
        if ("$($scr[1])" -match "mGlobalDisplayState=(\w+)") {
            $st = if ($Matches[1] -eq "ON") { "Encendida" } elseif ($Matches[1] -eq "OFF") { "Apagada" } else { $Matches[1] }
            Write-Host "Pantalla: $st"
        }
    }

    "wake" {
        $t = Resolve-Target
        if (-not $t) { Write-Error "No alcanzable"; exit 1 }
        Invoke-AdbTimeout "-s $t shell input keyevent KEYCODE_WAKEUP" 6 | Out-Null
        Invoke-AdbTimeout "-s $t shell input swipe 540 1800 540 700 200" 6 | Out-Null
        Write-Host "Pantalla encendida y desbloqueada."
    }

    "sleep" {
        $t = Resolve-Target
        if (-not $t) { Write-Error "No alcanzable"; exit 1 }
        Invoke-AdbTimeout "-s $t shell input keyevent KEYCODE_SLEEP" 6 | Out-Null
        Write-Host "Pantalla apagada."
    }

    "screencap" {
        $t = Resolve-Target
        if (-not $t) { Write-Error "No alcanzable"; exit 1 }
        $file = if ($Rest.Count -gt 0) { $Rest[0] } else { Join-Path $TempDir "samsung-screen-$(Get-Date -Format yyyyMMdd-HHmmss).png" }
        Invoke-AdbTimeout "-s $t shell screencap -p /sdcard/_tmp_cap.png" 15 | Out-Null
        Invoke-AdbTimeout "-s $t pull /sdcard/_tmp_cap.png `"$file`"" 20 | Out-Null
        Invoke-AdbTimeout "-s $t shell rm /sdcard/_tmp_cap.png" 6 | Out-Null
        if (Test-Path $file) { Write-Host "Captura: $file" } else { Write-Error "Fallo captura" }
    }

    "record" {
        $t = Resolve-Target
        if (-not $t) { Write-Error "No alcanzable"; exit 1 }
        $sec  = if ($Rest.Count -gt 0) { [int]$Rest[0] } else { 15 }
        $file = if ($Rest.Count -gt 1) { $Rest[1] } else { Join-Path $TempDir "samsung-record-$(Get-Date -Format yyyyMMdd-HHmmss).mp4" }
        Invoke-AdbTimeout "-s $t shell screenrecord --time-limit $sec /sdcard/_tmp_rec.mp4" ($sec + 15) | Out-Null
        Invoke-AdbTimeout "-s $t pull /sdcard/_tmp_rec.mp4 `"$file`"" 30 | Out-Null
        Invoke-AdbTimeout "-s $t shell rm /sdcard/_tmp_rec.mp4" 6 | Out-Null
        if (Test-Path $file) { Write-Host "Grabacion ($sec s): $file" } else { Write-Error "Fallo grabacion" }
    }

    "input" {
        $t = Resolve-Target
        if (-not $t) { Write-Error "No alcanzable"; exit 1 }
        $cmd = "input " + ($Rest -join " ")
        $r = Invoke-AdbTimeout "-s $t shell $cmd" 8
        if ($r[0] -ne 0) { Write-Error "Fallo: $($r[1])" } else { Write-Host "OK" }
    }

    "shell" {
        $t = Resolve-Target
        if (-not $t) { Write-Error "No alcanzable"; exit 1 }
        $r = Invoke-AdbTimeout "-s $t shell $($Rest -join ' ')" 20
        Write-Host $r[1]
        exit $r[0]
    }

    "install" {
        $t = Resolve-Target
        if ($Rest.Count -lt 1 -or -not (Test-Path $Rest[0])) { Write-Error "APK no encontrado"; exit 1 }
        $r = Invoke-AdbTimeout "-s $t install -r `"$($Rest[0])`"" 120
        Write-Host $r[1]
        exit $r[0]
    }

    "uninstall" {
        $t = Resolve-Target
        if ($Rest.Count -lt 1) { Write-Error "Falta paquete"; exit 1 }
        $r = Invoke-AdbTimeout "-s $t uninstall $($Rest[0])" 30
        Write-Host $r[1]
        exit $r[0]
    }

    "apps" {
        $t = Resolve-Target
        if (-not $t) { Write-Error "No alcanzable"; exit 1 }
        $r = Invoke-AdbTimeout "-s $t shell pm list packages -3" 10
        "$($r[1])" -split "`r?`n" | Where-Object { $_ -match "^package:" } | ForEach-Object { $_ -replace "^package:", "" }
    }

    "fstop" {
        $t = Resolve-Target
        if ($Rest.Count -lt 1) { Write-Error "Falta paquete"; exit 1 }
        $r = Invoke-AdbTimeout "-s $t shell am force-stop $($Rest[0])" 8
        if ($r[0] -eq 0) { Write-Host "Detenido: $($Rest[0])" } else { Write-Error $r[1] }
    }

    "pull" {
        $t = Resolve-Target
        if ($Rest.Count -lt 1) { Write-Error "Uso: pull <remote> [local]"; exit 1 }
        $local = if ($Rest.Count -gt 1) { $Rest[1] } else { Join-Path $TempDir (Split-Path $Rest[0] -Leaf) }
        $r = Invoke-AdbTimeout "-s $t pull `"$($Rest[0])`" `"$local`"" 60
        Write-Host $r[1]
        exit $r[0]
    }

    "push" {
        $t = Resolve-Target
        if ($Rest.Count -lt 2 -or -not (Test-Path $Rest[0])) { Write-Error "Uso: push <local> <remote>"; exit 1 }
        $r = Invoke-AdbTimeout "-s $t push `"$($Rest[0])`" `"$($Rest[1])`"" 60
        Write-Host $r[1]
        exit $r[0]
    }

    "battery" {
        $t = Resolve-Target
        if (-not $t) { Write-Error "No alcanzable"; exit 1 }
        $r = Invoke-AdbTimeout "-s $t shell dumpsys battery" 8
        ("$($r[1])" -split "`r?`n") | Where-Object { $_ -match "level|status|temperature|technology" } | ForEach-Object { Write-Host ("{0}" -f ($_ -replace "^\s+", "")) }
    }

    "info" {
        $t = Resolve-Target
        if (-not $t) { Write-Error "No alcanzable"; exit 1 }
        $r = Invoke-AdbTimeout "-s $t shell getprop" 8
        ("$($r[1])" -split "`r?`n") | Where-Object { $_ -match "ro\.(product\.model|product\.manufacturer|build\.version\.release|build\.version\.sdk|hardware|serialno)" } | ForEach-Object { Write-Host $_ }
    }

    "open" {
        $t = Resolve-Target
        if ($Rest.Count -lt 1) { Write-Error "Uso: open <url|pkg>"; exit 1 }
        $what = $Rest[0]
        if ($what -match "^https?://") {
            Invoke-AdbTimeout "-s $t shell am start -a android.intent.action.VIEW -d '$what'" 8 | Out-Null
        } else {
            Invoke-AdbTimeout "-s $t shell monkey -p $what -c android.intent.category.LAUNCHER 1" 10 | Out-Null
        }
        Write-Host "Abriendo: $what"
    }

    "reconnect" {
        $r = Invoke-AdbTimeout "reconnect" 8
        Write-Host $r[1]
    }

    default {
        Write-Host "Operacion desconocida: $Op"
        Show-Help
    }
}
