#!/bin/bash
# Script de instalación automatizada de Kali Linux NetHunter en Termux
# Con interfaz gráfica usando termux-x11
# Versión: 2.0 - Mejorado y automatizado

# Colores para salida
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Kali Linux NetHunter Desktop${NC}"
echo -e "${CYAN}  Instalación Automatizada Completa${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Verificar que estamos en Termux
if [ ! -d "/data/data/com.termux" ]; then
    echo -e "${RED}Error: Este script debe ejecutarse en Termux${NC}"
    exit 1
fi

# Verificar almacenamiento disponible
echo -e "${YELLOW}[0/7] Verificando espacio disponible...${NC}"
AVAILABLE_SPACE=$(df -BG ~/ | tail -1 | awk '{print $4}' | sed 's/G//')
if [ "$AVAILABLE_SPACE" -lt 15 ]; then
    echo -e "${RED}Error: Se requieren al menos 15 GB de espacio libre${NC}"
    echo -e "${RED}Espacio disponible: ${AVAILABLE_SPACE} GB${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Espacio disponible: ${AVAILABLE_SPACE} GB${NC}"

# Actualizar paquetes de Termux
echo -e "${YELLOW}[1/7] Actualizando Termux...${NC}"
pkg update -y
pkg upgrade -y

# Instalar dependencias necesarias
echo -e "${YELLOW}[2/7] Instalando dependencias...${NC}"
pkg install -y wget curl git proot-distro pulseaudio termux-x11 x11-repo

# Instalar Kali Linux usando proot-distro
echo -e "${YELLOW}[3/7] Instalando Kali Linux NetHunter...${NC}"
if proot-distro list | grep -q "kali"; then
    echo -e "${GREEN}✓ Kali Linux ya está instalado${NC}"
else
    proot-distro install kali
    echo -e "${GREEN}✓ Kali Linux instalado correctamente${NC}"
fi

# Configurar Kali Linux
echo -e "${YELLOW}[4/7] Configurando Kali Linux...${NC}"
proot-distro login kali -- bash -c '
    apt update
    apt upgrade -y
    apt install -y kali-desktop-xfce xfce4 xfce4-goodies
    apt install -y sudo userland-filesystem-utils
    apt install -y firefox-esr leafpad geany
    apt install -y net-tools
    apt clean
'

echo -e "${GREEN}✓ Kali Linux configurado con escritorio XFCE${NC}"

# Crear directorio para scripts
echo -e "${YELLOW}[5/7] Creando scripts de acceso directo...${NC}"
mkdir -p ~/bin
mkdir -p ~/.shortcuts

# Crear script de inicio con termux-x11
cat > ~/bin/start-kali-desktop.sh << 'EOF'
#!/bin/bash
# Script para iniciar Kali Linux con interfaz gráfica termux-x11

echo "Iniciando Kali Linux NetHunter Desktop..."
echo ""

# Matar instancias previas para evitar conflictos
pkill -f termux-x11
pkill -f xfce4

# Iniciar servidor X11
termux-x11 :0 &
sleep 3

# Iniciar PulseAudio para sonido
pulseaudio --start --load="module-native-protocol-tcp" --exit-idle-time=-1

# Login en Kali compartiendo carpetas y arrancando XFCE4
proot-distro login kali --shared-tmp --bind=/sdcard -- bash -c "
    export DISPLAY=:0
    export PULSE_SERVER=127.0.0.1
    dbus-launch --exit-with-session startxfce4
"

echo ""
echo "Kali Linux Desktop detenido"
EOF

chmod +x ~/bin/start-kali-desktop.sh

# Crear script de inicio CLI
cat > ~/bin/start-kali-cli.sh << 'EOF'
#!/bin/bash
# Script para iniciar Kali Linux en modo CLI

echo "Iniciando Kali Linux NetHunter CLI..."
proot-distro login kali
EOF

chmod +x ~/bin/start-kali-cli.sh

