# Titan Score — página de descargas

Sitio estático (GitHub Pages) con el APK más reciente de **Titan Score** y las notas de cada versión.
El código fuente de la app vive en un repositorio privado aparte; este repo solo aloja la página y los
[Releases](../../releases) con los archivos APK.

## Publicar una nueva versión

1. Crea un release en este repo con tag tipo `v0.1.1`, un título y las notas de la versión (usa viñetas `- ` para que se vean como lista en la página).
2. Sube el APK como asset del release. **Usa siempre el mismo nombre de archivo `titan-score.apk`** para que el enlace fijo de descarga (`/releases/latest/download/titan-score.apk`) siempre apunte a la versión más nueva.
3. La página (`index.html`) lee los releases automáticamente vía la API de GitHub — no hay que tocar el HTML.

## Desarrollo local

Es HTML/CSS/JS plano, sin build. Basta con abrir `index.html` en un navegador o servirlo con cualquier servidor estático.
