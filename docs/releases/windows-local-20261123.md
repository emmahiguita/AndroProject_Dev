# ANDRO-IOS para Windows · 23 de noviembre de 2026

Edición de prueba del panel de dispositivos Android e iOS para Windows x64. El panel utiliza Tauri y un servidor local en Rust. La interfaz de React se distribuye con el instalador. El paquete incluye ADB y el motor de proyección scrcpy.

## Archivos de la edición

| Archivo | Uso |
|---|---|
| `Instalador_ANDRO-IOS-firmado-local.exe` | Instalador de Windows. |
| `ANDRO-IOS-instalador-Windows.zip` | Contiene el mismo instalador. Extraerlo antes de ejecutarlo. |
| `ANDRO-IOS-Studio-Local.cer` | Certificado público para identificar al firmante. |
| `SHA256SUMS.txt` | Huellas SHA-256 del instalador, del ZIP y del certificado. |

El instalador actualiza `C:\AndroProject` y crea el acceso directo **ANDRO-IOS** en el escritorio. Cierra las sesiones activas de ADB y proyección antes de instalar. El panel se encuentra en `C:\AndroProject\Dashboard\ANDRO-IOS.exe`.

## Firma de esta compilación

El instalador, el dashboard y el ejecutable de proyección llevan una firma Authenticode con el certificado autofirmado **ANDRO-IOS Studio Local**. Windows puede mostrar un editor sin confianza. Esta compilación carece de sello de tiempo.

- Huella del certificado mostrada por Windows · `35330B25B442DDAFF77C4C6E31A82046D0DECF2A`
- SHA-256 del instalador · `905703BD4F852A2141ABAF8520714D5C65717050822E5769C62BA787390AC329`

Para comprobar una descarga en PowerShell, abre una terminal en la carpeta del instalador y compara los resultados con las huellas anteriores.

```powershell
$archivo = '.\Instalador_ANDRO-IOS-firmado-local.exe'
Get-FileHash -LiteralPath $archivo -Algorithm SHA256
(Get-AuthenticodeSignature -LiteralPath $archivo).SignerCertificate.Thumbprint
```

## Cambios y comprobaciones

| Área | Resultado |
|---|---|
| Tema claro y oscuro | Se conserva la selección entre ventanas del mismo origen. Los botones admiten etiquetas largas y el campo de la consola tiene mayor contraste. |
| Consola | La interfaz usa el estado comunicado por el servidor para habilitar los motores. Las sugerencias ADB corresponden a consultas permitidas. |
| Backend | Pasaron seis pruebas Rust sobre el router, detección de ADB, origen de peticiones, selección del dispositivo, rutas de archivos y validación previa al flasheo. |
| Interfaz | TypeScript pasó con comprobación de variables y parámetros sin uso. Se retiraron 12 importaciones y cuatro tipos sin referencias. |
| Paquete | Se verificaron tres firmas, los 74 archivos de interfaz y la ejecución de `adb version`. Una copia alterada falló la comprobación de integridad. |

Quedan pendientes las pruebas de instalación y uso de extremo a extremo con un teléfono físico, incluida la navegación entre aplicaciones, la rotación, la proyección y el optimizador. Las pruebas de esta edición no ejecutaron flasheos.

## Código del proyecto

| Ruta | Contenido |
|---|---|
| `androproject-gui/src/` | Pantallas, componentes visuales, estado y llamadas a la API. |
| `androproject-gui/src-tauri/src/` | Ventana nativa, servidor Rust e integración con los dispositivos. |
| `AndroProject_Installer/` | Constructor, scripts de instalación y verificación de firmas. |
| `.github/workflows/windows-release.yml` | Compilación y publicación con credenciales de firma configuradas en GitHub. |
