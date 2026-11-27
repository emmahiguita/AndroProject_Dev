param([string]$GuiDir, [string]$Destination)
$ErrorActionPreference = 'Stop'
# El archivo de distribución contiene el receptor y las siete DLL de su versión.
# Seleccionar las entradas exactas evita empaquetar registros del usuario y copias antiguas.
$source = Join-Path $GuiDir 'bin/airplay'
$archive = Join-Path $source 'AirPlay2-Win-x64.zip'
if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) {
    Write-Warning 'Sin distribución AirPlay2-Win-x64.zip. El instalador se generará sin el receptor opcional.'
    return
}
$files = 'AirPlayServer.exe','airplay2dll.dll','avcodec-58.dll','avutil-56.dll','dnssd.dll','msys-2.0.dll','SDL2.dll','swscale-5.dll'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($archive)
try {
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    foreach ($name in $files) {
        $entry = $zip.GetEntry($name)
        if (-not $entry -or -not $entry.Length) { throw "Falta $name en el paquete del receptor." }
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $Destination $name), $true)
    }
    Copy-Item -LiteralPath (Join-Path $source 'LICENSE.rtf') -Destination $Destination
} finally { $zip.Dispose() }
