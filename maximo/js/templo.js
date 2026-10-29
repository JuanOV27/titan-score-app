// El Templo: escenario de fondo compartido por el kiosco (escenario.js) y la página pública (web.js).
// Todo es geometría generada aquí, sin modelos ni texturas pesadas, para que cargue rápido en un teléfono.
// Los personajes quedan sobre una plataforma de dos escalones, entre dos filas de columnas de mármol y
// dos pebeteros con fuego morado; al fondo, un muro con portal y frontón que se pierde en la neblina.
import * as THREE from "../vendor/three/three.module.js";

const NIEBLA = "#0e0a16";
const MORADO = 0x8b5cf6;

// Losas de piedra para el piso, dibujadas en un canvas: juntas oscuras y un tono distinto por losa.
function texturaLosas() {
  const lado = 512;
  const lienzo = document.createElement("canvas");
  lienzo.width = lienzo.height = lado;
  const ctx = lienzo.getContext("2d");
  ctx.fillStyle = "#14111a";
  ctx.fillRect(0, 0, lado, lado);
  const n = 4;
  const paso = lado / n;
  for (let fila = 0; fila < n; fila += 1) {
    for (let col = 0; col < n; col += 1) {
      const luz = 38 + Math.floor(Math.random() * 14);
      ctx.fillStyle = `rgb(${luz}, ${luz - 3}, ${luz + 6})`;
      ctx.fillRect(col * paso + 3, fila * paso + 3, paso - 6, paso - 6);
      // Vetas suaves para que no parezca plástico.
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.beginPath();
      ctx.moveTo(col * paso + Math.random() * paso, fila * paso);
      ctx.lineTo(col * paso + Math.random() * paso, (fila + 1) * paso);
      ctx.stroke();
    }
  }
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.wrapS = textura.wrapT = THREE.RepeatWrapping;
  return textura;
}

function texturaMarmol(cargador, repetir) {
  const t = cargador.load("assets/pieles/marmol.webp");
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repetir);
  return t;
}

// Columna dórica: basa, fuste con estrías (muchos lados) y capitel.
function columna(material, alto) {
  const grupo = new THREE.Group();
  const basa = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.18, 0.62), material);
  basa.position.y = 0.09;
  const fuste = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, alto, 20, 1), material);
  fuste.position.y = 0.18 + alto / 2;
  const equino = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.22, 0.14, 20), material);
  equino.position.y = 0.18 + alto + 0.07;
  const abaco = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.7), material);
  abaco.position.y = 0.18 + alto + 0.21;
  grupo.add(basa, fuste, equino, abaco);
  return grupo;
}

