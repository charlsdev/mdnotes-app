# MDNotes — Compilar y probar

## Requisitos

- **Node 20+** (aquí gestionado con **fnm**; no está en el PATH de shells no interactivos).
- **pnpm** (el repo usa `.npmrc` con `node-linker=hoisted` — obligatorio).
- Para el APK Android: **Android Studio** (SDK + platform-tools/adb), un **JDK 17–21**
  (ver abajo: el JBR que trae Android Studio ya es demasiado nuevo) y **CMake 4.1.2**
  (es clave en Windows).

```bash
pnpm install
```

## Editor WYSIWYG (VIVO) — regenerar el asset

El editor VIVO (Milkdown Crepe) se compila **aparte** en `webeditor/` a un HTML autónomo
offline (`assets/webeditor.html`). Solo hay que regenerarlo si tocas `webeditor/src/*`:

```bash
cd webeditor
npm install          # una vez (tiene su propio node_modules)
node build.mjs       # → assets/webeditor.html
```

El resto de la app lo consume como asset; no necesita nada más. `webeditor/` está excluido
de la compilación de la app (tsconfig / metro blockList / .easignore).

## Visor de PDF — regenerar el asset

Igual que el editor, pero con **pdf.js** (`assets/pdfviewer.html`, ~1,8 MB). Solo hace
falta si tocas `pdfviewer/src/*`:

```bash
cd pdfviewer
npm install          # una vez (tiene su propio node_modules)
node build.mjs       # → assets/pdfviewer.html
```

`pdfviewer/` también está excluido en tsconfig / metro blockList / .easignore.

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

## JDK: Gradle 8.14 NO soporta Java 25+

Android Studio actualizó su JBR a **Java 25** (y los JDK sueltos de Oracle ya van por 26).
El wrapper del proyecto es **Gradle 8.14.3**, que solo llega hasta Java 24, y cuando se topa
con una versión que no conoce falla al resolver los plugins con un mensaje que es
**solo el número de versión**:

```
* Where: Settings file 'android\settings.gradle' line: 21
* What went wrong: Error resolving plugin [id: 'com.facebook.react.settings']
> 25.0.2
```

No es un problema de React Native ni del código: es el JDK. **Solución**: compilar con un
JDK **17–21** (17 es el canónico para RN 0.81 / AGP 8).

`build-and-install.ps1` ya lo resuelve solo: busca el primer JDK entre 17 y 24 —
`JAVA_HOME`, los toolchains que Gradle bajó en `~/.gradle/jdks`, los JDK instalados y, al
final, el JBR — y avisa si tuvo que ignorar `JAVA_HOME`. Si no encuentra ninguno, instala
Temurin 17 o 21. Para forzar uno a mano en una sesión:

```powershell
$env:JAVA_HOME = "$env:USERPROFILE\.gradle\jdks\eclipse_adoptium-17-amd64-windows.2"
```

> Ojo: NO subas el wrapper a Gradle 9 para "arreglar" esto sin revisar AGP/RN — el combo
> soportado por Expo SDK 54 es Gradle 8.x + JDK 17.

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
