import * as THREE from "../vendor/three/three.module.js";
import { GLTFLoader } from "../vendor/three/GLTFLoader.js";
import { Cara } from "./cara.js";

const PIELES = {
  marmol: { archivo: "marmol.webp", repetir: 3, mat: { roughness: 0.45 } },
  obsidiana: { archivo: "obsidiana.png", repetir: 3, mat: { roughness: 0.12, metalness: 0.25 } },
  nube: { archivo: "nube.png", repetir: 2, mat: { roughness: 1, emissive: 0x9fc6ff, emissiveIntensity: 0.22 } },
};

const loader = new GLTFLoader();
const texturas = new THREE.TextureLoader();

function texturaPiel(nombre) {
  const piel = PIELES[nombre];
  if (!piel) throw new Error(`Piel desconocida: ${nombre}`);
  const textura = texturas.load(`assets/pieles/${piel.archivo}`);
  textura.wrapS = textura.wrapT = THREE.RepeatWrapping;
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.repeat.set(piel.repetir, piel.repetir);
  return textura;
}

function materialPiedra(nombre) {
  const piel = PIELES[nombre];
  if (!piel) throw new Error(`Piel desconocida: ${nombre}`);
  return new THREE.MeshStandardMaterial({
    map: texturaPiel(nombre),
    ...piel.mat,
  });
}

function agrisar(textura) {
  const imagen = textura.image;
  const canvas = document.createElement("canvas");
  canvas.width = imagen.width;
  canvas.height = imagen.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imagen, 0, 0);
  const datos = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < datos.data.length; i += 4) {
    const gris =
      165 + (datos.data[i] * 0.3 + datos.data[i + 1] * 0.59 + datos.data[i + 2] * 0.11) * 0.35;
    datos.data[i] = datos.data[i + 1] = datos.data[i + 2] = gris;
  }
  ctx.putImageData(datos, 0, 0);
  const nueva = new THREE.CanvasTexture(canvas);
  nueva.flipY = textura.flipY;
  nueva.colorSpace = textura.colorSpace;
  nueva.channel = textura.channel;
  nueva.wrapS = textura.wrapS;
  nueva.wrapT = textura.wrapT;
  return nueva;
}

export class Avatar {
  constructor({
    escena,
    id,
    glb,
    cara,
    pos = [0, 0, 0],
    piel = "#B8743F",
    piedra = null,
    formas = {},
    ropa = null,
    nubes = false,
    reposo = "idle",
    foco = 0xffb27a,
    esColoso = false,
  }) {
    this.escena = escena;
    this.id = id;
    this.glb = glb;
    this.carpetaCara = cara;
    this.pos = pos;
    this.piel = piel;
    this.piedra = piedra;
    this.formas = formas;
    this.ropa = ropa;
    this.nubes = nubes;
    this.reposoClip = reposo;
    this.esColoso = esColoso;
    this.focoColor = foco;
    this.raiz = null;
    this.cara = null;
    this.mezclador = null;
    this.acciones = {};
    this.accionActual = null;
    this.gestoActual = null;
    this.animacionActual = null;
    this.repetirGesto = false;
    this.materialPiedra = null;
    this.materialNube = null;
    this.mallasSilueta = new Set();
    this.mallaCara = null;
    this.desplazamiento = 0;
    this.destacado = false;
  }

