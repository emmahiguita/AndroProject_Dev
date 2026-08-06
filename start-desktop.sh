#!/data/data/com.termux/files/usr/bin/bash
# Script genérico para iniciar distribuciones Linux con interfaz gráfica
# Soporta Kali, Ubuntu y otras distribuciones instaladas con proot-distro

DISTRIBUCION="${1:-kali}"  # Por defecto usa Kali, puede especificar ubuntu, debian, etc.

echo "Iniciando $DISTRIBUCION con interfaz gráfica..."

# Verificar si la distribución está instalada
if ! proot-distro list | grep -q "$DISTRIBUCION"; then
    echo "Error: $DISTRIBUCION no está instalado"
    echo "Distribuciones disponibles:"
    proot-distro list
    exit 1
fi

# Matar instancias previas para evitar conflictos
pkill -f termux-x11
pkill -f xfce4

# Iniciar servidor X11 con la resolución de pantalla
termux-x11 :0 &
sleep 2

# Iniciar PulseAudio para sonido
pulseaudio --start --load="module-native-protocol-tcp" --exit-idle-time=-1

# Login en la distribución compartiendo carpetas y arrancando XFCE4
proot-distro login $DISTRIBUCION --shared-tmp --bind=/sdcard -- bash -c "
    export DISPLAY=:0
    export PULSE_SERVER=127.0.0.1
    dbus-launch --exit-with-session startxfce4
"
