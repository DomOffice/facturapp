@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ============================================================
rem FacturApp - Reinitialisation et restauration de la base DEV
rem
rem Processus :
rem 1. vider les donnees DEV ;
rem 2. restaurer uniquement les donnees du dump PROD ;
rem 3. recalculer les sequences ;
rem 4. lancer les verifications.
rem
rem Aucune commande Prisma n'est executee.
rem ============================================================

rem ============================================================
rem PARAMETRES A ADAPTER
rem ============================================================

set "PG_BIN=C:\Program Files\PostgreSQL\18\bin"

set "DEV_HOST=localhost"
set "DEV_PORT=5432"
set "DEV_DB=facturapp_dev"
set "DEV_USER=postgres"

rem ============================================================
rem FICHIERS
rem ============================================================

set "SCRIPT_DIR=%~dp0"
set "BACKUP_DIR=%SCRIPT_DIR%backups"

set "RESET_SQL=%SCRIPT_DIR%02_reset_dev.sql"
set "SEQUENCES_SQL=%SCRIPT_DIR%04_reset_sequences.sql"
set "VERIFICATION_SQL=%SCRIPT_DIR%05_verification.sql"

rem ============================================================
rem CONTROLE DES EXECUTABLES
rem ============================================================

if not exist "%PG_BIN%\psql.exe" (
  echo.
  echo ERREUR : psql.exe est introuvable.
  echo Chemin configure :
  echo %PG_BIN%
  pause
  exit /b 1
)

if not exist "%PG_BIN%\pg_restore.exe" (
  echo.
  echo ERREUR : pg_restore.exe est introuvable.
  echo Chemin configure :
  echo %PG_BIN%
  pause
  exit /b 1
)

rem ============================================================
rem CONTROLE DES SCRIPTS SQL
rem ============================================================

if not exist "%RESET_SQL%" (
  echo.
  echo ERREUR : script introuvable :
  echo %RESET_SQL%
  pause
  exit /b 1
)

if not exist "%SEQUENCES_SQL%" (
  echo.
  echo ERREUR : script introuvable :
  echo %SEQUENCES_SQL%
  pause
  exit /b 1
)

if not exist "%VERIFICATION_SQL%" (
  echo.
  echo ERREUR : script introuvable :
  echo %VERIFICATION_SQL%
  pause
  exit /b 1
)

rem ============================================================
rem SELECTION DU DUMP
rem
rem Usage possible :
rem 03_restore_dev.bat "C:\chemin\facturapp_prod_xxx.dump"
rem
rem Sans argument, le dump le plus recent du dossier backups
rem est selectionne.
rem ============================================================

set "BACKUP_FILE=%~1"

if defined BACKUP_FILE (
  if not exist "%BACKUP_FILE%" (
    echo.
    echo ERREUR : le dump indique est introuvable :
    echo %BACKUP_FILE%
    pause
    exit /b 1
  )
) else (
  if not exist "%BACKUP_DIR%" (
    echo.
    echo ERREUR : le dossier backups est introuvable :
    echo %BACKUP_DIR%
    pause
    exit /b 1
  )

  for /f "delims=" %%F in (
    'dir /B /A-D /O-D "%BACKUP_DIR%\*.dump" 2^>nul'
  ) do (
    if not defined BACKUP_FILE (
      set "BACKUP_FILE=%BACKUP_DIR%\%%F"
    )
  )
)

if not defined BACKUP_FILE (
  echo.
  echo ERREUR : aucun fichier .dump n'a ete trouve.
  echo.
  echo Place un dump dans :
  echo %BACKUP_DIR%
  echo.
  echo Ou execute :
  echo 03_restore_dev.bat "C:\chemin\vers\le\fichier.dump"
  pause
  exit /b 1
)

rem ============================================================
rem RESUME ET CONFIRMATION
rem ============================================================

echo.
echo ============================================================
echo RESTAURATION FACTURAPP VERS DEV
echo ============================================================
echo.
echo Serveur DEV    : %DEV_HOST%
echo Port DEV       : %DEV_PORT%
echo Base DEV       : %DEV_DB%
echo Utilisateur DEV: %DEV_USER%
echo.
echo Dump source :
echo %BACKUP_FILE%
echo.
echo ATTENTION :
echo TOUTES LES DONNEES ACTUELLES DE LA BASE DEV SERONT VIDEES.
echo.
echo Le schema PostgreSQL DEV sera conserve.
echo Les tables ne seront pas supprimees.
echo Aucun prisma db pull ne sera execute.
echo Aucun prisma db push ne sera execute.
echo Aucune migration Prisma ne sera executee.
echo.

