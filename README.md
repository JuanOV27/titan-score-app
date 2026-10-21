# Titan Beta — página de descargas

Sitio estático (GitHub Pages) con el APK más reciente de **Titan Beta**, la versión en pruebas de
Titan Score, y las notas de cada versión. El código fuente de la app vive en un repositorio privado
aparte; este repo solo aloja la página y los [Releases](../../releases) con los APK.

Desde la 1.1.0 se publica el build de Titan Beta (`com.titanscore.app.beta`, rama `legal/beta`),
que se instala como una app aparte junto a Titan Score.

## Publicar una nueva versión

1. Crea un release con tag tipo `v1.1.0`, un título y las notas (viñetas `- ` y `**negritas**`).
2. Sube el APK como asset con el nombre **`titan-score.apk`**, para que el enlace fijo
   (`/releases/latest/download/titan-score.apk`) apunte siempre a la versión más nueva.
3. La página lee los releases con la API de GitHub. Solo la versión más reciente lleva enlace de
   descarga; las anteriores se muestran como historial de cambios, sin APK.

## Desarrollo local

HTML/CSS/JS plano, sin build. Sírvelo con cualquier servidor estático
(`python3 -m http.server`): abrir el archivo directamente bloquea la llamada a la API.
