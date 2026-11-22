# Kali Linux en Termux - Instalación Automatizada

Este proyecto contiene scripts automatizados para instalar Kali Linux NetHunter con interfaz gráfica en tu dispositivo Android usando Termux.

## 📋 Requisitos Previos

- **Dispositivo Android** con al menos 15-20 GB de espacio libre
- **Termux** instalado (disponible en F-Droid)
- **Conexión a internet** estable para la descarga inicial
- **Permisos de almacenamiento** en Termux

## 🚀 Instalación Rápida

### Paso 1: Dar permisos de almacenamiento a Termux

```bash
termux-setup-storage
```

### Paso 2: Copiar el script de instalación

Copia el archivo `install-kali-desktop-auto.sh` a tu dispositivo y colócalo en la carpeta de Termux.

### Paso 3: Ejecutar el script de instalación

```bash
bash install-kali-desktop-auto.sh
```

Este script automáticamente:
- ✅ Actualiza Termux
- ✅ Instala dependencias necesarias
- ✅ Instala Kali Linux NetHunter
- ✅ Configura el entorno gráfico XFCE
- ✅ Crea scripts de acceso directo
- ✅ Configura aliases para uso rápido

## 🎮 Modos de Uso

### Opción 1: Interfaz Gráfica (termux-x11) - Recomendado

```bash
kali-desktop
```

Inicia Kali Linux con interfaz gráfica XFCE usando termux-x11. Es la opción más fluida y nativa para Android.

### Opción 2: Interfaz Gráfica (VNC)

```bash
# Primero configura la contraseña
setup-vnc-password.sh

# Luego inicia el servidor VNC
start-kali-vnc.sh
```

Conecta desde VNC Viewer a `127.0.0.1:5901`.

### Opción 3: Línea de Comandos

```bash
kali-cli
# o simplemente
kali
```

## 📱 Crear Accesos Directos en Android

### Usando Termux:Widgets (Recomendado)

1. Instala **Termux:Widgets** desde F-Droid
2. Ejecuta el script de accesos directos:
   ```bash
   bash create-shortcuts.sh
   ```
3. Añade un widget de Termux:Widgets en tu pantalla de inicio
4. Selecciona los accesos directos disponibles:
   - **Kali Desktop** - Interfaz gráfica
   - **Kali CLI** - Terminal
   - **Kali VNC** - Conexión VNC
   - **Update Kali** - Actualizar sistema

### Acceso Directo Manual

1. En tu pantalla de inicio, mantén presionado
2. Selecciona "Widgets" o "Accesos directos"
3. Busca "Termux"
4. Configura el comando: `~/bin/start-kali-desktop.sh`
5. Nómbralo "Kali Desktop"

## 🛠️ Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `install-kali-desktop-auto.sh` | Instalación completa automatizada |
| `start-kali-desktop.sh` | Iniciar Kali con interfaz gráfica (termux-x11) |
| `start-kali-cli.sh` | Iniciar Kali en modo terminal |
| `start-kali-vnc.sh` | Iniciar servidor VNC |
| `setup-vnc-password.sh` | Configurar contraseña VNC |
| `create-shortcuts.sh` | Crear accesos directos en Android |
| `update-kali.sh` | Actualizar Kali Linux |

## ⌨️ Comandos Rápidos (Aliases)

Después de la instalación, podrás usar estos comandos desde Termux:

```bash
kali-desktop   # Iniciar interfaz gráfica
kali-cli       # Iniciar terminal
kali           # Entrar a Kali directamente
kali-root      # Entrar como root
update-kali    # Actualizar sistema
```

## 🔧 Solución de Problemas

### El script no se ejecuta

Asegúrate de dar permisos de ejecución:
```bash
chmod +x install-kali-desktop-auto.sh
```

### Espacio insuficiente

Kali Linux requiere 15-20 GB libres. Libera espacio en tu dispositivo.

### La interfaz gráfica no inicia

Asegúrate de tener instalado termux-x11:
```bash
pkg install x11-repo termux-x11
```

### Error de conexión VNC

Verifica que la contraseña esté configurada:
```bash
setup-vnc-password.sh
```

## 📦 Software Incluido

Kali Linux viene con:
- **Entorno de escritorio**: XFCE4
- **Navegador**: Firefox ESR
- **Editores**: Leafpad, Geany
- **Herramientas de red**: net-tools
- **Herramientas de pentesting**: Suite completa de Kali

## ⚠️ Notas Importantes

- Mantén Termux abierto mientras usas Kali
- La primera instalación puede tardar 20-30 minutos
- Necesitas conexión a internet para la instalación inicial
- El rendimiento depende de tu dispositivo

## 🔄 Actualización

Para actualizar Kali Linux:
```bash
update-kali
```

## 📚 Recursos Adicionales

- [Termux Wiki](https://wiki.termux.com/)
- [Kali Linux Docs](https://www.kali.org/docs/)
- [proot-distro GitHub](https://github.com/termux/proot-distro)

## 🤝 Contribuciones

Si encuentras problemas o mejoras, siéntete libre de modificar los scripts según tus necesidades.

## ⚖️ Licencia

Este proyecto es de código abierto y libre para uso personal y educativo.

---

**¡Disfruta Kali Linux en tu dispositivo Android!** 🐉
