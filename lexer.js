"use strict";
/**
 * lexer.js — Analizador léxico de CurrencyScript
 *
 * Convierte el código fuente en una lista de tokens {tipo, valor, linea, columna}.
 * Reconoce palabras reservadas, monedas predefinidas, identificadores, números,
 * cadenas, operadores, delimitadores y comentarios (que se descartan).
 */

const PALABRAS_RESERVADAS = {
  moneda: "MONEDA",
  tasa: "TASA",
  convertir: "CONVERTIR",
  en: "EN",
  var: "VAR",
  imprimir: "IMPRIMIR",
  total: "TOTAL",
  si: "SI",
  sino: "SINO",
};

const MONEDAS_VALIDAS = new Set(["USD", "EUR", "COP", "MXN", "BRL"]);

class ErrorLexico extends Error {
  constructor(mensaje, linea, columna) {
    super(mensaje);
    this.linea = linea;
    this.columna = columna;
  }
}

class Token {
  constructor(tipo, valor, linea, columna) {
    this.tipo = tipo;
    this.valor = valor;
    this.linea = linea;
    this.columna = columna;
  }
}

class Lexer {
  constructor(codigoFuente) {
    this.codigo = codigoFuente;
    this.pos = 0;
    this.linea = 1;
    this.columna = 1;
    this.tokens = [];
    this.errores = [];
  }

  caracterActual() {
    return this.codigo[this.pos];
  }

  mirarSiguiente(offset = 1) {
    return this.codigo[this.pos + offset];
  }

  avanzar() {
    const c = this.codigo[this.pos];
    this.pos++;
    if (c === "\n") {
      this.linea++;
      this.columna = 1;
    } else {
      this.columna++;
    }
    return c;
  }

  finDeArchivo() {
    return this.pos >= this.codigo.length;
  }

  agregarToken(tipo, valor, linea, columna) {
    this.tokens.push(new Token(tipo, valor, linea, columna));
  }

  esDigito(c) {
    return c >= "0" && c <= "9";
  }

  esLetra(c) {
    return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
  }

  esAlfanumerico(c) {
    return this.esLetra(c) || this.esDigito(c);
  }

  tokenizar() {
    while (!this.finDeArchivo()) {
      this.saltarEspaciosYComentarios();
      if (this.finDeArchivo()) break;

      const lineaInicio = this.linea;
      const colInicio = this.columna;
      const c = this.caracterActual();

      if (this.esDigito(c)) {
        this.leerNumero(lineaInicio, colInicio);
      } else if (this.esLetra(c)) {
        this.leerIdentificadorOPalabraClave(lineaInicio, colInicio);
      } else if (c === '"') {
        this.leerCadena(lineaInicio, colInicio);
      } else {
        this.leerOperadorODelimitador(lineaInicio, colInicio);
      }
    }
    this.agregarToken("EOF", null, this.linea, this.columna);
    return { tokens: this.tokens, errores: this.errores };
  }

  saltarEspaciosYComentarios() {
    while (!this.finDeArchivo()) {
      const c = this.caracterActual();
      if (c === " " || c === "\t" || c === "\r" || c === "\n") {
        this.avanzar();
      } else if (c === "/" && this.mirarSiguiente() === "/") {
        while (!this.finDeArchivo() && this.caracterActual() !== "\n") {
          this.avanzar();
        }
      } else if (c === "/" && this.mirarSiguiente() === "*") {
        const lineaApertura = this.linea;
        const colApertura = this.columna;
        this.avanzar();
        this.avanzar();
        let cerrado = false;
        while (!this.finDeArchivo()) {
          if (this.caracterActual() === "*" && this.mirarSiguiente() === "/") {
            this.avanzar();
            this.avanzar();
            cerrado = true;
            break;
          }
          this.avanzar();
        }
        if (!cerrado) {
          this.errores.push(
            new ErrorLexico(
              `comentario de bloque sin cerrar (iniciado en línea ${lineaApertura}, columna ${colApertura})`,
              lineaApertura,
              colApertura
            )
          );
        }
      } else {
        break;
      }
    }
  }

