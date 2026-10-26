const REPO = "JuanOV27/titan-score-app";

// Enlace permanente a la última versión. No pasa por la API, así que sigue funcionando cuando
// GitHub la limita (60 consultas por hora por conexión: en un wifi compartido se agotan rápido).
const APK_ULTIMA = `https://github.com/${REPO}/releases/latest/download/titan-score.apk`;

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/** Texto escapado con **negritas** de Markdown, que es lo único que usan las notas. */
function enLinea(texto) {
  return escapeHtml(texto).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function renderNotes(body) {
  if (!body) return "";
  let html = "";
  let inList = false;
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${enLinea(line.slice(2))}</li>`;
    } else {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      if (line) html += `<p>${enLinea(line)}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
}

function cabecera(r) {
  return `
    <div class="release-header">
      <span class="release-version">${escapeHtml(r.name || r.tag_name)}</span>
      <span class="release-date">${formatDate(r.published_at)}</span>
    </div>`;
}

async function cargarReleases() {
  const notesContainer = document.getElementById("release-notes");
  const downloadLink = document.getElementById("download-link");
  const downloadVersion = document.getElementById("download-version");

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases`);
    if (!res.ok) throw new Error("No se pudieron cargar las versiones");
    const releases = await res.json();

    if (!Array.isArray(releases) || releases.length === 0) {
      notesContainer.innerHTML = '<p class="error">Todavía no hay versiones publicadas.</p>';
      return;
    }

    // Solo se distribuye la última: es la única con enlace de descarga. Las anteriores
    // quedan como historial de cambios, plegadas y sin APK.
    const ultima = releases[0];
    const apk = ultima.assets.find((a) => a.name.endsWith(".apk"));
    downloadLink.href = apk ? apk.browser_download_url : ultima.html_url;
    downloadVersion.textContent = ultima.tag_name;

    const actual = `
      <div class="release actual">
        ${cabecera(ultima)}
        <div class="release-body">${renderNotes(ultima.body) || "<p>Sin notas.</p>"}</div>
        ${apk ? `<a class="release-download" href="${apk.browser_download_url}" rel="noopener">Descargar ${escapeHtml(ultima.tag_name)}</a>` : ""}
      </div>`;

    const historial = releases
      .slice(1)
      .map((r) => `
        <details class="release">
          <summary>${cabecera(r)}</summary>
          <div class="release-body">${renderNotes(r.body) || "<p>Sin notas.</p>"}</div>
        </details>`)
      .join("");

    notesContainer.innerHTML = actual + historial;
  } catch (err) {
    // El botón de arriba ya apunta a APK_ULTIMA desde el HTML; aquí se ofrece también junto
    // al aviso, para que nadie se quede sin descarga.
    notesContainer.innerHTML = `
      <p class="error">No se pudieron cargar las notas de versión, pero puedes descargar la app igual.</p>
      <a class="release-download" href="${APK_ULTIMA}" rel="noopener">Descargar la última versión</a>
      <p class="error">Historial completo en las <a href="https://github.com/${REPO}/releases" target="_blank" rel="noopener">releases de GitHub</a>.</p>`;
  }
}

cargarReleases();
