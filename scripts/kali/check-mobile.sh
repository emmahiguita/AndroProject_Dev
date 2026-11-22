#!/bin/bash
# Script para verificar el estado del móvil y lo que está instalado
# Detecta Termux, espacio, dependencias y estado de Kali Linux

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Verificación del Sistema${NC}"
echo -e "${CYAN}  para Kali Linux en Termux${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Verificar si estamos en Termux
echo -e "${YELLOW}[1/8] Verificando entorno Termux...${NC}"
if [ -d "/data/data/com.termux" ]; then
    echo -e "${GREEN}✓ Termux detectado${NC}"
    TERMUX_VERSION=$(pkg version termux 2>/dev/null || echo "desconocido")
    echo -e "  Versión: ${BLUE}$TERMUX_VERSION${NC}"
else
    echo -e "${RED}✗ No se detectó Termux${NC}"
    echo -e "${YELLOW}Este script debe ejecutarse en Termux${NC}"
    exit 1
fi

# Verificar espacio disponible
echo -e "${YELLOW}[2/8] Verificando espacio disponible...${NC}"
AVAILABLE_SPACE=$(df -BG ~/ | tail -1 | awk '{print $4}' | sed 's/G//')
if [ "$AVAILABLE_SPACE" -ge 15 ]; then
    echo -e "${GREEN}✓ Espacio suficiente: ${AVAILABLE_SPACE} GB${NC}"
else
    echo -e "${RED}✗ Espacio insuficiente: ${AVAILABLE_SPACE} GB${NC}"
    echo -e "${YELLOW}Se requieren al menos 15 GB libres${NC}"
fi

# Verificar permisos de almacenamiento
echo -e "${YELLOW}[3/8] Verificando permisos de almacenamiento...${NC}"
if [ -d "/sdcard" ] || [ -d "/storage/emulated/0" ]; then
    echo -e "${GREEN}✓ Permiso de almacenamiento concedido${NC}"
else
    echo -e "${RED}✗ Sin permiso de almacenamiento${NC}"
    echo -e "${YELLOW}Ejecuta: termux-setup-storage${NC}"
fi

# Verificar dependencias básicas
echo -e "${YELLOW}[4/8] Verificando dependencias básicas...${NC}"
DEPS_OK=true
for dep in wget curl git proot-distro; do
    if command -v $dep &> /dev/null; then
        echo -e "${GREEN}✓ $dep${NC}"
    else
        echo -e "${RED}✗ $dep (no instalado)${NC}"
        DEPS_OK=false
    fi
done

# Verificar dependencias gráficas
echo -e "${YELLOW}[5/8] Verificando dependencias gráficas...${NC}"
GRAPHICS_OK=true
for dep in termux-x11 pulseaudio; do
    if command -v $dep &> /dev/null; then
        echo -e "${GREEN}✓ $dep${NC}"
    else
        echo -e "${RED}✗ $dep (no instalado)${NC}"
        GRAPHICS_OK=false
    fi
done

# Verificar Kali Linux
echo -e "${YELLOW}[6/8] Verificando Kali Linux...${NC}"
if proot-distro list | grep -q "kali"; then
    echo -e "${GREEN}✓ Kali Linux instalado${NC}"
    
    # Verificar estado de Kali
    if proot-distro login kali -- command -v startxfce4 &> /dev/null; then
        echo -e "${GREEN}✓ Entorno gráfico XFCE instalado${NC}"
    else
        echo -e "${YELLOW}⚠ Entorno gráfico no configurado${NC}"
    fi
    
    # Verificar VNC
    if proot-distro login kali -- command -v vncserver &> /dev/null; then
        echo -e "${GREEN}✓ VNC server instalado${NC}"
        if proot-distro login kali -- test -f ~/.vnc/passwd; then
            echo -e "${GREEN}✓ Contraseña VNC configurada${NC}"
        else
            echo -e "${YELLOW}⚠ Contraseña VNC no configurada${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ VNC server no instalado${NC}"
    fi
else
    echo -e "${RED}✗ Kali Linux no instalado${NC}"
fi

# Verificar scripts personalizados
echo -e "${YELLOW}[7/8] Verificando scripts personalizados...${NC}"
if [ -d "$HOME/bin" ]; then
    echo -e "${GREEN}✓ Directorio ~/bin existe${NC}"
    for script in start-kali-desktop.sh start-kali-cli.sh update-kali.sh; do
        if [ -f "$HOME/bin/$script" ]; then
            echo -e "${GREEN}✓ $script${NC}"
        else
            echo -e "${YELLOW}⚠ $script (no existe)${NC}"
        fi
    done
else
    echo -e "${YELLOW}⚠ Directorio ~/bin no existe${NC}"
fi

# Verificar accesos directos
echo -e "${YELLOW}[8/8] Verificando accesos directos...${NC}"
if [ -d "$HOME/.shortcuts" ]; then
    echo -e "${GREEN}✓ Directorio ~/.shortcuts existe${NC}"
    SHORTCUT_COUNT=$(ls "$HOME/.shortcuts/" 2>/dev/null | wc -l)
    echo -e "  Accesos directos: ${BLUE}$SHORTCUT_COUNT${NC}"
else
    echo -e "${YELLOW}⚠ Directorio ~/.shortcuts no existe${NC}"
fi

# Resumen
echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Resumen del Estado${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

if [ "$DEPS_OK" = true ] && [ "$GRAPHICS_OK" = true ] && proot-distro list | grep -q "kali"; then
    echo -e "${GREEN}✓ Sistema listo para usar Kali Linux${NC}"
    echo ""
    echo -e "${YELLOW}Para iniciar Kali Desktop:${NC}"
    echo -e "  ${GREEN}kali-desktop${NC}"
    echo ""
    echo -e "${YELLOW}Para iniciar Kali CLI:${NC}"
    echo -e "  ${GREEN}kali-cli${NC}"
else
    echo -e "${YELLOW}⚠ Sistema requiere configuración${NC}"
    echo ""
    
    if [ "$DEPS_OK" = false ]; then
        echo -e "${RED}Instalar dependencias básicas:${NC}"
        echo -e "  ${GREEN}pkg install wget curl git proot-distro${NC}"
        echo ""
    fi
    
    if [ "$GRAPHICS_OK" = false ]; then
        echo -e "${RED}Instalar dependencias gráficas:${NC}"
        echo -e "  ${GREEN}pkg install x11-repo termux-x11 pulseaudio${NC}"
        echo ""
    fi
    
    if ! proot-distro list | grep -q "kali"; then
        echo -e "${RED}Instalar Kali Linux:${NC}"
        echo -e "  ${GREEN}bash install-kali-desktop-auto.sh${NC}"
        echo ""
    fi
fi

echo -e "${CYAN}========================================${NC}"
echo ""
