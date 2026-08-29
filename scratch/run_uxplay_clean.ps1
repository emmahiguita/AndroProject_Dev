$AirPlayDir = "c:\Users\emman\Desktop\Proyectos\AndroProject_Dev\androproject-gui\bin\airplay"
$env:PATH = "$AirPlayDir;$AirPlayDir\lib;$env:PATH"
$env:GST_PLUGIN_PATH = "$AirPlayDir\lib\gstreamer-1.0"
Set-Location $AirPlayDir

$proc = Start-Process -FilePath ".\uxplay-windows.exe" -ArgumentList "-n `"AndroProject [PC]`" -nh -vs d3d11videosink -as wasapisink" -RedirectStandardOutput "$PSScriptRoot\uxplay_stdout.log" -RedirectStandardError "$PSScriptRoot\uxplay_stderr.log" -PassThru -NoNewWindow
Wait-Process -InputObject $proc -Timeout 2 -ErrorAction SilentlyContinue
Get-Content "$PSScriptRoot\uxplay_stdout.log" -ErrorAction SilentlyContinue
Get-Content "$PSScriptRoot\uxplay_stderr.log" -ErrorAction SilentlyContinue
