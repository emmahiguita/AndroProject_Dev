@echo off
echo ==============================================================
echo       AndroProject - VINCULACION INALAMBRICA (ANDROID 11+)
echo ==============================================================
echo.
set PATH=%PATH%;C:\msys64\mingw64\bin;C:\Users\emman\AppData\Local\Android\Sdk\platform-tools

adb kill-server

echo EN TU CELULAR: 
echo 1. Entra a Opciones de Desarrollador.
echo 2. Entra al menu de "Depuracion inalambrica".
echo 3. Toca la opcion "Vincular dispositivo con codigo de vinculacion".
echo.
echo Veras un codigo de 6 digitos y abajo una Direccion IP y Puerto.
echo.
set /p IP_PAIR="PASO 1: Escribe la IP y Puerto exactamente como sale (ej. 192.168.1.15:42516): "

echo.
echo Conectando para emparejar... (La consola te pedira el codigo de 6 digitos a continuacion)
adb pair %IP_PAIR%

echo.
echo ==============================================================
echo  EMPAREJAMIENTO COMPLETADO. AHORA VAMOS A INICIAR AndroProject.
echo ==============================================================
echo EN TU CELULAR: 
echo Sal de la ventana del codigo. En la pantalla principal de "Depuracion Inalambrica",
echo abajo del todo dice "Direccion IP y puerto" (OJO: El puerto cambio, es diferente).
echo.
set /p IP_CONNECT="PASO 2: Escribe la NUEVA IP y Puerto para iniciar (ej. 192.168.1.15:39101): "

echo.
echo Conectando dispositivo...
adb connect %IP_CONNECT%

echo.
echo Iniciando AndroProject...
set SCRCPY_SERVER_PATH=AndroProject-server
set SCRCPY_ICON_PATH=AndroProject.png
.\AndroProject.exe

echo.
pause
