const REPO = "JuanOV27/titan-score-app";

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderNotes(body) {
  if (!body) return "";
  const lines = body.split("\n");
  let html = "";
  let inList = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${escapeHtml(line.slice(2))}</li>`;
    } else {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      if (line) {
        html += `<p>${escapeHtml(line)}</p>`;
      }
    }
  }
  if (inList) html += "</ul>";
  return html;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
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
      downloadLink.href = `https://github.com/${REPO}/releases`;
      downloadVersion.textContent = "";
      return;
    }

    const ultima = releases[0];
    const apkAsset = ultima.assets.find((a) => a.name.endsWith(".apk"));
    if (apkAsset) {
      downloadLink.href = apkAsset.browser_download_url;
      downloadVersion.textContent = ultima.tag_name;
    } else {
      downloadLink.href = ultima.html_url;
      downloadVersion.textContent = ultima.tag_name;
    }

    notesContainer.innerHTML = releases
      .map((r) => {
        const apk = r.assets.find((a) => a.name.endsWith(".apk"));
        const descarga = apk
          ? `<a class="release-download" href="${apk.browser_download_url}" target="_blank" rel="noopener">⬇ Descargar ${escapeHtml(r.tag_name)}</a>`
          : "";
        return `
        <div class="release">
          <div class="release-header">
            <span class="release-version">${escapeHtml(r.name || r.tag_name)}</span>
            <span class="release-date">${formatDate(r.published_at)}</span>
          </div>
          <div class="release-body">${renderNotes(r.body) || "<p>Sin notas.</p>"}</div>
          ${descarga}
        </div>`;
      })
      .join("");
  } catch (err) {
    notesContainer.innerHTML = '<p class="error">No se pudieron cargar las versiones. Revisa las <a href="https://github.com/' + REPO + '/releases" target="_blank" rel="noopener">releases en GitHub</a>.</p>';
    downloadLink.href = `https://github.com/${REPO}/releases`;
  }
}

cargarReleases();
