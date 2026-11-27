//! Traduce las teclas del dashboard a códigos numéricos antes de llamar a ADB.
use super::paths::{run_adb, safe_serial};

/// La API y el IPC comparten esta tabla para aceptar los mismos botones y atajos.
fn key_code(key: &str) -> Option<u16> {
    const KEYS: &[(&str, u16)] = &[
        ("HOME", 3), ("BACK", 4), ("DPAD_UP", 19), ("DPAD_DOWN", 20),
        ("DPAD_LEFT", 21), ("DPAD_RIGHT", 22), ("DPAD_CENTER", 23),
        ("VOLUME_UP", 24), ("VOLUME_DOWN", 25), ("POWER", 26), ("SPACE", 62),
        ("ENTER", 66), ("DEL", 67), ("MEDIA_PLAY_PAUSE", 85), ("VOLUME_MUTE", 164),
        ("APP_SWITCH", 187), ("WAKEUP", 224), ("ALL_APPS", 284),
    ];
    let name = key.strip_prefix("KEYCODE_").unwrap_or(key);
    let numeric = key.parse::<u16>().ok();
    KEYS.iter().find_map(|&(label, code)| (label == name || numeric == Some(code)).then_some(code))
}

/// Exige un destino exacto: ADB sin serial seleccionaría el único móvil conectado.
pub fn validate(serial: &str, key: &str) -> Result<u16, String> {
    if serial.is_empty() || safe_serial(serial) != serial || serial.starts_with("airplay-") || serial.starts_with("apple-") {
        return Err("Selecciona un dispositivo Android válido".into());
    }
    key_code(key).ok_or_else(|| "Tecla Android no admitida".into())
}

/// Espera el resultado del proceso para que un móvil desconectado produzca un error.
pub async fn send(serial: &str, code: u16) -> Result<(), String> {
    let (ok, _, err) = run_adb(&["-s", serial, "shell", "input", "keyevent", &code.to_string()], 3000).await;
    if ok { Ok(()) } else if err.trim().is_empty() { Err("Android rechazó la tecla".into()) } else { Err(err.trim().into()) }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_navigation_before_starting_adb() {
        assert_eq!(validate("CPH2557", "KEYCODE_APP_SWITCH"), Ok(187));
        assert_eq!(validate("host:5555", "284"), Ok(284));
        for (serial, key) in [("", "HOME"), ("airplay-ios", "HOME"), ("a b", "HOME"), ("usb", ""), ("usb", "HOME;"), ("usb", "999")] {
            assert!(validate(serial, key).is_err());
        }
    }
}
