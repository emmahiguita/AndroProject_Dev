# Firma de desarrollo con una identidad local protegida por Windows DPAPI.
param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][string]$IdentityDirectory
)
$ErrorActionPreference = 'Stop'
$file = Get-Item -LiteralPath $Path
$signTool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" |
    Sort-Object { [version]$_.Directory.Parent.Name } -Descending | Select-Object -First 1
if (-not $signTool) { throw 'Falta SignTool del Windows SDK.' }

# Solo el usuario de Windows que guardo la identidad puede recuperar la clave.
$encrypted = [IO.File]::ReadAllBytes((Join-Path $IdentityDirectory 'identity.dpapi'))
$pfx = [Security.Cryptography.ProtectedData]::Unprotect($encrypted, $null, 'CurrentUser')
try {
    $cert = [Security.Cryptography.X509Certificates.X509Certificate2]::new(
        $pfx, [string]::Empty, [Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet)
} finally { [Array]::Clear($pfx, 0, $pfx.Length) }
$rsa = [Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
$work = Join-Path $env:TEMP ([guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $work)
try {
    # El SDK calcula el resumen Authenticode. La clave permanece en memoria durante la firma.
    $public = Join-Path $work 'public.cer'
    [IO.File]::WriteAllBytes($public, $cert.RawData)
    & $signTool.FullName sign /fd SHA256 /f $public /dg $work $file.FullName
    if ($LASTEXITCODE) { throw 'Fallo al generar el resumen del ejecutable.' }
    $digestPath = Join-Path $work ($file.Name + '.dig')
    $digest = [Convert]::FromBase64String([IO.File]::ReadAllText($digestPath))
    $signature = $rsa.SignHash($digest, 'SHA256', [Security.Cryptography.RSASignaturePadding]::Pkcs1)
    [IO.File]::WriteAllText("$digestPath.signed", [Convert]::ToBase64String($signature))
    & $signTool.FullName sign /fdws /di $work $file.FullName
    if ($LASTEXITCODE) { throw 'Fallo al insertar la firma.' }

    # Windows puede indicar raiz local sin confianza. Todo otro error debe detener el empaquetado.
    $check = Get-AuthenticodeSignature -LiteralPath $file.FullName
    $rootError = [ComponentModel.Win32Exception]::new(-2146762487).Message.Trim()
    if ($check.SignatureType -ne 'Authenticode' -or $check.SignerCertificate.Thumbprint -ne $cert.Thumbprint -or
        ($check.Status -ne 'Valid' -and $check.StatusMessage.Trim() -ne $rootError)) {
        throw "Fallo de verificacion Authenticode. $($check.StatusMessage)"
    }
} finally {
    $rsa.Dispose()
    $cert.Dispose()
    # Todos los temporales son resúmenes públicos dentro de una carpeta exclusiva de esta ejecución.
    Get-ChildItem -LiteralPath $work -File | Remove-Item -Force
    Remove-Item -LiteralPath $work
}
