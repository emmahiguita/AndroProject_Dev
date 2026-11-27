# Auditoría de ANDRO-IOS para Windows · 25 de noviembre de 2026

La edición con firma local tiene funciones reales y defectos reproducibles por inspección del código. Las pruebas disponibles no acreditan funcionamiento completo.

## Qué se comprobó

- Se revisaron las diez secciones de `androproject-gui/src/app/page.tsx`, las vistas auxiliares de cámara e iOS, sus llamadas y el router Axum.
- Pasaron las seis pruebas Rust del proyecto y TypeScript con `--noUnusedLocals --noUnusedParameters`. Las pruebas de flasheo comprueban el rechazo de entradas inválidas.
- El OPPO A79 5G, modelo CPH2557 con Android 15, respondió al inventario de aplicaciones por la conexión móvil de auditoría. La consola de esta sesión no pudo abrir el socket del servidor ADB ni consultar el puerto 3000 del dashboard. Por tanto, ese inventario confirma el teléfono, pero queda pendiente el recorrido desde un botón del dashboard hasta el OPPO.
- El dashboard instalado tiene otra firma y su ventana no estaba abierta. La revisión visual de esta edición se basa en componentes, estilos, eventos y estados del código. Quedan pendientes la inspección en pantalla con ambos temas, el cambio de aplicaciones durante la proyección y la rotación física.

## Resultados por módulo

| Módulo | Evidencia y efecto observable esperado |
|---|---|
| Dashboard | Consulta `/api/device` y obtiene telemetría por serial. Si falla `adb devices -l`, el backend entrega una lista vacía. El usuario puede ver el mismo estado cuando el servidor ADB falla y cuando realmente ha desconectado el teléfono. |
| Proyección y ventana flotante | Inicio, Atrás y Recientes tienen eventos enlazados a ADB. El handler de teclado incorpora el valor recibido a un comando de shell sin limitarlo a las teclas admitidas. La barra de navegación y el campo de texto usan fondos oscuros fijos. El lanzamiento de scrcpy por la ruta `build_screen_args` incluye `--no-audio`. Queda por verificar la reproducción y el control en horizontal con el ejecutable firmado. |
| Aplicaciones | El listado consulta al gestor de paquetes de Android. Lanzar, detener y extraer APK tienen implementaciones. El endpoint de iconos responde siempre 404. El listado construye el nombre visible a partir del identificador del paquete y no devuelve tamaño ni fecha. |
| Flasher | Hay lógica ADB/Fastboot y validaciones para imágenes y particiones. Pasó la prueba de rechazo de destinos inválidos. No se hizo ninguna escritura, desbloqueo ni reinicio del móvil. |
| Curar y seguridad | El escáner busca términos en los nombres de paquetes. Un resultado es un indicio heurístico. El botón de parcheo invoca `/api/patch-app`, ausente en el router. La petición llega al 404 de API. |
| Archivos | Listar, subir, descargar y eliminar tienen rutas propias o compartidas con validación de serial y ruta. Pasaron pruebas de rutas inválidas y de nombres con apóstrofos. Falta transferir un archivo de prueba desde la interfaz y comparar sus bytes. |
| Herramientas | Hay consultas de diagnóstico y controladores. La pantalla presenta `Li-ion` si falta el dato de tecnología de batería, por lo que puede atribuir al teléfono una característica sin haberla leído. |
| CLI | El backend admite cuatro consultas ADB de diagnóstico. La detección usa el ejecutable ADB. Los proveedores Claude, Ollama y CLI de sistema carecen de ejecución integrada en este backend. Se probaron detección, rechazo de origen ajeno y rechazo sin serial. |
| Optimizador | Las acciones de mantenimiento y varios ajustes tienen implementaciones ADB. La carga general espera campos como `dpi` y `screenTimeout` que `get_optimizer_settings` omite. Otros paneles hacen consultas propias. Hay que comprobar qué valor termina mostrando cada control tras desconectar o cambiar de dispositivo. |
| Configuración | Lee rutas y ajustes y envía cambios a `/api/config` o `/api/actions`. La carga sólo actualiza el estado cuando recibe `success`. Un fallo comunicado en JSON puede dejar en pantalla datos de la lectura anterior. |
| Cámara WebRTC | El procesamiento depende de Vision Backend en el puerto 8000. La vista tiene comprobación de salud, permiso de cámara y negociación de sesión. Falta una sesión real con retorno de vídeo. |
| iOS y AirPlay | `/api/ios` devuelve de forma fija que la detección no está implementada, con lista USB vacía y WDA inactivo. AirPlay tiene un endpoint independiente para el receptor. No se probó un iPhone. |

