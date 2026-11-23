# Instalador de ANDRO-IOS para Windows

El instalador despliega el dashboard, la interfaz web, ADB y scrcpy en `C:\AndroProject`. El acceso directo **ANDRO-IOS** del escritorio abre `Dashboard\ANDRO-IOS.exe`.

[Consultar los archivos, la firma y las pruebas de la edición del 23 de noviembre](../docs/releases/windows-local-20261123.md).

## Compilar desde el repositorio

En Windows x64, prepara las dependencias de Node.js del proyecto, la herramienta Rust para Windows, las herramientas de compilación de Visual Studio y la distribución de scrcpy compatible. El constructor utiliza IExpress de Windows. Desde la raíz del repositorio ejecuta lo siguiente en PowerShell.

```powershell
Push-Location androproject-gui
npm ci
Pop-Location
.\AndroProject_Installer\build.ps1 -ScrcpyReleaseDir 'C:\ruta\a\scrcpy-win64-v4.1'
```

El resultado queda en `AndroProject_Installer/output/Instalador_ANDRO-IOS.exe`. La opción `-SkipTauriBuild` utiliza una exportación y un ejecutable de producción ya compilados.

## Archivos del constructor

| Archivo | Función |
|---|---|
| `build.ps1` | Prepara el runtime, copia el dashboard y empaqueta la instalación. |
| `installer.sed` | Define el paquete de IExpress y el punto de entrada de la instalación. |
| `setup.bat` | Extrae el runtime, copia los lanzadores y crea el acceso directo. |
| `InstallerSigning.ps1` | Resuelve el certificado configurado y verifica la firma de publicación. |
| `Sign-LocalArtifact.ps1` | Firma una compilación de prueba con una identidad local protegida por Windows. |
| `Set-InstallerIcon.ps1` | Aplica el icono antes de firmar el instalador. |
