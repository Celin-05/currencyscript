"use strict";
/**
 * parser.js — Analizador sintáctico de descenso recursivo para CurrencyScript.
 *
 * Construye un AST explícito (ver ast.js) a partir de la lista de tokens
 * producida por el lexer. Implementa recuperación de errores en modo pánico:
 * al detectar un error sintáctico, reporta línea/columna con lo esperado y lo
 * encontrado, y avanza tokens hasta un punto de sincronización (';', '}' o el
 * inicio de una sentencia reconocible), permitiendo reportar varios errores
 * de sintaxis en una sola pasada en lugar de detenerse en el primero.
 */

const { Nodo } = require("./ast");

class ErrorSintactico extends Error {
  constructor(mensaje, linea, columna) {
    super(mensaje);
    this.linea = linea;
    this.columna = columna;
  }
}

const INICIO_SENTENCIA = new Set([
  "TASA",
  "VAR",
  "IMPRIMIR",
  "TOTAL",
  "SI",
  "SINO",
]);

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.errores = [];
  }

  actual() {
    return this.tokens[this.pos];
  }

  siguiente(offset = 1) {
    return this.tokens[this.pos + offset] || this.tokens[this.tokens.length - 1];
  }

  finDeArchivo() {
    return this.actual().tipo === "EOF";
  }

  avanzar() {
    const t = this.actual();
    if (!this.finDeArchivo()) this.pos++;
    return t;
  }

  chequear(tipo) {
    return this.actual().tipo === tipo;
  }

  consumir(tipo, descripcionEsperada) {
    if (this.chequear(tipo)) return this.avanzar();
    const t = this.actual();
    const encontrado = t.tipo === "EOF" ? "fin de archivo" : `'${t.valor}'`;
    throw new ErrorSintactico(
      `se esperaba ${descripcionEsperada}, se encontró ${encontrado}`,
      t.linea,
      t.columna
    );
  }

  // --- Sincronización en modo pánico ---
  sincronizar() {
    while (!this.finDeArchivo()) {
      const anterior = this.tokens[this.pos - 1];
      if (anterior && (anterior.tipo === "SEMICOLON" || anterior.tipo === "RBRACE")) {
        return;
      }
      if (INICIO_SENTENCIA.has(this.actual().tipo)) return;
      this.avanzar();
    }
  }

  parsearPrograma() {
    const sentencias = [];
    while (!this.finDeArchivo()) {
      try {
        const s = this.parsearSentencia();
        if (s) sentencias.push(s);
      } catch (e) {
        if (e instanceof ErrorSintactico) {
          this.errores.push(e);
          this.sincronizar();
        } else {
          throw e;
        }
      }
    }
    return Nodo.Programa(sentencias);
  }

  parsearSentencia() {
    switch (this.actual().tipo) {
      case "TASA":
        return this.parsearTasaDecl();
      case "VAR":
        return this.parsearVarDecl();
      case "IMPRIMIR":
        return this.parsearPrintStmt();
      case "TOTAL":
        return this.parsearTotalStmt();
      case "SI":
        return this.parsearIfStmt();
      case "IDENTIFIER":
        return this.parsearAssignStmt();
      default: {
        const t = this.actual();
        const encontrado = t.tipo === "EOF" ? "fin de archivo" : `'${t.valor}'`;
        throw new ErrorSintactico(
          `se esperaba una sentencia (tasa, var, imprimir, total, si, o una asignación), se encontró ${encontrado}`,
          t.linea,
          t.columna
        );
      }
    }
  }

  parsearBloque() {
    const inicioLlave = this.consumir("LBRACE", "'{' para abrir el bloque");
    const sentencias = [];
    while (!this.finDeArchivo() && !this.chequear("RBRACE")) {
      try {
        const s = this.parsearSentencia();
        if (s) sentencias.push(s);
      } catch (e) {
        if (e instanceof ErrorSintactico) {
          this.errores.push(e);
          this.sincronizar();
        } else {
          throw e;
        }
      }
    }
    this.consumir("RBRACE", "'}' para cerrar el bloque");
    return sentencias;
  }

  parsearTasaDecl() {
    const inicio = this.consumir("TASA", "'tasa'");
    const nombreTok = this.consumir("IDENTIFIER", "un identificador para la tasa");
    this.consumir("ASSIGN", "'=' después del nombre de la tasa");
    const valor = this.parsearSignoNum();
    this.consumir("SEMICOLON", "';' al final de la declaración de tasa");
    return Nodo.TasaDecl(nombreTok.valor, valor, inicio.linea, inicio.columna);
  }

  // signoNum ::= '-' NUMBER | NUMBER
  parsearSignoNum() {
    if (this.chequear("MINUS")) {
      const menos = this.avanzar();
      const numTok = this.consumir("NUMBER", "un valor numérico después de '-'");
      return -numTok.valor;
    }
    const numTok = this.consumir("NUMBER", "un valor numérico para la tasa");
    return numTok.valor;
  }

  parsearVarDecl() {
    const inicio = this.consumir("VAR", "'var'");
    const nombreTok = this.consumir("IDENTIFIER", "un identificador de variable");
    this.consumir("COLON", "':' seguido del tipo de moneda");
    const monedaTok = this.consumir(
      "CURRENCY",
      "una moneda válida (USD, EUR, COP, MXN o BRL)"
    );
    this.consumir("ASSIGN", "'=' después del tipo de moneda");
    const expresion = this.parsearExpresion();
    this.consumir("SEMICOLON", "';' al final de la declaración de variable");
    return Nodo.VarDecl(
      nombreTok.valor,
      monedaTok.valor,
      expresion,
      inicio.linea,
      inicio.columna
    );
  }

  parsearAssignStmt() {
    const nombreTok = this.consumir("IDENTIFIER", "un identificador");
    this.consumir("ASSIGN", "'=' en la asignación");
    const expresion = this.parsearExpresion();
    this.consumir("SEMICOLON", "';' al final de la asignación");
    return Nodo.AssignStmt(
      nombreTok.valor,
      expresion,
      nombreTok.linea,
      nombreTok.columna
    );
  }

  parsearPrintStmt() {
    const inicio = this.consumir("IMPRIMIR", "'imprimir'");
    if (this.chequear("STRING")) {
      const strTok = this.avanzar();
      this.consumir("SEMICOLON", "';' al final de la sentencia imprimir");
      return Nodo.PrintStmt(
        Nodo.StringLit(strTok.valor, strTok.linea, strTok.columna),
        true,
        inicio.linea,
        inicio.columna
      );
    }
    const expresion = this.parsearExpresion();
    this.consumir("SEMICOLON", "';' al final de la sentencia imprimir");
    return Nodo.PrintStmt(expresion, false, inicio.linea, inicio.columna);
  }

  parsearTotalStmt() {
    const inicio = this.consumir("TOTAL", "'total'");
    const monedaTok = this.consumir(
      "CURRENCY",
      "una moneda válida (USD, EUR, COP, MXN o BRL) después de 'total'"
    );
    this.consumir("SEMICOLON", "';' al final de la sentencia total");
    return Nodo.TotalStmt(monedaTok.valor, inicio.linea, inicio.columna);
  }

  parsearIfStmt() {
    const inicio = this.consumir("SI", "'si'");
    this.consumir("LPAREN", "'(' después de 'si'");
    const condicion = this.parsearCondicion();
    this.consumir("RPAREN", "')' para cerrar la condición");
    const bloqueSi = this.parsearBloque();
    let bloqueSino = null;
    if (this.chequear("SINO")) {
      this.avanzar();
      bloqueSino = this.parsearBloque();
    }
    return Nodo.IfStmt(condicion, bloqueSi, bloqueSino, inicio.linea, inicio.columna);
  }

  // condicion ::= expresion ( ('<'|'>'|'<='|'>='|'=='|'!=') expresion )?
  parsearCondicion() {
    const inicio = this.actual();
    const izquierda = this.parsearExpresion();
    const operadoresRelacionales = new Set(["LT", "GT", "LE", "GE", "EQ", "NEQ"]);
    if (operadoresRelacionales.has(this.actual().tipo)) {
      const opTok = this.avanzar();
      const derecha = this.parsearExpresion();
      return Nodo.Condicion(
        izquierda,
        opTok.valor,
        derecha,
        inicio.linea,
        inicio.columna
      );
    }
    return Nodo.Condicion(izquierda, null, null, inicio.linea, inicio.columna);
  }

  // expresion ::= convertExpr | addExpr
  parsearExpresion() {
    if (this.chequear("CONVERTIR")) return this.parsearConvertExpr();
    return this.parsearAddExpr();
  }

  parsearConvertExpr() {
    const inicio = this.consumir("CONVERTIR", "'convertir'");
    const expresion = this.parsearAddExpr();
    this.consumir("EN", "'en' después de la expresión a convertir");
    const monedaTok = this.consumir(
      "CURRENCY",
      "una moneda válida (USD, EUR, COP, MXN o BRL) después de 'en'"
    );
    return Nodo.ConvertExpr(expresion, monedaTok.valor, inicio.linea, inicio.columna);
  }

  parsearAddExpr() {
    let izquierda = this.parsearMulExpr();
    while (this.chequear("PLUS") || this.chequear("MINUS")) {
      const opTok = this.avanzar();
      const derecha = this.parsearMulExpr();
      izquierda = Nodo.BinaryExpr(
        izquierda,
        opTok.valor,
        derecha,
        opTok.linea,
        opTok.columna
      );
    }
    return izquierda;
  }

  parsearMulExpr() {
    let izquierda = this.parsearUnario();
    while (this.chequear("STAR") || this.chequear("SLASH")) {
      const opTok = this.avanzar();
      const derecha = this.parsearUnario();
      izquierda = Nodo.BinaryExpr(
        izquierda,
        opTok.valor,
        derecha,
        opTok.linea,
        opTok.columna
      );
    }
    return izquierda;
  }

  // unario ::= '-' primaria | primaria
  parsearUnario() {
    if (this.chequear("MINUS")) {
      const opTok = this.avanzar();
      const operando = this.parsearUnario();
      return Nodo.UnaryExpr(opTok.valor, operando, opTok.linea, opTok.columna);
    }
    return this.parsearPrimaria();
  }

  parsearPrimaria() {
    const t = this.actual();
    if (t.tipo === "NUMBER") {
      this.avanzar();
      return Nodo.NumberLit(t.valor, t.linea, t.columna);
    }
    if (t.tipo === "IDENTIFIER") {
      this.avanzar();
      return Nodo.Identifier(t.valor, t.linea, t.columna);
    }
    if (t.tipo === "LPAREN") {
      this.avanzar();
      const expresion = this.parsearExpresion();
      this.consumir("RPAREN", "')' para cerrar la expresión agrupada");
      return expresion;
    }
    const encontrado = t.tipo === "EOF" ? "fin de archivo" : `'${t.valor}'`;
    throw new ErrorSintactico(
      `se esperaba un número, un identificador o '(', se encontró ${encontrado}`,
      t.linea,
      t.columna
    );
  }
}

module.exports = { Parser, ErrorSintactico };