  leerNumero(linea, columna) {
    let valor = "";
    while (!this.finDeArchivo() && this.esDigito(this.caracterActual())) {
      valor += this.avanzar();
    }
    if (this.caracterActual() === "." && this.esDigito(this.mirarSiguiente())) {
      valor += this.avanzar(); // '.'
      while (!this.finDeArchivo() && this.esDigito(this.caracterActual())) {
        valor += this.avanzar();
      }
    }
    this.agregarToken("NUMBER", parseFloat(valor), linea, columna);
  }

  leerIdentificadorOPalabraClave(linea, columna) {
    let valor = "";
    while (!this.finDeArchivo() && this.esAlfanumerico(this.caracterActual())) {
      valor += this.avanzar();
    }

    if (Object.prototype.hasOwnProperty.call(PALABRAS_RESERVADAS, valor)) {
      this.agregarToken(PALABRAS_RESERVADAS[valor], valor, linea, columna);
    } else if (MONEDAS_VALIDAS.has(valor)) {
      this.agregarToken("CURRENCY", valor, linea, columna);
    } else {
      this.agregarToken("IDENTIFIER", valor, linea, columna);
    }
  }

  leerCadena(linea, columna) {
    this.avanzar(); // comilla de apertura
    let valor = "";
    let cerrada = false;
    while (!this.finDeArchivo()) {
      const c = this.caracterActual();
      if (c === '"') {
        this.avanzar();
        cerrada = true;
        break;
      }
      if (c === "\\") {
        this.avanzar();
        const escape = this.caracterActual();
        if (escape === "n") valor += "\n";
        else if (escape === "t") valor += "\t";
        else if (escape === '"') valor += '"';
        else if (escape === "\\") valor += "\\";
        else {
          this.errores.push(
            new ErrorLexico(
              `secuencia de escape desconocida '\\${escape}'`,
              this.linea,
              this.columna
            )
          );
          valor += escape;
        }
        this.avanzar();
        continue;
      }
      if (c === "\n") break; // cadena sin cerrar antes de fin de línea
      valor += this.avanzar();
    }
    if (!cerrada) {
      this.errores.push(
        new ErrorLexico("cadena de texto sin cerrar (falta '\"')", linea, columna)
      );
    }
    this.agregarToken("STRING", valor, linea, columna);
  }

  leerOperadorODelimitador(linea, columna) {
    const c = this.avanzar();
    switch (c) {
      case "=":
        if (this.caracterActual() === "=") {
          this.avanzar();
          this.agregarToken("EQ", "==", linea, columna);
        } else {
          this.agregarToken("ASSIGN", "=", linea, columna);
        }
        break;
      case "+":
        this.agregarToken("PLUS", "+", linea, columna);
        break;
      case "-":
        this.agregarToken("MINUS", "-", linea, columna);
        break;
      case "*":
        this.agregarToken("STAR", "*", linea, columna);
        break;
      case "/":
        this.agregarToken("SLASH", "/", linea, columna);
        break;
      case ";":
        this.agregarToken("SEMICOLON", ";", linea, columna);
        break;
      case ":":
        this.agregarToken("COLON", ":", linea, columna);
        break;
      case "(":
        this.agregarToken("LPAREN", "(", linea, columna);
        break;
      case ")":
        this.agregarToken("RPAREN", ")", linea, columna);
        break;
      case "{":
        this.agregarToken("LBRACE", "{", linea, columna);
        break;
      case "}":
        this.agregarToken("RBRACE", "}", linea, columna);
        break;
      case "<":
        if (this.caracterActual() === "=") {
          this.avanzar();
          this.agregarToken("LE", "<=", linea, columna);
        } else {
          this.agregarToken("LT", "<", linea, columna);
        }
        break;
      case ">":
        if (this.caracterActual() === "=") {
          this.avanzar();
          this.agregarToken("GE", ">=", linea, columna);
        } else {
          this.agregarToken("GT", ">", linea, columna);
        }
        break;
      case "!":
        if (this.caracterActual() === "=") {
          this.avanzar();
          this.agregarToken("NEQ", "!=", linea, columna);
        } else {
          this.errores.push(
            new ErrorLexico(`carácter inesperado '!'`, linea, columna)
          );
        }
        break;
      default:
        this.errores.push(
          new ErrorLexico(`carácter inesperado '${c}'`, linea, columna)
        );
    }
  }
}

module.exports = { Lexer, Token, ErrorLexico, PALABRAS_RESERVADAS, MONEDAS_VALIDAS };
