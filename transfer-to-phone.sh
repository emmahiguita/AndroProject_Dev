#!/bin/bash
# Script para transferir e instalar Kali Linux en el Oppo
# Ejecutar este script en Termux del Oppo

echo "Iniciando instalación de Kali Linux en Oppo..."
echo ""

# Dar permisos de almacenamiento
termux-setup-storage

# Actualizar Termux
pkg update -y
pkg upgrade -y

# Instalar dependencias
pkg install -y wget curl git proot-distro x11-repo termux-x11 pulseaudio

# Instalar Kali Linux
echo "Instalando Kali Linux (esto puede tardar 20-30 minutos)..."
proot-distro install kali

# Configurar Kali
echo "Configurando Kali Linux con entorno gráfico..."
proot-distro login kali -- bash -c '
    apt update
    apt upgrade -y
    apt install -y kali-desktop-xfce xfce4 xfce4-goodies
    apt install -y sudo userland-filesystem-utils
    apt install -y firefox-esr leafpad geany
    apt install -y net-tools
    apt clean
'

# Crear scripts
mkdir -p ~/bin
mkdir -p ~/.shortcuts

# Script desktop
cat > ~/bin/start-kali-desktop.sh << 'EOF'
#!/bin/bash
echo "Iniciando Kali Linux Desktop..."
pkill -f termux-x11 2>/dev/null
pkill -f xfce4 2>/dev/null
termux-x11 :0 &
sleep 3
pulseaudio --start --load="module-native-protocol-tcp" --exit-idle-time=-1
proot-distro login kali --shared-tmp --bind=/sdcard -- bash -c "
    export DISPLAY=:0
    export PULSE_SERVER=127.0.0.1
    dbus-launch --exit-with-session startxfce4
"
EOF
chmod +x ~/bin/start-kali-desktop.sh

# Script CLI
cat > ~/bin/start-kali-cli.sh << 'EOF'
#!/bin/bash
echo "Iniciando Kali Linux CLI..."
proot-distro login kali
EOF
chmod +x ~/bin/start-kali-cli.sh

# Script actualización
cat > ~/bin/update-kali.sh << 'EOF'
#!/bin/bash
echo "Actualizando Kali Linux..."
proot-distro login kali -- bash -c "apt update && apt upgrade -y && apt autoremove -y && apt clean"
echo "Kali Linux actualizado"
EOF
chmod +x ~/bin/update-kali.sh

# Accesos directos
cat > ~/.shortcuts/Kali\ Desktop << 'EOF'
#!/bin/bash
~/bin/start-kali-desktop.sh
EOF
chmod +x ~/.shortcuts/Kali\ Desktop

cat > ~/.shortcuts/Kali\ CLI << 'EOF'
#!/bin/bash
~/bin/start-kali-cli.sh
EOF
chmod +x ~/.shortcuts/Kali\ CLI

# Configurar aliases
cat >> ~/.bashrc << 'EOF'

# Kali Linux NetHunter
alias kali='proot-distro login kali'
alias kali-root='proot-distro login --user root kali'
alias kali-desktop='~/bin/start-kali-desktop.sh'
alias kali-cli='~/bin/start-kali-cli.sh'
alias update-kali='~/bin/update-kali.sh'
export PATH=$PATH:~/bin
EOF

source ~/.bashrc

echo ""
echo "========================================="
echo "¡Instalación completada!"
echo "========================================="
echo ""
echo "Comandos disponibles:"
echo "  kali-desktop   - Iniciar interfaz gráfica"
echo "  kali-cli       - Iniciar terminal"
echo "  kali           - Entrar a Kali directamente"
echo "  update-kali    - Actualizar sistema"
echo ""
echo "Para crear accesos directos en Android:"
echo "1. Instala Termux:Widgets desde F-Droid"
echo "2. Añade un widget en tu pantalla de inicio"
echo "3. Selecciona 'Kali Desktop'"
echo ""
