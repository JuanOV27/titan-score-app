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

// Si nadie escribe ni él está hablando durante este rato, suelta una frase al azar. `?silencio=2000` en la
// URL lo cambia (solo sirve para probar sin esperar).
const SILENCIO_MS = Number(new URLSearchParams(location.search).get("silencio")) || 6000;
// Respuestas que no tienen sentido sueltas: el saludo, la despedida, los guiños y lo que habla de personajes
// que no salen en esta página.
const NO_SUELTAS = new Set(["saludo", "despedida", "estatua_easter", "quien_nubosa", "quien_coloso", "eres_ia"]);

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
let frasesSueltas = [];
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
  frasesSueltas = datos.respuestas.filter((r) => !NO_SUELTAS.has(r.id)).map((r) => r.id);
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

let hablando = false;       // Máximo está diciendo algo (una respuesta o una frase suelta)
let espontanea = false;     // y lo que dice no es respuesta a nadie, así que se puede cortar
let turno = 0;              // cada intervención tiene el suyo; quien la corta lo cambia

function bloquearEntrada(si) {
  texto.disabled = si;
  enviar.disabled = si;
  for (const b of sugerencias.querySelectorAll("button")) b.disabled = si;
}

// Corta lo que esté diciendo. Cambiar el turno antes de parar el audio hace que `decir` sepa que no se
// acabó solo: si no, creería que el audio falló y simularía los labios durante toda la frase.
function cortar() {
  turno += 1;
  labios.detener();
  hablando = false;
  espontanea = false;
}

async function decir(frase, suelta = false) {
  const mio = ++turno;
  hablando = true;
  espontanea = suelta;
  // Las respuestas bloquean la entrada mientras suenan; las frases sueltas no, para no dejar sin escribir
  // a quien quiera preguntar en medio de una.
  bloquearEntrada(!suelta);
  subtitulo.hidden = false;
  subtituloTexto.textContent = frase.texto;
  maximo.hablar({ gesto: frase.gesto ?? "explicar", animacion: frase.animacion ?? null });
  try {
    const sono = await labios.reproducir(`audio/${frase.id}.mp3`, (boca) => maximo.setBoca(boca));
    if (mio === turno && !sono) await labios.simular(frase.texto, (boca) => maximo.setBoca(boca));
  } finally {
    if (mio === turno) {            // si la cortaron, quien la cortó ya se ocupa del resto
      hablando = false;
      espontanea = false;
      bloquearEntrada(false);
      maximo.reposo();
      reiniciarSilencio();
    }
  }
}

async function preguntar(pregunta) {
  const limpia = String(pregunta).trim().slice(0, 150);
  if (!limpia || !maximo) return;
  if (hablando && !espontanea) return;      // está respondiendo a otra pregunta
  if (hablando) cortar();                   // soltaba una frase al azar: la corta para atender la pregunta
  texto.value = "";
  try {
    const hallazgo = comparador?.buscar(limpia);
    await decir(frases.get(hallazgo?.id) ?? frases.get(RESCATE));
  } catch (error) {
    console.error("No se pudo responder:", error);
  }
}

formulario.addEventListener("submit", (evento) => {
  evento.preventDefault();
  void preguntar(texto.value);
});

// --- frases al azar en los silencios ---------------------------------------------

let despierto = false;
let temporizadorSilencio = null;
let bolsa = [];                 // las frases sueltas, barajadas: no se repite ninguna hasta agotarlas todas
let ultima = null;

function siguienteFraseSuelta() {
  if (bolsa.length === 0) {
    bolsa = [...frasesSueltas];
    for (let i = bolsa.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [bolsa[i], bolsa[j]] = [bolsa[j], bolsa[i]];
    }
    // Al rebarajar, que la primera no sea la misma con la que acabó la ronda anterior.
    if (bolsa.length > 1 && bolsa[0] === ultima) bolsa.push(bolsa.shift());
  }
  ultima = bolsa.shift();
  return frases.get(ultima);
}

function reiniciarSilencio() {
  clearTimeout(temporizadorSilencio);
  if (!despierto) return;
  temporizadorSilencio = setTimeout(romperSilencio, SILENCIO_MS);
}

function romperSilencio() {
  // Si ya habla, alguien tiene algo escrito sin enviar o la pestaña está oculta, vuelve a esperar.
  if (hablando || document.hidden || texto.value.trim() || frasesSueltas.length === 0) {
    reiniciarSilencio();
    return;
  }
  void decir(siguienteFraseSuelta(), true).catch((error) => console.error("No se pudo hablar:", error));
}

// Escribir (o tocar el campo) cuenta como actividad: el silencio vuelve a empezar de cero.
texto.addEventListener("input", reiniciarSilencio);
texto.addEventListener("focus", reiniciarSilencio);
document.addEventListener("visibilitychange", reiniciarSilencio);

// --- arranque ------------------------------------------------------------------

botonDespertar.addEventListener("click", async () => {
  // Hace falta un toque del usuario para que el navegador deje sonar el audio.
  await labios.desbloquear().catch(() => false);
  despertar.hidden = true;
  despierto = true;
  bloquearEntrada(false);
  texto.focus({ preventScroll: true });
  if (frases.has(SALUDO)) await decir(frases.get(SALUDO)).catch(() => {});
  reiniciarSilencio();
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