# Crear script de actualización
cat > ~/bin/update-kali.sh << 'EOF'
#!/bin/bash
# Script para actualizar Kali Linux

echo "Actualizando Kali Linux NetHunter..."
proot-distro login kali -- bash -c "
    apt update
    apt upgrade -y
    apt autoremove -y
    apt clean
"
echo "Kali Linux actualizado correctamente"
EOF

chmod +x ~/bin/update-kali.sh

# Crear acceso directo en Termux:Widgets
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

echo -e "${GREEN}✓ Scripts de acceso directo creados${NC}"

# Configurar bashrc
echo -e "${YELLOW}[6/7] Configurando aliases...${NC}"
cat >> ~/.bashrc << 'EOF'

# Kali Linux NetHunter aliases
alias kali='proot-distro login kali'
alias kali-root='proot-distro login --user root kali'
alias kali-desktop='~/bin/start-kali-desktop.sh'
alias kali-cli='~/bin/start-kali-cli.sh'
alias update-kali='~/bin/update-kali.sh'

# Scripts personalizados
export PATH=$PATH:~/bin
EOF

echo -e "${GREEN}✓ Aliases configurados${NC}"

# Crear script de instalación de Termux:Widgets
echo -e "${YELLOW}[7/7] Creando instrucciones de acceso directo...${NC}"
cat > ~/INSTALL-TERMUX-WIDGETS.md << 'EOF'
# Instrucciones para crear accesos directos en Android

## Opción 1: Termux:Widgets (Recomendado)

1. Instala Termux:Widgets desde F-Droid o GitHub
2. Crea un widget en tu pantalla de inicio
3. Selecciona "Termux:Widgets"
4. Elige "Kali Desktop" para iniciar el entorno gráfico
5. Elige "Kali CLI" para iniciar la terminal

## Opción 2: Acceso directo manual

1. Crea un acceso directo en tu pantalla de inicio
2. Selecciona "Actividades" o "Atajos"
3. Busca "Termux"
4. Configura el comando: ~/bin/start-kali-desktop.sh
5. Nómbralo "Kali Desktop"

## Comandos rápidos desde Termux:

- kali-desktop   - Iniciar Kali con interfaz gráfica
- kali-cli       - Iniciar Kali en terminal
- kali           - Entrar a Kali (directo)
- update-kali    - Actualizar Kali Linux

## Requisitos previos:

- Termux con permisos de almacenamiento
- 15-20 GB de espacio libre
- Conexión a internet para la instalación inicial
EOF

echo -e "${GREEN}✓ Instrucciones creadas${NC}"

# Recargar bashrc
source ~/.bashrc

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ¡Instalación completada!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${CYAN}Comandos disponibles:${NC}"
echo -e "  ${GREEN}kali-desktop${NC}   - Iniciar Kali con interfaz gráfica"
echo -e "  ${GREEN}kali-cli${NC}       - Iniciar Kali en terminal"
echo -e "  ${GREEN}kali${NC}           - Entrar a Kali directamente"
echo -e "  ${GREEN}update-kali${NC}    - Actualizar Kali Linux"
echo ""
echo -e "${YELLOW}Para iniciar Kali Desktop:${NC}"
echo -e "  1. Ejecuta: ${GREEN}kali-desktop${NC}"
echo -e "  2. Espera a que cargue el entorno gráfico"
echo -e "  3. ¡Listo! Tendrás Kali Linux con interfaz XFCE"
echo ""
echo -e "${BLUE}Para crear accesos directos en Android:${NC}"
echo -e "  Revisa el archivo: ${GREEN}~/INSTALL-TERMUX-WIDGETS.md${NC}"
echo ""
echo -e "${CYAN}Requisitos:${NC}"
echo -e "  - 15-20 GB de espacio libre"
echo -e "  - Conexión a internet para instalación"
echo -e "  - Termux:Widgets (opcional, para accesos directos)"
echo ""
echo -e "${GREEN}¡Disfruta Kali Linux en tu móvil!${NC}"
echo ""
