import { palabras, trigramas } from "./normalizar.js";

export const UMBRAL = 0.45;

const GRUPOS = [
  ["respuestas", "respuesta"],
  ["esquivas", "esquiva"],
];

function extraerRasgos(texto) {
  const rasgos = [];
  for (const palabra of palabras(texto)) {
    rasgos.push(`palabra:${palabra}`);
    for (const trigrama of trigramas(palabra)) {
      rasgos.push(`trigrama:${trigrama}`);
    }
  }
  return rasgos;
}

function calcularIdf(frecuencias, totalDocumentos) {
  return (rasgo) => Math.log((totalDocumentos + 1) / ((frecuencias.get(rasgo) ?? 0) + 1)) + 1;
}

function construirVector(rasgos, frecuencias, totalDocumentos) {
  const conteos = new Map();
  for (const rasgo of rasgos) {
    conteos.set(rasgo, (conteos.get(rasgo) ?? 0) + 1);
  }

  const idf = calcularIdf(frecuencias, totalDocumentos);
  const vector = new Map();
  let norma = 0;

  for (const [rasgo, conteo] of conteos) {
    const peso = (1 + Math.log(conteo)) * idf(rasgo);
    vector.set(rasgo, peso);
    norma += peso * peso;
  }

  if (norma === 0) return vector;

  const raiz = Math.sqrt(norma);
  for (const [rasgo, peso] of vector) {
    vector.set(rasgo, peso / raiz);
  }
  return vector;
}

function similitudCoseno(consulta, documento) {
  let suma = 0;
  for (const [rasgo, peso] of consulta) {
    const otroPeso = documento.get(rasgo);
    if (otroPeso !== undefined) suma += peso * otroPeso;
  }
  return suma;
}

export class Comparador {
  constructor(datos, { umbral = UMBRAL } = {}) {
    if (!datos || typeof datos !== "object") {
      throw new TypeError("El comparador necesita el objeto de respuestas.json");
    }

    this.umbral = umbral;
    this.documentos = [];

    for (const [clave, tipo] of GRUPOS) {
      const entradas = Array.isArray(datos[clave]) ? datos[clave] : [];
      for (const entrada of entradas) {
        if (!entrada || !Array.isArray(entrada.preguntas)) continue;
        for (const pregunta of entrada.preguntas) {
          this.documentos.push({
            id: entrada.id,
            tipo,
            rasgos: extraerRasgos(pregunta),
          });
        }
      }
    }

    this.frecuencias = new Map();
    for (const documento of this.documentos) {
      for (const rasgo of new Set(documento.rasgos)) {
        this.frecuencias.set(rasgo, (this.frecuencias.get(rasgo) ?? 0) + 1);
      }
    }

    this.totalDocumentos = this.documentos.length;
    for (const documento of this.documentos) {
      documento.vector = construirVector(
        documento.rasgos,
        this.frecuencias,
        this.totalDocumentos,
      );
    }
  }

  buscar(texto) {
    const consulta = construirVector(
      extraerRasgos(texto),
      this.frecuencias,
      this.totalDocumentos,
    );

    if (consulta.size === 0 || this.documentos.length === 0) return null;

    let mejor = null;
    for (const documento of this.documentos) {
      const puntaje = similitudCoseno(consulta, documento.vector);
      if (mejor === null || puntaje > mejor.puntaje) {
        mejor = { id: documento.id, puntaje, tipo: documento.tipo };
      }
    }

    if (mejor === null || mejor.puntaje < this.umbral) return null;
    return mejor;
  }
}
