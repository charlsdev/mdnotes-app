# build-and-install.ps1 — Genera el proyecto nativo, compila el APK release e
# instala en el teléfono conectado. La APK release lleva el JS embebido (Hermes),
# así que corre sola en el cel sin necesidad de Metro / laptop.
#
# Uso:  pwsh -File .\build-and-install.ps1              (prebuild si hace falta + compila + instala)
#       pwsh -File .\build-and-install.ps1 -InstallOnly  (solo instala el último APK)
#       pwsh -File .\build-and-install.ps1 -Prebuild     (fuerza regenerar android/ desde app.json)
param([switch]$InstallOnly, [switch]$Prebuild)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$apk = Join-Path $root 'android\app\build\outputs\apk\release\app-release.apk'
$pkg = 'xyz.charlsdev.mdnotes'

function First-Existing([string[]]$paths) {
  foreach ($p in $paths) { if ($p -and (Test-Path $p)) { return $p } }
  return $null
}

# --- Node por fnm (si está): toma la versión más nueva; si no, el node del PATH. ---
$fnmVersions = "$env:USERPROFILE\AppData\Roaming\fnm\node-versions"
if (Test-Path $fnmVersions) {
  $latest = Get-ChildItem $fnmVersions -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'v*' } | Sort-Object Name -Descending | Select-Object -First 1
  if ($latest) {
    $nodeDir = Join-Path $latest.FullName 'installation'
    if (Test-Path $nodeDir) { $env:Path = "$nodeDir;$env:Path" }
  }
}

# --- adb: SDK del usuario (default), SDK global, ANDROID_HOME, o el del PATH. ---
$adb = First-Existing @(
  "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
  'C:\Android\Sdk\platform-tools\adb.exe',
  "$env:ANDROID_HOME\platform-tools\adb.exe"
)
if (-not $adb) { $adb = (Get-Command adb -ErrorAction SilentlyContinue).Source }
if (-not $adb) { throw 'No encontré adb. Instala Android SDK platform-tools o ponlo en el PATH.' }

# SDK root = carpeta padre de platform-tools (donde vive adb). Gradle lo necesita.
$env:ANDROID_HOME = Split-Path -Parent (Split-Path -Parent $adb)
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
Write-Host "› ANDROID_HOME = $env:ANDROID_HOME" -ForegroundColor DarkGray

# --- JAVA_HOME: respeta uno válido; si no, busca el JBR de Android Studio. ---
function Is-Jdk([string]$jdkHome) { return ($jdkHome -and (Test-Path (Join-Path $jdkHome 'bin\javac.exe'))) }
if (-not (Is-Jdk $env:JAVA_HOME)) {
  $jbr = First-Existing @(
    "$env:LOCALAPPDATA\Programs\Android Studio\jbr",
    'C:\Program Files\Android\Android Studio\jbr',
    'C:\Program Files\Jetbrains\Android Studio\jbr'
  )
  if (-not $jbr) { throw 'No encontré un JDK (JBR de Android Studio). Instala Android Studio o setea JAVA_HOME a un JDK 17+.' }
  $env:JAVA_HOME = $jbr
}
Write-Host "› JAVA_HOME = $env:JAVA_HOME" -ForegroundColor DarkGray

