// Página pública de Máximo (GitHub Pages): sin servidor ni IA. El comparador corre en el navegador
// contra respuestas.json y Máximo contesta con las grabaciones de Juan. Lo que no tiene respuesta
// preparada se manda al puesto de la feria con la frase de rescate.
import * as THREE from "../vendor/three/three.module.js";
import { Avatar } from "./avatar.js";
import { crearTemplo } from "./templo.js";
import { Labios } from "./labios.js";
import { Comparador } from "../compartido/comparador.js";

const RESCATE = "sis_rescate_2";      // "Eso todavía no lo sé… pregúntale a mi creador aquí en el puesto."
const SALUDO = "saludo";

const mundo = document.querySelector("#mundo");
const subtitulo = document.querySelector("#subtitulo");
const subtituloTexto = document.querySelector("#subtituloTexto");
const sugerencias = document.querySelector("#sugerencias");
const formulario = document.querySelector("#formulario");
const texto = document.querySelector("#texto");
const enviar = document.querySelector("#enviar");
const despertar = document.querySelector("#despertar");
const botonDespertar = document.querySelector("#botonDespertar");
const progreso = document.querySelector("#progreso");

// --- escena ------------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
mundo.appendChild(renderer.domElement);

const escena = new THREE.Scene();
const templo = crearTemplo(escena, { ligero: true });
const camara = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
escena.add(new THREE.HemisphereLight(0xffffff, 0x332211, 1.1));
const sol = new THREE.DirectionalLight(0xfff1e0, 2.0);
sol.position.set(1.5, 3, 3);
escena.add(sol);
const contra = new THREE.DirectionalLight(0x8b5cf6, 1.6);
contra.position.set(-2, 2, -2);
escena.add(contra);

// Máximo de la cintura para arriba, por encima del chat. En vertical (teléfono) se abre el campo de
// visión para que quepan los brazos; la cámara apunta un poco abajo de la cabeza.
function encuadrar() {
  const ancho = window.innerWidth;
  const alto = window.innerHeight;
  renderer.setSize(ancho, alto);
  camara.aspect = ancho / alto;
  const horizontal = 2 * Math.atan(1.25 / 2 / 2.6);          // 1,25 m de ancho visibles a 2,6 m
  const vertical = 2 * Math.atan(Math.tan(horizontal / 2) / camara.aspect);
  camara.fov = Math.max(34, THREE.MathUtils.radToDeg(vertical));
  camara.position.set(0, 1.2, 2.6);
  // El chat tapa la parte de abajo: se sube el punto de mira para que Máximo quede encima.
  camara.lookAt(0, camara.aspect < 1 ? 0.9 : 1.05, 0);
  camara.updateProjectionMatrix();
}
window.addEventListener("resize", encuadrar);
encuadrar();

const labios = new Labios();
const reloj = new THREE.Clock();
let maximo = null;

(function bucle() {
  requestAnimationFrame(bucle);
  const delta = reloj.getDelta();
  maximo?.actualizar(delta, reloj.elapsedTime);
  templo.actualizar(reloj.elapsedTime);
  renderer.render(escena, camara);
})();

// --- respuestas ----------------------------------------------------------------

let comparador = null;
const frases = new Map();

async function cargarRespuestas() {
  const datos = await fetch("respuestas.json").then((r) => {
    if (!r.ok) throw new Error("No se pudo leer respuestas.json");
    return r.json();
  });
  comparador = new Comparador(datos);
  for (const frase of [...datos.respuestas, ...datos.esquivas, ...Object.values(datos.sistema).flat()]) {
    frases.set(frase.id, frase);
  }
  // Sugerencias: la primera variante de 6 respuestas al azar, escrita como pregunta.
  const opciones = datos.respuestas.filter((r) => r.categoria !== "personaje" || r.id === "historia");
  for (let i = opciones.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [opciones[i], opciones[j]] = [opciones[j], opciones[i]];
  }
  sugerencias.replaceChildren(...opciones.slice(0, 6).map((r) => {
    const variante = r.preguntas[0];
    const boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = `¿${variante.charAt(0).toUpperCase()}${variante.slice(1)}?`;
    boton.addEventListener("click", () => preguntar(boton.textContent));
    return boton;
  }));
}

// --- conversación ---------------------------------------------------------------

let hablando = false;

function bloquear(si) {
  hablando = si;
  texto.disabled = si;
  enviar.disabled = si;
  for (const b of sugerencias.querySelectorAll("button")) b.disabled = si;
}

async function decir(frase) {
  subtitulo.hidden = false;
  subtituloTexto.textContent = frase.texto;
  maximo.hablar({ gesto: frase.gesto ?? "explicar", animacion: frase.animacion ?? null });
  const sono = await labios.reproducir(`audio/${frase.id}.mp3`, (boca) => maximo.setBoca(boca));
  if (!sono) await labios.simular(frase.texto, (boca) => maximo.setBoca(boca));
  maximo.reposo();
}

async function preguntar(pregunta) {
  const limpia = String(pregunta).trim().slice(0, 150);
  if (!limpia || hablando || !maximo) return;
  bloquear(true);
  texto.value = "";
  try {
    const hallazgo = comparador?.buscar(limpia);
    await decir(frases.get(hallazgo?.id) ?? frases.get(RESCATE));
  } catch (error) {
    console.error("No se pudo responder:", error);
  } finally {
    bloquear(false);
  }
}

formulario.addEventListener("submit", (evento) => {
  evento.preventDefault();
  void preguntar(texto.value);
});

// --- arranque ------------------------------------------------------------------

botonDespertar.addEventListener("click", async () => {
  // Hace falta un toque del usuario para que el navegador deje sonar el audio.
  await labios.desbloquear().catch(() => false);
  despertar.hidden = true;
  bloquear(false);
  texto.focus({ preventScroll: true });
  if (frases.has(SALUDO)) {
    bloquear(true);
    await decir(frases.get(SALUDO)).catch(() => {});
    bloquear(false);
  }
});

Promise.all([
  new Avatar({ escena, id: "maximo", glb: "assets/maximo.glb", cara: "cara", piel: "#B8743F", formas: { Mister_T: 1 }, ropa: { pantalon: "#7C3AED" } }).cargar(),
  cargarRespuestas(),
])
  .then(([avatar]) => {
    maximo = avatar;
    botonDespertar.disabled = false;
    botonDespertar.textContent = "Despertar a Máximo";
    progreso.textContent = "Listo. Toca para empezar.";
  })
  .catch((error) => {
    console.error(error);
    progreso.textContent = "No se pudo cargar a Máximo. Revisa tu conexión y recarga la página.";
  });