// Pebetero: trípode con cuenco y una llama hecha de conos que titilan, más una luz que la acompaña.
function pebetero(materialMetal) {
  const grupo = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.0, 6), materialMetal);
    const angulo = (i / 3) * Math.PI * 2;
    pata.position.set(Math.cos(angulo) * 0.16, 0.5, Math.sin(angulo) * 0.16);
    pata.rotation.z = Math.cos(angulo) * 0.18;
    pata.rotation.x = -Math.sin(angulo) * 0.18;
    grupo.add(pata);
  }
  const cuenco = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.16, 0.2, 18, 1, true), materialMetal);
  cuenco.position.y = 1.08;
  grupo.add(cuenco);

  const llamas = [];
  const colores = [0x6d28d9, 0x8b5cf6, 0xc4b5fd];
  colores.forEach((color, i) => {
    const llama = new THREE.Mesh(
      new THREE.ConeGeometry(0.2 - i * 0.05, 0.55 - i * 0.12, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.55 + i * 0.15,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    llama.position.y = 1.32 - i * 0.04;
    llama.userData.fase = Math.random() * Math.PI * 2;
    llamas.push(llama);
    grupo.add(llama);
  });
  const luz = new THREE.PointLight(MORADO, 6, 5.5, 1.6);
  luz.position.y = 1.5;
  grupo.add(luz);

  const actualizar = (t) => {
    llamas.forEach((llama, i) => {
      const f = llama.userData.fase;
      const s = 1 + Math.sin(t * (9 + i * 3) + f) * 0.08 + Math.sin(t * 23 + f) * 0.04;
      llama.scale.set(1 + Math.sin(t * 7 + f) * 0.05, s, 1 + Math.cos(t * 6 + f) * 0.05);
      llama.rotation.y = t * (0.6 + i * 0.4);
    });
    luz.intensity = 6 + Math.sin(t * 11) * 0.8 + Math.sin(t * 27) * 0.5;
  };
  return { grupo, actualizar };
}

/**
 * Construye el templo en la escena. `ligero` (teléfono) usa menos columnas y geometría, y estrecha la
 * nave para que columnas y pebeteros entren en una pantalla vertical con un solo personaje.
 * Devuelve { actualizar(t) } para animar el fuego en el bucle de render.
 */
export function crearTemplo(escena, { ligero = false } = {}) {
  const xColumnas = ligero ? 1.55 : 2.8;      // la plataforma mide 4,6 m: en el teléfono se ve mucho menos
  const xFuego = ligero ? 0.95 : 1.75;
  escena.background = new THREE.Color(NIEBLA);
  escena.fog = new THREE.Fog(NIEBLA, ligero ? 5 : 6, ligero ? 15 : 19);

  const cargador = new THREE.TextureLoader();
  const marmol = new THREE.MeshStandardMaterial({ map: texturaMarmol(cargador, [1, 3]), color: 0xcfc6d8, roughness: 0.55 });
  const marmolBloque = new THREE.MeshStandardMaterial({ map: texturaMarmol(cargador, [4, 1]), color: 0xb9b0c4, roughness: 0.6 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x3b3346, roughness: 0.35, metalness: 0.8 });
  const templo = new THREE.Group();
  templo.name = "templo";

  // Piso de losas.
  const losas = texturaLosas();
  losas.repeat.set(12, 12);
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: losas, roughness: 0.85 }));
  piso.rotation.x = -Math.PI / 2;
  piso.position.set(0, -0.32, -6);
  templo.add(piso);

  // Plataforma de dos escalones donde están los personajes (su suelo queda en y = 0).
  const escalonAbajo = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.16, 2.6), marmolBloque);
  escalonAbajo.position.set(0, -0.24, -0.3);
  const escalonArriba = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.16, 2.0), marmolBloque);
  escalonArriba.position.set(0, -0.08, -0.4);
  templo.add(escalonAbajo, escalonArriba);

  // Dos filas de columnas que se alejan hacia el fondo.
  const alto = 4.4;
  const filas = ligero ? [-2.2, -4.8, -7.4] : [-1.6, -3.8, -6.0, -8.2, -10.4];
  for (const z of filas) {
    for (const x of [-xColumnas, xColumnas]) {
      const c = columna(marmol, alto);
      c.position.set(x, -0.32, z);
      templo.add(c);
    }
  }
  // Arquitrabe sobre cada fila.
  const largo = Math.abs(filas.at(-1) - filas[0]) + 1;
  for (const x of [-xColumnas, xColumnas]) {
    const viga = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, largo), marmolBloque);
    viga.position.set(x, -0.32 + alto + 0.5, (filas[0] + filas.at(-1)) / 2);
    templo.add(viga);
  }

  // Muro del fondo con portal y frontón.
  const zMuro = filas.at(-1) - 1.4;
  const muroMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2433, roughness: 0.9 });
  for (const x of [-3.6, 3.6]) {
    const lado = new THREE.Mesh(new THREE.BoxGeometry(4.4, 6, 0.6), muroMaterial);
    lado.position.set(x, 2.68, zMuro);
    templo.add(lado);
  }
  const dintel = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.6, 0.6), muroMaterial);
  dintel.position.set(0, 4.88, zMuro);
  templo.add(dintel);
  // Luz morada que sale del portal.
  const portal = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 4.4),
    new THREE.MeshBasicMaterial({ color: 0x4c1d95, transparent: true, opacity: 0.55, fog: false }),
  );
  portal.position.set(0, 1.88, zMuro - 0.2);
  templo.add(portal);
  const fronton = new THREE.Mesh(new THREE.ConeGeometry(5.6, 1.4, 3, 1), marmolBloque);
  fronton.rotation.z = Math.PI / 2;
  fronton.rotation.y = Math.PI / 2;
  fronton.scale.set(1, 1, 0.12);
  fronton.position.set(0, 6.4, zMuro + 0.1);
  templo.add(fronton);

  // Pebeteros detrás de los personajes, a los lados.
  const fuegos = [];
  for (const x of [-xFuego, xFuego]) {
    const p = pebetero(metal);
    p.grupo.position.set(x, -0.16, ligero ? -1.2 : -1.5);
    templo.add(p.grupo);
    fuegos.push(p);
  }

  // Polvo flotando en el aire, iluminado por el fuego (solo en la laptop).
  let polvo = null;
  if (!ligero) {
    const n = 220;
    const posiciones = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) {
      posiciones[i * 3] = (Math.random() - 0.5) * 7;
      posiciones[i * 3 + 1] = Math.random() * 4.5;
      posiciones[i * 3 + 2] = -Math.random() * 9;
    }
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute("position", new THREE.BufferAttribute(posiciones, 3));
    polvo = new THREE.Points(geometria, new THREE.PointsMaterial({
      color: 0xc4b5fd, size: 0.025, transparent: true, opacity: 0.5, depthWrite: false,
    }));
    templo.add(polvo);
  }

  escena.add(templo);

  return {
    actualizar(t) {
      for (const f of fuegos) f.actualizar(t);
      if (polvo) polvo.rotation.y = Math.sin(t * 0.05) * 0.08;
    },
  };
}