## Hallazgos que conviene corregir primero

1. Validar las teclas en Rust antes de enviarlas a Android y devolver error ante valores desconocidos. En el arranque, verificar la identidad del servicio local. Hoy basta con que cualquier proceso escuche en el puerto 3000 para que el dashboard omita iniciar su servidor.
2. Mostrar el parcheo y la detección iOS como funciones no disponibles en esta edición. Distinguir un error de ADB de una lista de dispositivos realmente vacía.
3. Mostrar «Sin lectura» en telemetría ausente y limpiar los valores del dispositivo anterior al fallar una lectura. Alinear las propiedades que intercambian el optimizador y su API.
4. Probar la misma edición firmada de extremo a extremo con el OPPO. Registrar Inicio, Recientes, cambio de aplicación, rotación, reconexión y cierre de la proyección. Observar el estado de los procesos hijos tras cerrar. Esta auditoría no demuestra ausencia de procesos huérfanos.

## Certificado

El SHA-256 del instalador local coincide con el publicado en la ficha de la compilación. Windows encontró el certificado incrustado. Informó una raíz sin confianza y el archivo carece de sello de tiempo.

| Elemento | Valor comprobado |
|---|---|
| Instalador examinado | `Instalador_ANDRO-IOS-firmado-local.exe` |
| SHA-256 | `905703BD4F852A2141ABAF8520714D5C65717050822E5769C62BA787390AC329` |
| Huella de su firmante | `35330B25B442DDAFF77C4C6E31A82046D0DECF2A` |
| Huella del dashboard instalado en Windows | `60B927C4314D0EDF0FCFB4DDE0B006BDF851C559` |

El archivo descargado por el usuario desde GitHub no se identificó por su hash en esta auditoría. Una captura o el texto exacto de la pantalla azul permitiría distinguir un aviso de Windows de una ventana vacía de la aplicación.

## Referencias del código

- [Arranque y ventana flotante](../androproject-gui/src-tauri/src/main.rs) · [Registro de rutas](../androproject-gui/src-tauri/src/server/mod.rs) · [Eventos Android](../androproject-gui/src-tauri/src/server/actions_api.rs)
- [Navegación del móvil](../androproject-gui/src/components/layout/DeviceNavControls.tsx) · [Lectura del dispositivo](../androproject-gui/src-tauri/src/server/device_api.rs)
- [Botón de parcheo](../androproject-gui/src/features/curar/ScreenshotPanel.tsx) · [Peticiones de acciones](../androproject-gui/src/hooks/actionApi.ts) · [Backend de aplicaciones](../androproject-gui/src-tauri/src/server/apps_api.rs)
- [API iOS y escáner](../androproject-gui/src-tauri/src/server/system_api.rs) · [Consultas de la CLI](../androproject-gui/src-tauri/src/server/cli_api.rs)
- [Estado del optimizador](../androproject-gui/src/features/OptimizerView.tsx) · [Respuesta de ajustes](../androproject-gui/src-tauri/src/server/extra_actions.rs) · [Diagnóstico visual](../androproject-gui/src/features/ToolsView.tsx)
