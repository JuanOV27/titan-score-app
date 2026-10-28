import * as THREE from "../vendor/three/three.module.js";

const TAMANO = 1024;

function cargarImagen(url) {
  return new Promise((resolver, rechazar) => {
    const imagen = new Image();
    imagen.onload = () => resolver(imagen);
    imagen.onerror = () => rechazar(new Error(`No se pudo cargar ${url}`));
    imagen.src = url;
  });
}

export class Cara {
  constructor({ material, carpeta, colorFondo = "#B8743F", fondo = null }) {
    this.material = material;
    this.carpeta = carpeta;
    this.colorFondo = colorFondo;
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvas.height = TAMANO;
    this.ctx = this.canvas.getContext("2d");

    const original = material.map;
    this.textura = new THREE.CanvasTexture(this.canvas);
    this.textura.flipY = false;
    this.textura.colorSpace = THREE.SRGBColorSpace;
    this.textura.channel = original?.channel ?? 0;
    material.map = this.textura;
    material.color.setHex(0xffffff);
    material.needsUpdate = true;

    this.ojos = "explicar";
    this.boca = "cerrada";
    this.version = 0;
    this.versionOjos = 0;
    this.dibujando = false;
    this.parpadeando = false;
    this.temporizadorParpadeo = null;
    this.cacheCapas = new Map();
    this.fondo = null;
    this.fondoUrl = fondo;
  }

  async iniciar() {
    if (this.fondoUrl) {
      try {
        this.fondo = await cargarImagen(this.fondoUrl);
      } catch {
        this.fondo = null;
      }
    }
    await this.redibujar();
    this.programarParpadeo();
  }

  async setGesto(gesto) {
    const siguiente = gesto || "explicar";
    this.ojos = siguiente === "cerrados" ? "cerrados" : siguiente;
    this.boca = siguiente === "cerrados" ? "cerrada" : siguiente;
    this.versionOjos += 1;
    await this.redibujar();
  }

  async setOjos(ojos) {
    if (this.ojos === ojos) return;
    this.ojos = ojos;
    this.versionOjos += 1;
    await this.redibujar();
  }

  async setBoca(boca) {
    const siguiente = boca || "cerrada";
    if (this.boca === siguiente) return;
    this.boca = siguiente;
    await this.redibujar();
  }

  async setFondo(url) {
    this.fondoUrl = url;
    try {
      this.fondo = await cargarImagen(url);
    } catch {
      this.fondo = null;
    }
    await this.redibujar();
  }

  programarParpadeo() {
    clearTimeout(this.temporizadorParpadeo);
    const espera = 3000 + Math.random() * 3000;
    this.temporizadorParpadeo = setTimeout(() => this.parpadear(), espera);
  }

  async parpadear() {
    if (this.ojos === "cerrados" || this.parpadeando) {
      this.programarParpadeo();
      return;
    }

    this.parpadeando = true;
    const anterior = this.ojos;
    this.ojos = "cerrados";
    await this.redibujar();
    const versionOjos = this.versionOjos;
    await new Promise((resolver) => setTimeout(resolver, 120));
    if (this.versionOjos === versionOjos && this.ojos === "cerrados") {
      this.ojos = anterior;
      await this.redibujar();
    }
    this.parpadeando = false;
    this.programarParpadeo();
  }

  async #capa(nombre, alternativa) {
    const clave = `${nombre}|${alternativa ?? ""}`;
    if (!this.cacheCapas.has(clave)) {
      const tarea = (async () => {
        try {
          return await cargarImagen(`assets/${this.carpeta}/${nombre}.png`);
        } catch {
          if (!alternativa) return null;
          try {
            return await cargarImagen(`assets/${this.carpeta}/${alternativa}.png`);
          } catch {
            return null;
          }
        }
      })();
      this.cacheCapas.set(clave, tarea);
    }
    return this.cacheCapas.get(clave);
  }

  async redibujar() {
    const version = ++this.version;
    this.dibujando = true;

    const ojos = await this.#capa(`ojos_${this.ojos}`, "ojos_explicar");
    const boca = await this.#capa(`boca_${this.boca}`, "boca_cerrada");

    if (version !== this.version) {
      this.dibujando = false;
      return;
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, TAMANO, TAMANO);
    if (this.fondo) {
      ctx.drawImage(this.fondo, 0, 0, TAMANO, TAMANO);
    } else {
      ctx.fillStyle = this.colorFondo;
      ctx.fillRect(0, 0, TAMANO, TAMANO);
    }
    if (ojos) ctx.drawImage(ojos, 0, 0, TAMANO, TAMANO);
    if (boca) ctx.drawImage(boca, 0, 0, TAMANO, TAMANO);
    this.textura.needsUpdate = true;
    this.dibujando = false;
  }
}
