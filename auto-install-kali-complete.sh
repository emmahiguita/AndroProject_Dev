#!/bin/bash
# Script maestro de instalación completamente automatizada
# Verifica el estado del móvil, instala dependencias, Kali Linux
# y crea accesos directos con un solo comando

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Instalación Automatizada${NC}"
echo -e "${CYAN}  Kali Linux Desktop Completa${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Verificar que estamos en Termux
if [ ! -d "/data/data/com.termux" ]; then
    echo -e "${RED}Error: Este script debe ejecutarse en Termux${NC}"
    exit 1
fi

# Dar permisos de almacenamiento si no los tiene
echo -e "${YELLOW}[Verificación] Configurando permisos...${NC}"
termux-setup-storage 2>/dev/null

# Actualizar Termux
echo -e "${YELLOW}[1/5] Actualizando Termux...${NC}"
pkg update -y
pkg upgrade -y

# Instalar dependencias básicas
echo -e "${YELLOW}[2/5] Instalando dependencias básicas...${NC}"
pkg install -y wget curl git proot-distro

# Instalar dependencias gráficas
echo -e "${YELLOW}[3/5] Instalando dependencias gráficas...${NC}"
pkg install -y x11-repo termux-x11 pulseaudio

# Instalar Kali Linux si no está instalado
echo -e "${YELLOW}[4/5] Instalando Kali Linux...${NC}"
if proot-distro list | grep -q "kali"; then
    echo -e "${GREEN}✓ Kali Linux ya está instalado${NC}"
else
    echo -e "${YELLOW}Instalando Kali Linux (esto puede tardar 20-30 minutos)...${NC}"
    proot-distro install kali
fi

# Configurar Kali Linux
echo -e "${YELLOW}Configurando Kali Linux con entorno gráfico...${NC}"
proot-distro login kali -- bash -c '
    apt update
    apt upgrade -y
    apt install -y kali-desktop-xfce xfce4 xfce4-goodies
    apt install -y sudo userland-filesystem-utils
    apt install -y firefox-esr leafpad geany
    apt install -y net-tools
    apt clean
'

# Crear directorios y scripts
echo -e "${YELLOW}[5/5] Creando scripts y accesos directos...${NC}"
mkdir -p ~/bin
mkdir -p ~/.shortcuts

# Script de inicio desktop
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

# Script de inicio CLI
cat > ~/bin/start-kali-cli.sh << 'EOF'
#!/bin/bash
echo "Iniciando Kali Linux CLI..."
proot-distro login kali
EOF
chmod +x ~/bin/start-kali-cli.sh

# Script de actualización
cat > ~/bin/update-kali.sh << 'EOF'
#!/bin/bash
echo "Actualizando Kali Linux..."
proot-distro login kali -- bash -c "apt update && apt upgrade -y && apt autoremove -y && apt clean"
echo "Kali Linux actualizado"
EOF
chmod +x ~/bin/update-kali.sh

# Script VNC (opcional)
cat > ~/bin/start-kali-vnc.sh << 'EOF'
#!/bin/bash
echo "Iniciando Kali VNC..."
proot-distro login kali -- bash -c '
    if ! command -v vncserver &> /dev/null; then
        apt install -y tigervnc-standalone-server dbus-x11 kali-desktop-xfce
    fi
    vncserver -kill :1 2>/dev/null
    sleep 1
    vncserver :1 -geometry 1920x1080 -depth 24 -localhost no
'
echo "VNC Server iniciado en 127.0.0.1:5901"
EOF
chmod +x ~/bin/start-kali-vnc.sh

# Crear accesos directos en Termux:Widgets
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

cat > ~/.shortcuts/Kali\ VNC << 'EOF'
#!/bin/bash
~/bin/start-kali-vnc.sh
EOF
chmod +x ~/.shortcuts/Kali\ VNC

# Configurar aliases
cat >> ~/.bashrc << 'EOF'

# Kali Linux NetHunter
alias kali='proot-distro login kali'
alias kali-root='proot-distro login --user root kali'
alias kali-desktop='~/bin/start-kali-desktop.sh'
alias kali-cli='~/bin/start-kali-cli.sh'
alias kali-vnc='~/bin/start-kali-vnc.sh'
alias update-kali='~/bin/update-kali.sh'
export PATH=$PATH:~/bin
EOF

source ~/.bashrc

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ¡Instalación Completada!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${CYAN}Comandos disponibles:${NC}"
echo -e "  ${GREEN}kali-desktop${NC}   - Iniciar interfaz gráfica"
echo -e "  ${GREEN}kali-cli${NC}       - Iniciar terminal"
echo -e "  ${GREEN}kali-vnc${NC}       - Iniciar servidor VNC"
echo -e "  ${GREEN}kali${NC}           - Entrar a Kali directamente"
echo -e "  ${GREEN}update-kali${NC}    - Actualizar sistema"
echo ""
echo -e "${YELLOW}Para crear accesos directos en Android:${NC}"
echo -e "  1. Instala Termux:Widgets desde F-Droid"
echo -e "  2. Añade un widget de Termux:Widgets en tu pantalla de inicio"
echo -e "  3. Selecciona: ${GREEN}Kali Desktop${NC}"
echo ""
echo -e "${BLUE}¡Kali Linux está listo para usar!${NC}"
echo ""
