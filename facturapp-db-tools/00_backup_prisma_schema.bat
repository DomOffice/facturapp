@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ============================================================
rem FacturApp - Sauvegarde du fichier prisma/schema.prisma
rem
rem Ce script :
rem - ne se connecte pas a PostgreSQL ;
rem - ne modifie pas la base ;
rem - ne lance aucune commande Prisma ;
rem - cree uniquement une copie horodatee du schema.
rem ============================================================

rem A ADAPTER :
rem Chemin vers la racine du projet FacturApp.
set "FACTURAPP_DIR=C:\Users\Berrada\Documents\facturapp"

set "SCHEMA_FILE=%FACTURAPP_DIR%\prisma\schema.prisma"
set "SCRIPT_DIR=%~dp0"
set "BACKUP_DIR=%SCRIPT_DIR%backups_schema"

echo.
echo ============================================================
echo SAUVEGARDE DU SCHEMA PRISMA
echo ============================================================
echo Projet  : %FACTURAPP_DIR%
echo Source  : %SCHEMA_FILE%
echo.

if not exist "%FACTURAPP_DIR%" (
  echo ERREUR : le dossier du projet FacturApp est introuvable.
  echo.
  echo Chemin configure :
  echo %FACTURAPP_DIR%
  echo.
  echo Modifie FACTURAPP_DIR en haut du fichier.
  pause
  exit /b 1
)

if not exist "%SCHEMA_FILE%" (
  echo ERREUR : le fichier schema.prisma est introuvable.
  echo.
  echo Fichier attendu :
  echo %SCHEMA_FILE%
  pause
  exit /b 1
)

if not exist "%BACKUP_DIR%" (
  mkdir "%BACKUP_DIR%"

  if errorlevel 1 (
    echo ERREUR : impossible de creer le dossier :
    echo %BACKUP_DIR%
    pause
    exit /b 1
  )
)

for /f %%I in (
  'powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"'
) do set "STAMP=%%I"

set "BACKUP_FILE=%BACKUP_DIR%\schema_%STAMP%.prisma.backup"

copy /Y "%SCHEMA_FILE%" "%BACKUP_FILE%" >nul

if errorlevel 1 (
  echo.
  echo ECHEC : la sauvegarde du schema Prisma a echoue.
  pause
  exit /b 1
)

echo.
echo SUCCES : schema Prisma sauvegarde.
echo.
echo Fichier :
echo %BACKUP_FILE%
echo.
echo IMPORTANT :
echo Cette sauvegarde ne remplace pas une sauvegarde PostgreSQL.
echo Elle protege uniquement prisma\schema.prisma.
echo.

pause
endlocal