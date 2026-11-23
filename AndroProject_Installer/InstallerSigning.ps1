# Resuelve la identidad una sola vez, antes de modificar archivos de salida.
function Get-InstallerCertificate {
    if ($env:SIGN_CERT_PFX) {
        $pfx = Get-Item -LiteralPath $env:SIGN_CERT_PFX -ErrorAction Stop
        $cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
            $pfx.FullName, $env:SIGN_CERT_PASS
        )
    } elseif ($env:SIGN_CERT_THUMBPRINT) {
        $cert = Get-Item -LiteralPath "Cert:\CurrentUser\My\$($env:SIGN_CERT_THUMBPRINT)" -ErrorAction Stop
    } else {
        # SignPath recibe el instalador sin firma y lo firma fuera de este proceso.
        return
    }
    if (-not $cert.HasPrivateKey) { throw 'El certificado indicado carece de clave privada.' }
    return $cert
}

# Relee la firma del archivo final para comprobar identidad, integridad y confianza.
function Set-VerifiedInstallerSignature($Path, $Certificate) {
    $result = Set-AuthenticodeSignature -FilePath $Path -Certificate $Certificate -HashAlgorithm SHA256 -TimestampServer 'http://timestamp.digicert.com' -ErrorAction Stop
    if ($result.Status -ne 'Valid') { throw "Error al firmar $Path. $($result.StatusMessage)" }
    $signature = Get-AuthenticodeSignature -LiteralPath $Path -ErrorAction Stop
    if ($signature.Status -ne 'Valid' -or $signature.SignatureType -ne 'Authenticode' -or
        $signature.SignerCertificate.Thumbprint -ne $Certificate.Thumbprint) {
        throw "Firma inesperada o no verificable en $Path."
    }
}
