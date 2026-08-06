#!/bin/bash
# Script para crear accesos directos en Android para Kali Linux
# Crea accesos directos en Termux:Widgets y configuración manual

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Crear Accesos Directos${NC}"
echo -e "${CYAN}  para Kali Linux${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Crear directorio de shortcuts
mkdir -p ~/.shortcuts
mkdir -p ~/bin

echo -e "${YELLOW}Creando accesos directos en Termux:Widgets...${NC}"

# Acceso directo para Kali Desktop (termux-x11)
cat > ~/.shortcuts/Kali\ Desktop << 'EOF'
#!/bin/bash
~/bin/start-kali-desktop.sh
EOF
chmod +x ~/.shortcuts/Kali\ Desktop
echo -e "${GREEN}✓ Kali Desktop${NC}"

# Acceso directo para Kali CLI
cat > ~/.shortcuts/Kali\ CLI << 'EOF'
#!/bin/bash
~/bin/start-kali-cli.sh
EOF
chmod +x ~/.shortcuts/Kali\ CLI
echo -e "${GREEN}✓ Kali CLI${NC}"

# Acceso directo para Kali VNC
cat > ~/.shortcuts/Kali\ VNC << 'EOF'
#!/bin/bash
~/bin/start-kali-vnc.sh
EOF
chmod +x ~/.shortcuts/Kali\ VNC
echo -e "${GREEN}✓ Kali VNC${NC}"

# Acceso directo para actualizar Kali
cat > ~/.shortcuts/Update\ Kali << 'EOF'
#!/bin/bash
~/bin/update-kali.sh
EOF
chmod +x ~/.shortcuts/Update\ Kali
echo -e "${GREEN}✓ Update Kali${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ¡Accesos directos creados!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${CYAN}Para usar los accesos directos:${NC}"
echo ""
echo -e "${YELLOW}Opción 1 - Termux:Widgets (Recomendado):${NC}"
echo -e "  1. Instala Termux:Widgets desde F-Droid"
echo -e "  2. Añade un widget de Termux:Widgets en tu pantalla de inicio"
echo -e "  3. Selecciona los accesos directos creados:"
echo -e "     - ${GREEN}Kali Desktop${NC} (interfaz gráfica)"
echo -e "     - ${GREEN}Kali CLI${NC} (terminal)"
echo -e "     - ${GREEN}Kali VNC${NC} (conexión VNC)"
echo -e "     - ${GREEN}Update Kali${NC} (actualizar sistema)"
echo ""
echo -e "${YELLOW}Opción 2 - Acceso directo manual:${NC}"
echo -e "  1. En tu pantalla de inicio, mantén presionado"
echo -e "  2. Selecciona 'Widgets' o 'Accesos directos'"
echo -e "  3. Busca 'Termux'"
echo -e "  4. Configura el comando: ${GREEN}~/bin/start-kali-desktop.sh${NC}"
echo -e "  5. Nómbralo 'Kali Desktop'"
echo ""
echo -e "${YELLOW}Comandos rápidos desde Termux:${NC}"
echo -e "  ${GREEN}kali-desktop${NC}   - Iniciar interfaz gráfica"
echo -e "  ${GREEN}kali-cli${NC}       - Iniciar terminal"
echo -e "  ${GREEN}kali${NC}           - Entrar a Kali directamente"
echo ""
echo -e "${BLUE}Requisitos para Termux:Widgets:${NC}"
echo -e "  - Permiso de almacenamiento en Termux"
echo -e "  - Termux:Widgets instalado"
echo -e "  - Scripts ejecutables en ~/.shortcuts/"
echo ""
