//! Validaciones compartidas para acciones que afectan paquetes Android.

/// Comprueba el formato seguro del identificador de paquete antes de invocar ADB.
pub fn is_valid_package(pkg: &str) -> bool {
    let p = pkg.trim();
    !p.is_empty()
        && p.len() <= 160
        && p.contains('.')
        && p.chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
}

/// Identifica componentes Android cuya desactivación o limpieza puede impedir la gestión del dispositivo.
pub fn is_critical_system_package(pkg: &str) -> bool {
    matches!(
        pkg,
        "android"
            | "com.android.systemui"
            | "com.android.settings"
            | "com.android.phone"
            | "com.android.server.telecom"
            | "com.android.providers.settings"
            | "com.android.providers.media"
            | "com.android.providers.telephony"
            | "com.android.providers.contacts"
            | "com.android.permissioncontroller"
            | "com.google.android.gms"
            | "com.google.android.gsf"
            | "com.google.android.permissioncontroller"
    )
}