choice /C ON /N /M "Confirmer la restauration vers cette base DEV ? [O/N] : "

if errorlevel 2 (
  echo.
  echo Operation annulee.
  pause
  exit /b 0
)

echo.
echo Le mot de passe demande est celui de PostgreSQL DEV local.
echo.

rem ============================================================
rem ETAPE 1 - VIDAGE DEV
rem ============================================================

echo.
echo ============================================================
echo ETAPE 1/4 - VIDAGE DES DONNEES DEV
echo ============================================================
echo.

"%PG_BIN%\psql.exe" ^
  --host="%DEV_HOST%" ^
  --port="%DEV_PORT%" ^
  --username="%DEV_USER%" ^
  --dbname="%DEV_DB%" ^
  --set=ON_ERROR_STOP=1 ^
  --file="%RESET_SQL%"

if errorlevel 1 (
  echo.
  echo ECHEC : le vidage de la base DEV a echoue.
  echo La restauration est arretee.
  pause
  exit /b 1
)

rem ============================================================
rem ETAPE 2 - RESTAURATION DATA-ONLY
rem ============================================================

echo.
echo ============================================================
echo ETAPE 2/4 - RESTAURATION DES DONNEES
echo ============================================================
echo.

"%PG_BIN%\pg_restore.exe" ^
  --host="%DEV_HOST%" ^
  --port="%DEV_PORT%" ^
  --username="%DEV_USER%" ^
  --dbname="%DEV_DB%" ^
  --data-only ^
  --disable-triggers ^
  --no-owner ^
  --no-privileges ^
  --exit-on-error ^
  "%BACKUP_FILE%"

if errorlevel 1 (
  echo.
  echo ECHEC : la restauration des donnees a echoue.
  echo.
  echo La base DEV peut etre partiellement restauree.
  echo Ne relance pas automatiquement l'ensemble sans analyser l'erreur.
  pause
  exit /b 1
)

rem ============================================================
rem ETAPE 3 - SEQUENCES
rem ============================================================

echo.
echo ============================================================
echo ETAPE 3/4 - RECALCUL DES SEQUENCES
echo ============================================================
echo.

"%PG_BIN%\psql.exe" ^
  --host="%DEV_HOST%" ^
  --port="%DEV_PORT%" ^
  --username="%DEV_USER%" ^
  --dbname="%DEV_DB%" ^
  --set=ON_ERROR_STOP=1 ^
  --file="%SEQUENCES_SQL%"

if errorlevel 1 (
  echo.
  echo ECHEC : le recalcul des sequences a echoue.
  echo.
  echo Les donnees ont ete restaurees, mais les sequences
  echo doivent etre controlees avant de reutiliser l'application.
  pause
  exit /b 1
)

rem ============================================================
rem ETAPE 4 - VERIFICATIONS
rem ============================================================

echo.
echo ============================================================
echo ETAPE 4/4 - VERIFICATIONS
echo ============================================================
echo.

"%PG_BIN%\psql.exe" ^
  --host="%DEV_HOST%" ^
  --port="%DEV_PORT%" ^
  --username="%DEV_USER%" ^
  --dbname="%DEV_DB%" ^
  --set=ON_ERROR_STOP=1 ^
  --file="%VERIFICATION_SQL%"

if errorlevel 1 (
  echo.
  echo ECHEC : le script de verification a rencontre une erreur.
  echo.
  echo La restauration peut avoir reussi.
  echo Ne relance pas le reset ou la restauration sans analyse.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo RESTAURATION DEV TERMINEE
echo ============================================================
echo.
echo Base :
echo %DEV_DB%
echo.
echo Prochaines commandes a lancer dans le projet FacturApp :
echo.
echo   npx prisma validate
echo   npx prisma generate
echo   npx tsc --noEmit
echo.
echo Ne lance pas automatiquement :
echo.
echo   npx prisma db pull
echo   npx prisma db push
echo   npx prisma migrate reset
echo   npx prisma migrate dev
echo.

pause
endlocal