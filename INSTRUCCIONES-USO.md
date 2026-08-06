# 📱 Instrucciones de Uso - Kali Linux en Android

## 🚀 Instalación Rápida (Un Solo Comando)

### Opción 1: Instalación Automatizada Completa

1. **Copia estos archivos a tu dispositivo Android**
2. **Abre Termux**
3. **Navega a la carpeta donde copiaste los scripts**
4. **Ejecuta el script maestro:**

```bash
bash auto-install-kali-complete.sh
```

Este script hará TODO automáticamente:
- ✅ Verificar permisos
- ✅ Actualizar Termux
- ✅ Instalar dependencias
- ✅ Instalar Kali Linux
- ✅ Configurar entorno gráfico
- ✅ Crear accesos directos
- ✅ Configurar comandos rápidos

## 🔍 Verificar Estado del Móvil

Antes de instalar, verifica el estado de tu dispositivo:

```bash
bash check-mobile.sh
```

Este script te mostrará:
- ✅ Espacio disponible
- ✅ Dependencias instaladas
- ✅ Estado de Kali Linux
- ✅ Configuración gráfica
- ✅ Accesos directos creados

## 📱 Crear Accesos Directos en Android

### Método Automático:

```bash
bash create-shortcuts.sh
```

### Método Manual (Termux:Widgets):

1. **Instala Termux:Widgets** desde F-Droid
2. **Añade un widget** en tu pantalla de inicio
3. **Selecciona "Termux:Widgets"**
4. **Elige los accesos directos:**
   - 🖥️ **Kali Desktop** - Interfaz gráfica completa
   - 💻 **Kali CLI** - Terminal de Kali
   - 🌐 **Kali VNC** - Conexión VNC remota
   - 🔄 **Update Kali** - Actualizar sistema

## 🎮 Formas de Usar Kali Linux

### 1. Interfaz Gráfica (Recomendado)

```bash
kali-desktop
```

Inicia Kali con escritorio XFCE completo usando termux-x11.

### 2. Línea de Comandos

```bash
kali-cli
# o simplemente
kali
```

### 3. VNC (Conexión Remota)

```bash
# Primero configura contraseña
setup-vnc-password.sh

# Luego inicia VNC
kali-vnc
```

Conecta desde VNC Viewer a `127.0.0.1:5901`.

## ⌨️ Comandos Rápidos

Después de la instalación, usa estos comandos:

| Comando | Acción |
|---------|--------|
| `kali-desktop` | Iniciar interfaz gráfica |
| `kali-cli` | Iniciar terminal |
| `kali-vnc` | Iniciar servidor VNC |
| `kali` | Entrar a Kali directamente |
| `kali-root` | Entrar como root |
| `update-kali` | Actualizar sistema |

## 🛠️ Scripts Individuales

Si prefieres instalar por partes:

```bash
# Instalación principal
bash install-kali-desktop-auto.sh

# Configurar VNC
bash setup-vnc-password.sh

# Iniciar VNC
bash start-kali-vnc.sh

# Crear accesos directos
bash create-shortcuts.sh

# Iniciar escritorio genérico (soporta Kali, Ubuntu, etc.)
bash start-desktop.sh kali    # Para Kali
bash start-desktop.sh ubuntu  # Para Ubuntu
```

## 📋 Requisitos Previos

### En tu dispositivo Android:
- ✅ **15-20 GB** de espacio libre
- ✅ **Termux** instalado (F-Droid)
- ✅ **Conexión a internet** para instalación
- ✅ **Permisos de almacenamiento** en Termux

### Para dar permisos en Termux:

```bash
termux-setup-storage
```

## 🔧 Solución de Problemas

### "No se detectó Termux"
- Asegúrate de ejecutar los scripts dentro de la app Termux

### "Espacio insuficiente"
- Libera espacio en tu dispositivo (mínimo 15 GB)

### "Dependencias no instaladas"
- Ejecuta: `pkg update && pkg upgrade`
- Luego: `pkg install wget curl git proot-distro x11-repo termux-x11 pulseaudio`

### "Kali no se inicia"
- Verifica la instalación: `bash check-mobile.sh`
- Reinstala si es necesario

### "Sin interfaz gráfica"
- Asegúrate de tener termux-x11: `pkg install x11-repo termux-x11`
- Usa `kali-desktop` en lugar de `kali-cli`

## 📦 Qué incluye Kali Linux

- **Escritorio:** XFCE4 completo
- **Navegador:** Firefox ESR
- **Editores:** Leafpad, Geany
- **Herramientas de red:** net-tools
- **Suite completa de Kali Linux** para pentesting

## ⚠️ Notas Importantes

- **Mantén Termux abierto** mientras usas Kali
- **Primera instalación:** 20-30 minutos
- **Conexión internet:** Solo necesaria para instalación inicial
- **Rendimiento:** Depende de tu dispositivo

## 🔄 Actualización

Para mantener Kali actualizado:

```bash
update-kali
```

## 🎯 Flujo de Trabajo Recomendado

1. **Verificar estado:** `bash check-mobile.sh`
2. **Instalar:** `bash auto-install-kali-complete.sh`
3. **Crear accesos directos:** `bash create-shortcuts.sh`
4. **Iniciar:** `kali-desktop`
5. **¡Disfrutar Kali Linux!**

## 📚 Recursos

- [Termux Wiki](https://wiki.termux.com/)
- [Kali Linux Docs](https://www.kali.org/docs/)
- [proot-distro](https://github.com/termux/proot-distro)

---

**¿Necesitas ayuda?** Revisa el archivo `README-KALI-TERMUX.md` para más detalles técnicos.
