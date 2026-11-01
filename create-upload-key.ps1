# create-upload-key.ps1 — Crea la llave de SUBIDA a Google Play de MDNotes. Una sola vez.
#
# Uso:  pwsh -File .\create-upload-key.ps1                  (la guarda en <workspace>\Secretos\MDNotes)
#       pwsh -File .\create-upload-key.ps1 -OutDir D:\llaves (en otra carpeta)
#
# Qué deja (nada de esto entra al repo):
#   <OutDir>\mdnotes-upload.jks    la llave (PKCS12, RSA 2048, ~27 años)
#   <OutDir>\signing.properties    ruta y contraseña: lo que lee build.gradle
#   ~\.gradle\gradle.properties    MDNOTES_SIGNING=<ruta a signing.properties>
#
# RESPALDA esa carpeta fuera de este PC. Con Play App Signing, Google guarda la
# llave que firma lo que llega a los teléfonos; esta es solo la de subida. Si se
# pierde, Play Console permite pedir otra, pero tarda días y mientras tanto no
# puedes subir actualizaciones.
#
# OJO: `pwsh -File` ignora EN SILENCIO los parámetros que no existen aquí.
param([string]$OutDir)

$ErrorActionPreference = 'Stop'
$App = 'MDNotes'
$Prefix = 'MDNOTES'
$Alias = 'mdnotes-upload'

# repo → workspace (G:\NodeJS)\Secretos, como las llaves de las otras apps.
if (-not $OutDir) { $OutDir = Join-Path (Split-Path -Parent $PSScriptRoot) "Secretos\$App" }
$jks = Join-Path $OutDir "$Alias.jks"
$props = Join-Path $OutDir 'signing.properties'

if (Test-Path -LiteralPath $jks) {
  throw "Ya existe $jks. No la sobrescribo: una llave nueva no sirve para actualizar una app ya subida con la vieja."
}

# keytool vale de cualquier JDK (aquí la versión de Java no importa, solo para Gradle).
$cands = @()
foreach ($h in @($env:JAVA_HOME, $env:JDK_HOME)) { if ($h) { $cands += Join-Path $h 'bin\keytool.exe' } }
$cands += Get-ChildItem "$env:USERPROFILE\.gradle\jdks", 'C:\Program Files\Eclipse Adoptium', 'C:\Program Files\Java',
  'C:\Program Files\Microsoft', "$env:LOCALAPPDATA\Programs\Android Studio", 'C:\Program Files\Android\Android Studio' `
  -Directory -ErrorAction SilentlyContinue | ForEach-Object { Join-Path $_.FullName 'bin\keytool.exe' }
$keytool = $cands | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $keytool) { $keytool = (Get-Command keytool -ErrorAction SilentlyContinue).Source }
if (-not $keytool) { throw 'No encontré keytool. Instala un JDK (winget install --id EclipseAdoptium.Temurin.17.JDK -e).' }
Write-Host "› keytool = $keytool" -ForegroundColor DarkGray

$plain = {
  param($secure)
  [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}
$pwd1 = & $plain (Read-Host "Contraseña para la llave de $App (mín. 8 caracteres)" -AsSecureString)
$pwd2 = & $plain (Read-Host 'Repítela' -AsSecureString)
if ($pwd1 -cne $pwd2) { throw 'Las contraseñas no coinciden.' }
if ($pwd1.Length -lt 8) { throw 'La contraseña debe tener al menos 8 caracteres.' }
# signing.properties se lee como ISO-8859-1 y "\" es escape: con tildes, ñ o "\" la
# contraseña que lee Gradle no sería la de la llave.
if ($pwd1 -match '[^\x21-\x7E]' -or $pwd1.Contains('\')) {
  throw 'Usa letras sin tilde, números y símbolos (sin espacios, ñ ni "\").'
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# La contraseña va por variable de entorno (-storepass:env), no como argumento:
# así no queda en el historial ni en la lista de procesos.
$env:RX_UPLOAD_KEYPASS = $pwd1
try {
  & $keytool -genkeypair -v -storetype PKCS12 -keystore $jks -alias $Alias -keyalg RSA -keysize 2048 `
    -validity 10000 -dname 'CN=charlsdev, O=charlsdev, C=EC' -storepass:env RX_UPLOAD_KEYPASS -keypass:env RX_UPLOAD_KEYPASS
  if ($LASTEXITCODE -ne 0) { throw "keytool falló (exit $LASTEXITCODE)." }
} finally {
  Remove-Item Env:RX_UPLOAD_KEYPASS -ErrorAction SilentlyContinue
}

# Barras "/" en las rutas: en un .properties "\" es escape.
$fwd = { param($p) $p.Replace('\', '/') }
@(
  "storeFile=$(& $fwd $jks)"
  "storePassword=$pwd1"
  "keyAlias=$Alias"
  "keyPassword=$pwd1"
) | Set-Content -LiteralPath $props -Encoding ascii
Remove-Variable pwd1, pwd2

# La propiedad que busca build.gradle, en el gradle.properties del USUARIO (no el del proyecto).
$gradleHome = if ($env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME } else { Join-Path $env:USERPROFILE '.gradle' }
New-Item -ItemType Directory -Force -Path $gradleHome | Out-Null
$gp = Join-Path $gradleHome 'gradle.properties'
$line = "${Prefix}_SIGNING=$(& $fwd $props)"
$lines = if (Test-Path -LiteralPath $gp) { @(Get-Content -LiteralPath $gp | Where-Object { $_ -notmatch "^${Prefix}_SIGNING=" }) } else { @() }
@($lines) + $line | Set-Content -LiteralPath $gp -Encoding utf8

Write-Host ''
Write-Host "✓ Llave creada: $jks" -ForegroundColor Green
Write-Host "  · $props"
Write-Host "  · $gp  →  $line"
Write-Host ''
Write-Host '  RESPALDA la carpeta de la llave fuera de este PC.' -ForegroundColor Yellow
Write-Host '  Siguiente: pwsh -File .\build-and-install.ps1 -Prebuild -Bundle' -ForegroundColor Cyan