if (-not $InstallOnly) {
  # App managed: genera android/ desde app.json la primera vez (o si -Prebuild).
  $androidDir = Join-Path $root 'android'
  if ($Prebuild -or -not (Test-Path $androidDir)) {
    Write-Host '› Generando proyecto nativo (expo prebuild)…' -ForegroundColor Cyan
    # En Windows, un daemon de Gradle del build anterior bloquea android\app\build
    # (EBUSY) y hace fallar el borrado de --clean. Lo paramos y borramos android/
    # nosotros con reintentos antes de regenerar.
    if (Test-Path (Join-Path $androidDir 'gradlew.bat')) {
      Push-Location $androidDir
      try { & .\gradlew.bat --stop 2>$null | Out-Null } catch {} finally { Pop-Location }
    }
    # Respaldo: si gradlew ya no está (android a medio borrar), mata el daemon
    # directamente. Solo procesos Gradle — no toca otros Java (ej. Android Studio).
    try {
      Get-CimInstance Win32_Process -Filter "Name='java.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match 'GradleDaemon' } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    } catch {}
    if (Test-Path $androidDir) {
      for ($i = 0; $i -lt 6 -and (Test-Path $androidDir); $i++) {
        try { Remove-Item -Recurse -Force $androidDir -ErrorAction Stop }
        catch { Start-Sleep -Milliseconds 900 }
      }
      if (Test-Path $androidDir) {
        throw 'No pude borrar android\ (archivo bloqueado). Cierra Android Studio y cualquier proceso Java/Gradle, luego reintenta.'
      }
    }
    Push-Location $root
    try { & npx expo prebuild --platform android } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw "expo prebuild falló (exit $LASTEXITCODE)" }
  }

  Write-Host '› Compilando APK release…' -ForegroundColor Cyan
  Push-Location $androidDir
  try { & .\gradlew.bat assembleRelease } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { throw "Gradle falló (exit $LASTEXITCODE)" }
}

if (-not (Test-Path $apk)) { throw "No existe el APK: $apk" }
$sizeMB = '{0:N1} MB' -f ((Get-Item $apk).Length / 1MB)
Write-Host "› APK listo ($sizeMB)" -ForegroundColor Green

# ¿Hay dispositivo?
$devices = (& $adb devices) | Select-String -Pattern '\tdevice$'
if (-not $devices) {
  Write-Host '⚠ No hay teléfono conectado por adb. Conéctalo (Depuración USB activada) y reintenta con -InstallOnly.' -ForegroundColor Yellow
  exit 1
}

Write-Host '› Instalando…' -ForegroundColor Cyan
$out = & $adb install -r $apk 2>&1
$out | ForEach-Object { Write-Host $_ }

if ($LASTEXITCODE -eq 0) {
  Write-Host '✓ Hecho. Abre MDNotes en el teléfono.' -ForegroundColor Green
  return
}

$txt = ($out | Out-String)

if ($txt -match 'UPDATE_INCOMPATIBLE|INCONSISTENT_CERTIFICATES|signatures do not match') {
  # Conflicto de firma real: había una versión con otra llave. Desinstalar y reinstalar.
  Write-Host '⚠ Conflicto de firma. Desinstalando el viejo y reintentando…' -ForegroundColor Yellow
  & $adb uninstall $pkg
  & $adb install $apk
  if ($LASTEXITCODE -eq 0) { Write-Host '✓ Hecho.' -ForegroundColor Green; return }
}

if ($txt -match 'USER_RESTRICTED|Install canceled by user') {
  Write-Host ''
  Write-Host '✗ El teléfono bloqueó la instalación por USB (restricción de MIUI/Xiaomi).' -ForegroundColor Red
  Write-Host '  Arréglalo en Ajustes → Opciones de desarrollador:' -ForegroundColor Yellow
  Write-Host '   • Activa "Instalar vía USB"  (pide cuenta Mi + internet; a veces SIM)'
  Write-Host '   • Activa "Depuración USB (Ajustes de seguridad)"'
  Write-Host '   • Desactiva "Optimización MIUI" (al fondo de Opciones de desarrollador) y reintenta.'
  Write-Host ''
  Write-Host '  Plan B — instalación manual (siempre funciona):' -ForegroundColor Cyan
  $dest = '/sdcard/Download/mdnotes.apk'
  & $adb push $apk $dest | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "   Copié el APK al teléfono → Descargas/mdnotes.apk" -ForegroundColor Green
    Write-Host '   Ábrelo desde el gestor de archivos del cel y toca Instalar' -ForegroundColor Green
    Write-Host '   (permite "instalar apps desconocidas" para ese gestor si lo pide).'
  } else {
    Write-Host "   No pude copiarlo. Copia a mano: $apk" -ForegroundColor Yellow
  }
  exit 1
}

Write-Host '✗ La instalación falló. Revisa el mensaje de adb arriba.' -ForegroundColor Red
exit 1
