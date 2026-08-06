# AndroProject - Instalador Oficial

## Estructura de carpetas

```
AndroProject_Installer/
├── build.ps1          ← EJECUTAR ESTO para generar el instalador
├── installer.sed      ← Configuracion de IExpress (no editar)
├── setup.bat          ← Script que se ejecuta al instalar
├── src/               ← Scripts de la aplicacion
│   ├── iniciar_scrcpy_sin_cable.bat
│   ├── iniciar_scrcpy.bat
│   ├── iniciar_wifi_magico.bat
│   └── emparejar_inalambrico.bat
└── output/            ← Aqui aparece el .exe generado
    └── Instalador_AndroProject.exe
```

## Como generar el instalador

1. Haz clic derecho en **`build.ps1`**
2. Selecciona **"Ejecutar con PowerShell"**
3. Espera a que termine (tarda ~15 segundos)
4. El instalador aparecera en la carpeta **`output/`**

## Que hace el instalador al ejecutarse

1. Pregunta al usuario si desea instalar
2. Crea la carpeta `C:\AndroProject`
3. Extrae los binarios de la app (carpetas `x/` y `app/`)
4. Copia los scripts `.bat`
5. Crea 3 accesos directos en el Escritorio:
   - **AndroProject Inalambrico** (uso diario sin cable)
   - **AndroProject Iniciar Wi-Fi (Cable)** (primera vez o si cambia la IP)
   - **AndroProject (Cable USB)** (conexion por cable)

## Requisitos del sistema

- Windows 10 / 11
- ADB instalado en `C:\Users\emman\AppData\Local\Android\Sdk\platform-tools`
- Celular Oppo con depuracion USB activada
