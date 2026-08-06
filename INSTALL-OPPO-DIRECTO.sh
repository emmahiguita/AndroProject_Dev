#!/bin/bash
# Script de instalación directa para Oppo - Copiar y pegar en Termux

echo "🚀 Iniciando instalación de Kali Linux en Oppo..."
echo ""

# Dar permisos de almacenamiento
echo "📱 Configurando permisos de almacenamiento..."
termux-setup-storage

# Actualizar Termux
echo "🔄 Actualizando Termux..."
pkg update -y
pkg upgrade -y

# Instalar dependencias básicas
echo "📦 Instalando dependencias básicas..."
pkg install -y wget curl git proot-distro

# Instalar dependencias gráficas
echo "🖥️ Instalando dependencias gráficas..."
pkg install -y x11-repo termux-x11 pulseaudio

# Instalar Kali Linux
echo "🐉 Instalando Kali Linux (esto puede tardar 20-30 minutos)..."
proot-distro install kali

# Configurar Kali Linux
echo "⚙️ Configurando Kali Linux con entorno gráfico..."
proot-distro login kali -- bash -c '
    apt update
    apt upgrade -y
    apt install -y kali-desktop-xfce xfce4 xfce4-goodies
    apt install -y sudo userland-filesystem-utils
    apt install -y firefox-esr leafpad geany
    apt install -y net-tools
    apt clean
'

# Crear directorios
echo "📁 Creando directorios de scripts..."
mkdir -p ~/bin
mkdir -p ~/.shortcuts

# Script de inicio desktop
echo "🖥️ Creando script de inicio desktop..."
cat > ~/bin/start-kali-desktop.sh << 'SCRIPT'
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
SCRIPT
chmod +x ~/bin/start-kali-desktop.sh

# Script de inicio CLI
echo "💻 Creando script de inicio CLI..."
cat > ~/bin/start-kali-cli.sh << 'SCRIPT'
#!/bin/bash
echo "Iniciando Kali Linux CLI..."
proot-distro login kali
SCRIPT
chmod +x ~/bin/start-kali-cli.sh

# Script de actualización
echo "🔄 Creando script de actualización..."
cat > ~/bin/update-kali.sh << 'SCRIPT'
#!/bin/bash
echo "Actualizando Kali Linux..."
proot-distro login kali -- bash -c "apt update && apt upgrade -y && apt autoremove -y && apt clean"
echo "Kali Linux actualizado"
SCRIPT
chmod +x ~/bin/update-kali.sh

# Crear accesos directos para Termux:Widgets
echo "📱 Creando accesos directos..."
cat > ~/.shortcuts/Kali\ Desktop << 'SCRIPT'
#!/bin/bash
~/bin/start-kali-desktop.sh
SCRIPT
chmod +x ~/.shortcuts/Kali\ Desktop

cat > ~/.shortcuts/Kali\ CLI << 'SCRIPT'
#!/bin/bash
~/bin/start-kali-cli.sh
SCRIPT
chmod +x ~/.shortcuts/Kali\ CLI

# Configurar aliases en bashrc
echo "⌨️ Configurando aliases..."
cat >> ~/.bashrc << 'SCRIPT'

# Kali Linux NetHunter
alias kali='proot-distro login kali'
alias kali-root='proot-distro login --user root kali'
alias kali-desktop='~/bin/start-kali-desktop.sh'
alias kali-cli='~/bin/start-kali-cli.sh'
alias update-kali='~/bin/update-kali.sh'
export PATH=$PATH:~/bin
SCRIPT

# Recargar bashrc
source ~/.bashrc

echo ""
echo "========================================="
echo "✅ ¡Instalación completada!"
echo "========================================="
echo ""
echo "🎮 Comandos disponibles:"
echo "  kali-desktop   - Iniciar interfaz gráfica"
echo "  kali-cli       - Iniciar terminal"
echo "  kali           - Entrar a Kali directamente"
echo "  update-kali    - Actualizar sistema"
echo ""
echo "📱 Para crear accesos directos en Android:"
echo "1. Instala Termux:Widgets desde F-Droid"
echo "2. Añade un widget en tu pantalla de inicio"
echo "3. Selecciona 'Kali Desktop'"
echo ""
echo "🚀 Para iniciar Kali Desktop ahora:"
echo "  kali-desktop"
echo ""
