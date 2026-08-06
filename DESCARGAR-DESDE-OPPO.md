# 📱 Instrucciones para Descargar e Instalar en Oppo

## 🌐 Servidor HTTP Local Activo

**IP del servidor:** `192.168.0.6:8080`
**Directorio:** `C:\Users\emman\Desktop\Proyectos\AndroProject_Dev`

## 📲 Pasos para Instalar en tu Oppo:

### 1. Conectar tu Oppo a la misma red WiFi
Asegúrate de que tu Oppo esté conectado a la misma red WiFi que tu PC.

### 2. Abrir Termux en tu Oppo

### 3. Dar permisos de almacenamiento
```bash
termux-setup-storage
```

### 4. Descargar el script de instalación
```bash
cd ~
wget http://192.168.0.6:8080/transfer-to-phone.sh
```

### 5. Dar permisos de ejecución
```bash
chmod +x transfer-to-phone.sh
```

### 6. Ejecutar la instalación
```bash
bash transfer-to-phone.sh
```

## 🔄 Opción Alternativa: Copiar y Pegar Directamente

Si no puedes descargar por HTTP, copia este comando completo y pégalo en Termux:

```bash
curl -o ~/install-kali.sh http://192.168.0.6:8080/transfer-to-phone.sh && chmod +x ~/install-kali.sh && bash ~/install-kali.sh
```

## 📦 Archivos Disponibles para Descargar:

- `transfer-to-phone.sh` - Script de instalación completo
- `check-mobile.sh` - Verificar estado del dispositivo
- `create-shortcuts.sh` - Crear accesos directos
- `INSTRUCCIONES-USO.md` - Instrucciones detalladas

## ⚠️ Si no puedes conectar:

1. **Verifica que ambos dispositivos estén en la misma red WiFi**
2. **Desactiva VPN o firewall temporalmente**
3. **Usa la IP alternativa:** `100.66.176.36:8080`

## 🚀 Después de la Instalación:

Una vez instalado, podrás usar:
- `kali-desktop` - Iniciar interfaz gráfica
- `kali-cli` - Iniciar terminal
- `kali` - Entrar a Kali directamente

## 📝 Nota:

El servidor HTTP está corriendo en tu PC. Mantén esta ventana abierta mientras descargas desde el Oppo.
