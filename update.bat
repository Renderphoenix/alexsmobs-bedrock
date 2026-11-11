@echo off
setlocal enabledelayedexpansion
rem Syncs Alex's Mobs 2 (addon\BP, addon\RP) into Minecraft's development pack folders for testing.
rem The old 1.2.x port has its own script in legacy\v1\update.bat (different pack folders, do not enable both).

set "BP_SRC=%~dp0addon\BP"
set "RP_SRC=%~dp0addon\RP"

set "MOJANG_DIR="
if exist "%APPDATA%\Minecraft Bedrock\Users\Shared\games\com.mojang" (
    set "MOJANG_DIR=%APPDATA%\Minecraft Bedrock\Users\Shared\games\com.mojang"
) else if exist "%LOCALAPPDATA%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang" (
    set "MOJANG_DIR=%LOCALAPPDATA%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang"
) else (
    set "MOJANG_DIR=%APPDATA%\Minecraft Bedrock\Users\Shared\games\com.mojang"
)

set "BP_DEST=!MOJANG_DIR!\development_behavior_packs\AlexsMobs2_BP"
set "RP_DEST=!MOJANG_DIR!\development_resource_packs\AlexsMobs2_RP"

echo [1/2] Behavior pack  -^> %BP_DEST%
if not exist "%BP_DEST%" mkdir "%BP_DEST%"
robocopy "%BP_SRC%" "%BP_DEST%" /MIR /FFT /R:1 /W:1 /NFL /NDL /NJH /NJS /nc /ns /np
if %ERRORLEVEL% GTR 7 ( echo [ERROR] BP sync failed & exit /b %ERRORLEVEL% )

echo [2/2] Resource pack  -^> %RP_DEST%
if not exist "%RP_DEST%" mkdir "%RP_DEST%"
robocopy "%RP_SRC%" "%RP_DEST%" /MIR /FFT /R:1 /W:1 /NFL /NDL /NJH /NJS /nc /ns /np
if %ERRORLEVEL% GTR 7 ( echo [ERROR] RP sync failed & exit /b %ERRORLEVEL% )

echo Done. Enable "Alex's Mobs 2" BP + RP on a world (disable the old Alex's Mobs packs: same alexsmobs: ids).
exit /b 0