  async cargar() {
    const gltf = await loader.loadAsync(this.glb);
    this.raiz = gltf.scene;
    this.raiz.position.set(...this.pos);
    this.escena.add(this.raiz);

    if (this.piedra) {
      this.materialPiedra = materialPiedra(this.piedra);
      if (this.piedra === "nube") this.materialNube = this.materialPiedra;
    }

    const materialPiel = this.materialPiedra
      ? this.materialPiedra
      : new THREE.MeshStandardMaterial({ color: this.piel, roughness: 0.7 });
    const tela = [];
    const mallas = [];
    const materiales = [];

    this.raiz.traverse((objeto) => {
      if (!objeto.isMesh) return;
      mallas.push(objeto.name);
      materiales.push(objeto.material?.name ?? "");
      const material = objeto.material;
      if (!material) return;

      if (objeto.morphTargetDictionary) {
        for (const [nombre, indice] of Object.entries(objeto.morphTargetDictionary)) {
          objeto.morphTargetInfluences[indice] = this.formas[nombre] ?? 0;
        }
      }

      if (material.name.startsWith("Mat_silueta") || material.name === "") {
        objeto.material = new THREE.MeshBasicMaterial({ color: 0x000000 });
        objeto.visible = false;
        this.mallasSilueta.add(objeto);
        return;
      }

      if (material.name.startsWith("Mat_Face")) {
        this.mallaCara = objeto;
        return;
      }

      const esRopa = /^Mat_(Shirt|Pants)/.test(material.name);

      if (this.esColoso) {
        objeto.material = this.materialPiedra;
        return;
      }

      const colorRopa = esRopa && this.ropa
        ? (/^Mat_Pants/.test(material.name) ? this.ropa.pantalon : this.ropa.camisa)
        : undefined;

      if (this.piedra && !(esRopa && this.ropa)) {
        objeto.material = this.materialPiedra;
        return;
      }

      if (colorRopa) {
        if (material.map) material.map = agrisar(material.map);
        material.color.set(colorRopa);
        tela.push(objeto);
        return;
      }

      if (material.name.startsWith("Mat_skin")) material.color.set(this.piel);
      if (esRopa) tela.push(objeto);
    });

    const materialBase = materialPiel.clone();
    materialBase.polygonOffset = true;
    materialBase.polygonOffsetFactor = 1;
    materialBase.polygonOffsetUnits = 1;

    for (const malla of tela) {
      const material = malla.material;
      material.alphaTest = 0.5;
      material.polygonOffset = true;
      material.polygonOffsetFactor = -1;
      // Toda prenda lleva debajo una copia en piel: donde la textura recorta la tela (el pantalón
      // termina en la rodilla, la camisa en el hombro) tiene que verse piel, no un hueco.
      const base = malla.clone();
      base.material = materialBase;
      base.name = `${malla.name}_piel_${material.name}`;
      malla.parent.add(base);
    }

    if (this.mallaCara) {
      const fondo = this.piedra
        ? `assets/pieles/${PIELES[this.piedra].archivo}`
        : null;
      this.cara = new Cara({
        material: this.mallaCara.material,
        carpeta: this.carpetaCara,
        colorFondo: this.piel,
        fondo,
      });
      if (this.esColoso) {
        this.mallaCara.material.roughness = this.materialPiedra.roughness;
        this.mallaCara.material.metalness = this.materialPiedra.metalness;
        this.mallaCara.material.emissive = new THREE.Color(0xffffff);
        this.mallaCara.material.emissiveMap = this.cara.textura;
        this.mallaCara.material.emissiveIntensity = 0;
        this.mallaCara.material.needsUpdate = true;
      }
      await this.cara.iniciar();
    }

    this.mezclador = new THREE.AnimationMixer(this.raiz);
    this.mezclador.addEventListener("finished", (evento) => {
      if (
        this.repetirGesto &&
        this.gestoActual &&
        evento.action === this.accionActual
      ) {
        this.#tocarGesto(this.gestoActual, this.animacionActual);
      }
    });
    for (const animacion of gltf.animations) {
      this.acciones[animacion.name] = this.mezclador.clipAction(animacion);
    }

    if (this.nubes) this.nubesActualizar = this.#crearNubes();

    this.focoLuz = new THREE.SpotLight(this.focoColor, 0, 7, Math.PI / 7, 0.55, 1.2);
    this.focoLuz.position.set(this.pos[0] + 0.8, 3.1, this.pos[2] + 2.1);
    this.focoLuz.target.position.set(this.pos[0], 1.05, this.pos[2]);
    this.escena.add(this.focoLuz);
    this.escena.add(this.focoLuz.target);

    console.log(`[${this.id}] mallas`, mallas);
    console.log(`[${this.id}] materiales`, materiales);
    console.log(
      `[${this.id}] animaciones`,
      gltf.animations.map((animacion) => animacion.name),
    );

    this.reposo();
    return this;
  }

