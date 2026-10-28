const UMBRALES = { cerrada: 0.02, media: 0.06, abierta: 0.12 };
const RETENCION_MS = 70;

export class Labios {
  constructor() {
    this.contexto = null;
    this.analizador = null;
    this.fuente = null;
    this.audio = null;
    this.boca = "cerrada";
    this.cambioEn = 0;
    this.cuadro = null;
    this.datos = null;
    this.detenerActual = null;
  }

  async desbloquear() {
    if (!this.contexto) {
      const Contexto = window.AudioContext ?? window.webkitAudioContext;
      if (!Contexto) return false;
      try {
        this.contexto = new Contexto();
      } catch {
        return false;
      }
    }
    if (this.contexto.state === "suspended") {
      try {
        await Promise.race([
          this.contexto.resume(),
          new Promise((resolver) => setTimeout(resolver, 500)),
        ]);
      } catch {}
    }
    return this.contexto.state === "running";
  }

  #elegirBoca(rms) {
    if (rms < UMBRALES.cerrada) return "cerrada";
    if (rms < UMBRALES.media) return "media";
    if (rms < UMBRALES.abierta) return "abierta";
    return "o";
  }

  #aplicar(boca, alBoca) {
    const ahora = performance.now();
    if (boca === this.boca) return;
    if (ahora - this.cambioEn < RETENCION_MS) return;
    this.boca = boca;
    this.cambioEn = ahora;
    alBoca?.(boca);
  }

  async reproducir(url, alBoca) {
    if (!url) return false;
    await this.desbloquear();
    this.detener();

    const audio = new Audio(url);
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    this.audio = audio;

    if (!this.contexto) {
      try {
        await audio.play();
        await new Promise((resolver) => {
          audio.addEventListener("ended", resolver, { once: true });
          audio.addEventListener("error", resolver, { once: true });
        });
        return !audio.error;
      } catch {
        return false;
      }
    }

    this.analizador = this.contexto.createAnalyser();
    this.analizador.fftSize = 1024;
    this.fuente = this.contexto.createMediaElementSource(audio);
    this.fuente.connect(this.analizador);
    this.analizador.connect(this.contexto.destination);
    this.datos = new Uint8Array(this.analizador.fftSize);

    const medir = () => {
      if (!this.analizador) return;
      this.analizador.getByteTimeDomainData(this.datos);
      let suma = 0;
      for (const valor of this.datos) {
        const muestra = (valor - 128) / 128;
        suma += muestra * muestra;
      }
      const rms = Math.sqrt(suma / this.datos.length);
      this.#aplicar(this.#elegirBoca(rms), alBoca);
      this.cuadro = requestAnimationFrame(medir);
    };

    const terminar = (ok) => {
      if (this.cuadro) cancelAnimationFrame(this.cuadro);
      this.cuadro = null;
      this.#aplicar("cerrada", alBoca);
      this.#desconectar();
      return ok;
    };

    try {
      await audio.play();
    } catch {
      return terminar(false);
    }

    medir();

    return new Promise((resolver) => {
      const resolverUnaVez = (ok) => {
        audio.removeEventListener("ended", alTerminar);
        audio.removeEventListener("error", alError);
        resolver(terminar(ok));
      };
      const alTerminar = () => resolverUnaVez(true);
      const alError = () => resolverUnaVez(false);
      audio.addEventListener("ended", alTerminar, { once: true });
      audio.addEventListener("error", alError, { once: true });
      this.detenerActual = () => resolverUnaVez(false);
    });
  }

  async simular(texto, alBoca) {
    const palabras = String(texto ?? "").split(/\s+/).filter(Boolean).length;
    const duracion = Math.max(1200, palabras * 380);
    let alterna = false;

    return new Promise((resolver) => {
      const intervalo = setInterval(() => {
        alterna = !alterna;
        this.#aplicar(alterna ? "media" : "cerrada", alBoca);
      }, 120);
      const temporizador = setTimeout(() => {
        clearInterval(intervalo);
        this.#aplicar("cerrada", alBoca);
        resolver();
      }, duracion);
      this.detenerActual = () => {
        clearInterval(intervalo);
        clearTimeout(temporizador);
        this.#aplicar("cerrada", alBoca);
        resolver();
      };
    });
  }

  detener() {
    this.detenerActual?.();
    this.detenerActual = null;
    if (this.cuadro) cancelAnimationFrame(this.cuadro);
    this.cuadro = null;
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.#desconectar();
  }

  #desconectar() {
    try {
      this.fuente?.disconnect();
      this.analizador?.disconnect();
    } catch {}
    this.fuente = null;
    this.analizador = null;
    this.datos = null;
    this.audio = null;
  }

  async cerrar() {
    this.detener();
    if (this.contexto) await this.contexto.close();
    this.contexto = null;
  }
}
