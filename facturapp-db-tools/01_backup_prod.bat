@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ============================================================
rem FacturApp - Sauvegarde PostgreSQL de la production
rem FacturApp - Sauvegarde de la base serveur PostgreSQL
rem
rem Ce script lit la base de production avec pg_dump.
rem Il ne modifie aucune donnee.
rem
rem Le mot de passe sera demande par pg_dump.
rem ============================================================

rem ============================================================
rem PARAMETRES A ADAPTER
rem ============================================================
set "PG_BIN=C:\Program Files\PostgreSQL\18\bin"
set "PROD_HOST=localhost"
set "PROD_PORT=5432"
set "PROD_DB=facturapp_db"
set "PROD_USER=postgres"

rem ============================================================
rem DOSSIERS
rem ============================================================

set "SCRIPT_DIR=%~dp0"
set "BACKUP_DIR=%SCRIPT_DIR%backups"

if not exist "%PG_BIN%\pg_dump.exe" (
  echo.
  echo ERREUR : pg_dump.exe est introuvable.
  echo.
  echo Chemin configure :
  echo %PG_BIN%
  echo.
  echo Modifie PG_BIN en haut du fichier.
  pause
  exit /b 1
)

if not exist "%BACKUP_DIR%" (
  mkdir "%BACKUP_DIR%"

  if errorlevel 1 (
    echo.
    echo ERREUR : impossible de creer le dossier :
    echo %BACKUP_DIR%
    pause
    exit /b 1
  )
)

for /f %%I in (
  'powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"'
) do set "STAMP=%%I"

set "BACKUP_FILE=%BACKUP_DIR%\facturapp_prod_%STAMP%.dump"

echo.
echo ============================================================
echo SAUVEGARDE DE LA BASE DE PRODUCTION
echo ============================================================
echo.
echo Serveur    : %PROD_HOST%
echo Port       : %PROD_PORT%
echo Base       : %PROD_DB%
echo Utilisateur: %PROD_USER%
echo Destination:
echo %BACKUP_FILE%
echo.
echo ATTENTION :
echo Verifie que ces informations correspondent bien a PROD.
echo.

choice /C ON /N /M "Continuer la sauvegarde ? [O/N] : "

if errorlevel 2 (
  echo.
  echo Operation annulee.
  pause
  exit /b 0
)

echo.
echo Le mot de passe demande est celui de PostgreSQL PROD.
echo.

"%PG_BIN%\pg_dump.exe" ^
  --host="%PROD_HOST%" ^
  --port="%PROD_PORT%" ^
  --username="%PROD_USER%" ^
  --format=custom ^
  --compress=9 ^
  --no-owner ^
  --no-privileges ^
  --exclude-table-data=public._prisma_migrations ^
  --file="%BACKUP_FILE%" ^
  "%PROD_DB%"

if errorlevel 1 (
  echo.
  echo ECHEC : la sauvegarde n'a pas ete creee correctement.

  if exist "%BACKUP_FILE%" (
    echo Suppression du fichier incomplet.
    del /Q "%BACKUP_FILE%"
  )

  pause
  exit /b 1
)

if not exist "%BACKUP_FILE%" (
  echo.
  echo ECHEC : le fichier de sauvegarde est introuvable.
  pause
  exit /b 1
)

for %%F in ("%BACKUP_FILE%") do set "BACKUP_SIZE=%%~zF"

if "%BACKUP_SIZE%"=="0" (
  echo.
  echo ECHEC : le fichier de sauvegarde est vide.
  del /Q "%BACKUP_FILE%"
  pause
  exit /b 1
)

echo.
echo ============================================================
echo SAUVEGARDE TERMINEE
echo ============================================================
echo.
echo Fichier :
echo %BACKUP_FILE%
echo.
echo Taille : %BACKUP_SIZE% octets
echo.
echo Copie ensuite ce dump dans le dossier backups du poste DEV.
echo.

pause
endlocal