  #crearNubes() {
    const mapa = texturas.load("assets/efectos/nube_sprite.png");
    mapa.colorSpace = THREE.SRGBColorSpace;
    const nubes = [];
    for (let i = 0; i < 11; i++) {
      const nube = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: mapa,
          transparent: true,
          depthWrite: false,
          opacity: 0.9,
        }),
      );
      const escala = 0.22 + Math.random() * 0.22;
      nube.scale.set(escala * 1.6, escala, 1);
      nube.userData = {
        angulo: (i / 11) * Math.PI * 2,
        radio: 0.36 + Math.random() * 0.2,
        altura: 0.25 + Math.random() * 1.35,
        velocidad: (0.25 + Math.random() * 0.25) * (i % 2 ? 1 : -1),
        fase: Math.random() * 6,
      };
      this.raiz.add(nube);
      nubes.push(nube);
    }

    return (tiempo, delta) => {
      for (const nube of nubes) {
        const datos = nube.userData;
        datos.angulo += datos.velocidad * delta;
        nube.position.set(
          Math.cos(datos.angulo) * datos.radio,
          datos.altura + Math.sin(tiempo * 0.8 + datos.fase) * 0.05,
          Math.sin(datos.angulo) * datos.radio,
        );
      }
    };
  }

  #clipsDeGesto(gesto) {
    const prefijo = `${gesto}_`;
    return Object.keys(this.acciones).filter(
      (nombre) =>
        (nombre === gesto || nombre.startsWith(prefijo)) &&
        !nombre.endsWith("_secreto"),
    );
  }

  #clipDeGesto(gesto, animacion = null) {
    if (animacion && this.acciones[animacion]) return animacion;
    const clips = this.#clipsDeGesto(gesto);
    if (clips.length === 0) return this.acciones.idle ? "idle" : null;
    return clips[Math.floor(Math.random() * clips.length)];
  }

  #tocarGesto(gesto, animacion = null) {
    const nombre = this.#clipDeGesto(gesto, animacion);
    if (!nombre) return;
    const accion = this.acciones[nombre];
    if (!accion) return;
    if (nombre === "idle" || nombre === "estatua") {
      accion.setLoop(THREE.LoopRepeat, Infinity);
      accion.clampWhenFinished = false;
    } else {
      accion.setLoop(THREE.LoopOnce, 1);
      accion.clampWhenFinished = true;
    }
    accion.reset().play();
    if (this.accionActual && this.accionActual !== accion) {
      this.accionActual.crossFadeTo(accion, 0.3, false);
    }
    this.accionActual = accion;
    this.gestoActual = gesto;
    this.animacionActual = animacion;
  }

  hablar({ gesto = "explicar", animacion = null } = {}) {
    this.repetirGesto = true;
    this.#tocarGesto(gesto, animacion);
    this.cara?.setGesto(gesto);
  }

  gesto(nombre) {
    this.hablar({ gesto: nombre });
  }

  reposo() {
    this.repetirGesto = false;
    this.gestoActual = null;
    this.animacionActual = null;
    const nombre = this.acciones[this.reposoClip]
      ? this.reposoClip
      : this.acciones.idle
        ? "idle"
        : null;
    if (nombre) {
      const accion = this.acciones[nombre];
      accion.setLoop(THREE.LoopRepeat, Infinity);
      accion.clampWhenFinished = false;
      accion.reset().play();
      if (this.accionActual && this.accionActual !== accion) {
        this.accionActual.crossFadeTo(accion, 0.3, false);
      }
      this.accionActual = accion;
    }

    if (this.reposoClip === "estatua") {
      this.cara?.setOjos("cerrados");
      this.cara?.setBoca("cerrada");
    } else {
      this.cara?.setGesto("explicar");
      this.cara?.setBoca("cerrada");
    }
  }

  setBoca(boca) {
    this.cara?.setBoca(boca);
  }

  destacar(activo) {
    this.destacado = Boolean(activo);
  }

  mostrar(visible) {
    if (this.raiz) this.raiz.visible = Boolean(visible);
    if (this.focoLuz) this.focoLuz.visible = Boolean(visible);
  }

  aplicarPiel(nombre) {
    if (!this.esColoso || !PIELES[nombre] || this.piedra === nombre) return;
    this.piedra = nombre;
    this.materialPiedra = materialPiedra(nombre);
    this.raiz.traverse((objeto) => {
      if (!objeto.isMesh) return;
      if (objeto === this.mallaCara) return;
      if (this.mallasSilueta.has(objeto)) return;
      objeto.material = this.materialPiedra;
    });
    this.mallaCara.material.roughness = this.materialPiedra.roughness;
    this.mallaCara.material.metalness = this.materialPiedra.metalness;
    this.cara?.setFondo(`assets/pieles/${PIELES[nombre].archivo}`);
  }

  actualizar(delta, tiempo) {
    this.mezclador?.update(delta);
    this.nubesActualizar?.(tiempo, delta);

    const objetivo = this.destacado ? 0.35 : 0;
    this.desplazamiento +=
      (objetivo - this.desplazamiento) * (1 - Math.exp(-delta * 8));
    if (this.raiz) this.raiz.position.z = this.pos[2] + this.desplazamiento;

    if (this.focoLuz) {
      const intensidad = this.destacado ? 18 : 0;
      this.focoLuz.intensity +=
        (intensidad - this.focoLuz.intensity) * (1 - Math.exp(-delta * 6));
    }
  }
}
