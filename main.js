"use strict";
/**
 * main.js — Punto de entrada de CurrencyScript.
 *
 * Ejecuta las tres fases (léxica, sintáctica, semántica) sobre cada uno
 * de los programas de prueba en ./pruebas/, e imprime en consola el
 * resultado de cada fase con el formato de error especificado en las
 * Orientaciones Generales:
 *
 *   Error léxico    [línea L, columna C]: <descripción>
 *   Error sintáctico [línea L, columna C]: <descripción>
 *   Error semántico [línea L]: <descripción>
 */

const fs = require("fs");
const path = require("path");
const { Lexer } = require("./lexer");
const { Parser } = require("./parser");
const { AnalizadorSemantico } = require("./semantic");

function analizarArchivo(rutaArchivo) {
  const nombre = path.basename(rutaArchivo);
  console.log("=".repeat(70));
  console.log(`Analizando: ${nombre}`);
  console.log("=".repeat(70));

  const codigoFuente = fs.readFileSync(rutaArchivo, "utf-8");

  // --- Fase 1: Léxica ---
  const lexer = new Lexer(codigoFuente);
  const { tokens, errores: erroresLexicos } = lexer.tokenizar();

  if (erroresLexicos.length > 0) {
    for (const e of erroresLexicos) {
      console.log(`Error léxico [línea ${e.linea}, columna ${e.columna}]: ${e.message}`);
    }
    console.log(`\nResultado: ${erroresLexicos.length} error(es) léxico(s). Se detiene el análisis.\n`);
    return { fase: "lexica", ok: false };
  }
  console.log(`Fase léxica: OK (${tokens.length} tokens reconocidos)`);

  // --- Fase 2: Sintáctica ---
  const parser = new Parser(tokens);
  const ast = parser.parsearPrograma();

  if (parser.errores.length > 0) {
    for (const e of parser.errores) {
      console.log(`Error sintáctico [línea ${e.linea}, columna ${e.columna}]: ${e.message}`);
    }
    console.log(`\nResultado: ${parser.errores.length} error(es) sintáctico(s). No se continúa al análisis semántico.\n`);
    return { fase: "sintactica", ok: false };
  }
  console.log(`Fase sintáctica: OK (AST construido con ${ast.sentencias.length} sentencia(s) de nivel superior)`);

  // --- Fase 3: Semántica ---
  const analizador = new AnalizadorSemantico();
  const erroresSemanticos = analizador.analizar(ast);

  if (erroresSemanticos.length > 0) {
    for (const e of erroresSemanticos) {
      console.log(`Error semántico [línea ${e.linea}]: ${e.message}`);
    }
    console.log(`\nResultado: ${erroresSemanticos.length} error(es) semántico(s).\n`);
    return { fase: "semantica", ok: false };
  }

  console.log("Fase semántica: OK (sin errores)");
  console.log("\nResultado: el programa es válido en las tres fases.\n");
  return { fase: "ninguna", ok: true };
}

function main() {
  const carpetaPruebas = path.join(__dirname, "pruebas");
  const archivos = [
    "prueba_valida.cs",
    "prueba_error_sintactico.cs",
    "prueba_error_semantico.cs",
    "prueba_extendida.cs",
  ];

  const resumen = [];
  for (const archivo of archivos) {
    const ruta = path.join(carpetaPruebas, archivo);
    if (!fs.existsSync(ruta)) {
      console.log(`(Aviso: no se encontró ${archivo}, se omite)`);
      continue;
    }
    const resultado = analizarArchivo(ruta);
    resumen.push({ archivo, ...resultado });
  }

  console.log("=".repeat(70));
  console.log("RESUMEN");
  console.log("=".repeat(70));
  for (const r of resumen) {
    const estado = r.ok ? "OK" : `ERROR (fase ${r.fase})`;
    console.log(`  ${r.archivo.padEnd(30)} -> ${estado}`);
  }
}

main();
