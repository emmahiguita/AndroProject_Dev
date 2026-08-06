[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=0
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeQuota=0
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName=%TargetName%
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=%PostInstallCmd%
AdminQuietInstCmd=%AdminQuietInstCmd%
UserQuietInstCmd=%UserQuietInstCmd%
SourceFiles=SourceFiles
[Strings]
InstallPrompt=Deseas instalar AndroProject v1.0 en tu PC?
DisplayLicense=
FinishMessage=Instalacion de AndroProject completada exitosamente!
TargetName=output\Instalador_AndroProject.exe
FriendlyName=Instalador AndroProject v1.0
AppLaunched=cmd.exe /c "setup.bat"
PostInstallCmd=<None>
AdminQuietInstCmd=cmd.exe /c "setup.bat"
UserQuietInstCmd=cmd.exe /c "setup.bat"
[SourceFiles]
SourceFiles0=.\
[SourceFiles0]
AndroProject_data.zip=
setup.bat=
src\iniciar_scrcpy_sin_cable.bat=iniciar_scrcpy_sin_cable.bat
src\iniciar_scrcpy.bat=iniciar_scrcpy.bat
src\iniciar_wifi_magico.bat=iniciar_wifi_magico.bat
src\emparejar_inalambrico.bat=emparejar_inalambrico.bat
