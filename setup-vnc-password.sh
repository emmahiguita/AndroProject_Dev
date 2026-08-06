#!/bin/bash
# Script para configurar contraseña VNC para Kali Linux
# Útil si prefieres usar VNC en lugar de termux-x11

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Configurar Contraseña VNC${NC}"
echo -e "${BLUE}  para Kali Linux${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Verificar que Kali está instalado
if ! proot-distro list | grep -q "kali"; then
    echo -e "${RED}Error: Kali Linux no está instalado${NC}"
    echo -e "${YELLOW}Ejecuta primero: install-kali-desktop-auto.sh${NC}"
    exit 1
fi

echo -e "${YELLOW}Configurando contraseña VNC para Kali Linux...${NC}"
echo -e "${YELLOW}Se te pedirá que ingreses una contraseña (mínimo 6 caracteres)${NC}"
echo ""

# Configurar contraseña VNC dentro de Kali
proot-distro login kali -- bash -c '
    # Instalar VNC server si no está instalado
    if ! command -v vncserver &> /dev/null; then
        echo "Instalando VNC server..."
        apt update
        apt install -y tigervnc-standalone-server dbus-x11 kali-desktop-xfce
    fi
    
    # Configurar contraseña
    echo ""
    echo "Configurando contraseña VNC..."
    vncpasswd
'

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ¡Contraseña VNC configurada!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Para iniciar el servidor VNC:${NC}"
echo -e "  Ejecuta: ${GREEN}start-kali-vnc${NC}"
echo ""
echo -e "${YELLOW}Para conectarte desde VNC Viewer:${NC}"
echo -e "  - Dirección: ${GREEN}127.0.0.1:5901${NC}"
echo -e "  - Contraseña: ${GREEN}(la que acabas de configurar)${NC}"
echo ""
