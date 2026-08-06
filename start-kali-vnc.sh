#!/bin/bash
# Script para iniciar Kali Linux con VNC Server
# Alternativa a termux-x11 para conexión remota

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Iniciando Kali Linux con VNC${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Verificar que Kali está instalado
if ! proot-distro list | grep -q "kali"; then
    echo -e "${RED}Error: Kali Linux no está instalado${NC}"
    echo -e "${YELLOW}Ejecuta primero: install-kali-desktop-auto.sh${NC}"
    exit 1
fi

echo -e "${YELLOW}Iniciando servidor VNC en Kali Linux...${NC}"
echo ""

# Iniciar Kali con VNC
proot-distro login kali -- bash -c '
    # Verificar si VNC está instalado
    if ! command -v vncserver &> /dev/null; then
        echo "VNC no está instalado. Instalando..."
        apt update
        apt install -y tigervnc-standalone-server dbus-x11 kali-desktop-xfce
    fi
    
    # Verificar si hay configuración VNC
    if [ ! -f ~/.vnc/passwd ]; then
        echo "Error: No hay contraseña VNC configurada"
        echo "Ejecuta: setup-vnc-password.sh"
        exit 1
    fi
    
    # Matar instancias previas
    vncserver -kill :1 2>/dev/null
    sleep 1
    
    # Iniciar VNC
    echo "Iniciando servidor VNC en pantalla :1..."
    vncserver :1 -geometry 1920x1080 -depth 24 -localhost no
    
    echo ""
    echo "Servidor VNC iniciado correctamente"
'

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  VNC Server iniciado${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Para conectarte desde VNC Viewer:${NC}"
echo -e "  - Dirección: ${GREEN}127.0.0.1:5901${NC}"
echo -e "  - Contraseña: ${GREEN}(la configurada previamente)${NC}"
echo ""
echo -e "${YELLOW}Para detener el servidor VNC:${NC}"
echo -e "  Ejecuta: ${GREEN}stop-kali-vnc${NC}"
echo ""
echo -e "${BLUE}NOTA: Mantén Termux abierto mientras usas VNC${NC}"
echo ""

# Crear script para detener VNC
cat > ~/bin/stop-kali-vnc.sh << 'EOF'
#!/bin/bash
echo "Deteniendo servidor VNC..."
proot-distro login kali -- bash -c 'vncserver -kill :1'
echo "VNC Server detenido"
EOF
chmod +x ~/bin/stop-kali-vnc.sh
