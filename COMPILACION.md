# MDNotes — Compilar y probar

## Requisitos

- **Node 20+** (aquí gestionado con **fnm**; no está en el PATH de shells no interactivos).
- **pnpm** (el repo usa `.npmrc` con `node-linker=hoisted` — obligatorio).
- Para el APK Android: **Android Studio** (JDK/JBR + SDK + platform-tools/adb) y
  **CMake 4.1.2** (ver más abajo, es clave en Windows).

```bash
pnpm install
```

## Probar: Expo Go vs APK

> ⚠️ **MDNotes ya NO corre en Expo Go.** Usa `react-native-keyboard-controller`, que
> es un **módulo nativo** no incluido en Expo Go. Hay que compilar el APK.

- **Cambios de solo-JS** se pueden ver con `pnpm start` **solo si** vuelves a quitar
  temporalmente el módulo nativo — en la práctica, compila el APK.
- **Recomendado**: el script de build+install por USB.

```powershell
pwsh -File .\build-and-install.ps1            # prebuild (1ª vez) + gradle + adb install
pwsh -File .\build-and-install.ps1 -Prebuild  # regenera android/ (íconos, splash, plugins, deps nativas)
pwsh -File .\build-and-install.ps1 -InstallOnly
```

El script autodetecta `adb`, `JAVA_HOME`/JBR de Android Studio y Node vía fnm; para el
daemon de Gradle antes de regenerar (evita `EBUSY` en Windows); y compila un APK
**release** (JS embebido con Hermes → corre en el cel sin laptop).

## CMake 4.1.2 — el fix de "Filename longer than 260 characters" (Windows)

El New Architecture genera rutas C++ larguísimas para `react-native-keyboard-controller`.
El **CMake 3.22.1** por defecto trae un `ninja` que **ignora las rutas largas de Windows**
y el build muere con:

```
ninja: error: Stat(...RNKCKeyboard...ShadowNode.cpp.o): Filename longer than 260 characters
```

**Solución** (igual que daemoni):
1. Android Studio → **SDK Manager → SDK Tools → "Show Package Details"** → **CMake → 4.1.2** → Apply.
2. El plugin `plugins/withCmakeVersion.js` (registrado en `app.json`) fuerza
   `cmake { version "4.1.2" }` en `android/app/build.gradle` en cada `expo prebuild`.

CMake 4.x trae un `ninja` que sí respeta LongPaths → compila. Si el SDK Manager solo
ofrece otra versión 4.x, ajusta el `version` del plugin en `app.json` para que coincida.

## Instalar en el teléfono (MIUI / Xiaomi)

Si `adb install` falla con `INSTALL_FAILED_USER_RESTRICTED` es **restricción de MIUI**:
- Ajustes → Opciones de desarrollador → activa **"Instalar vía USB"** (pide cuenta Mi +
  internet) y **"Depuración USB (Ajustes de seguridad)"**; si sigue, desactiva
  **"Optimización MIUI"**.
- Plan B (el script lo hace solo): copia el APK a `Descargas/mdnotes.apk` y lo instalas
  a mano desde el gestor de archivos.

## EAS / tiendas

`eas.json` está listo. Para nube: `eas build -p android --profile preview` (APK) o
`--profile production`. `.easignore` excluye `initials/`. Detalle general en
`initials/COMPILACION.md`.
