"use strict";
/**
 * ast.js — Definición de nodos del árbol de sintaxis abstracta (AST)
 * de CurrencyScript. Cada función de fábrica produce un objeto plano
 * con un campo "tipo" que identifica el nodo, más su posición (línea,
 * columna) para poder reportar errores semánticos con precisión.
 */

const Nodo = {
  Programa: (sentencias) => ({ tipo: "Programa", sentencias }),

  TasaDecl: (nombre, valor, linea, columna) => ({
    tipo: "TasaDecl",
    nombre,
    valor,
    linea,
    columna,
  }),

  VarDecl: (nombre, moneda, expresion, linea, columna) => ({
    tipo: "VarDecl",
    nombre,
    moneda,
    expresion,
    linea,
    columna,
  }),

  AssignStmt: (nombre, expresion, linea, columna) => ({
    tipo: "AssignStmt",
    nombre,
    expresion,
    linea,
    columna,
  }),

  PrintStmt: (expresion, esCadena, linea, columna) => ({
    tipo: "PrintStmt",
    expresion,
    esCadena,
    linea,
    columna,
  }),

  TotalStmt: (moneda, linea, columna) => ({
    tipo: "TotalStmt",
    moneda,
    linea,
    columna,
  }),

  IfStmt: (condicion, bloqueSi, bloqueSino, linea, columna) => ({
    tipo: "IfStmt",
    condicion,
    bloqueSi,
    bloqueSino,
    linea,
    columna,
  }),

  Condicion: (izquierda, operador, derecha, linea, columna) => ({
    tipo: "Condicion",
    izquierda,
    operador, // null si es una condición simple (solo la expresión, "truthy")
    derecha,
    linea,
    columna,
  }),

  ConvertExpr: (expresion, monedaDestino, linea, columna) => ({
    tipo: "ConvertExpr",
    expresion,
    monedaDestino,
    linea,
    columna,
  }),

  BinaryExpr: (izquierda, operador, derecha, linea, columna) => ({
    tipo: "BinaryExpr",
    izquierda,
    operador,
    derecha,
    linea,
    columna,
  }),

  UnaryExpr: (operador, operando, linea, columna) => ({
    tipo: "UnaryExpr",
    operador,
    operando,
    linea,
    columna,
  }),

  NumberLit: (valor, linea, columna) => ({
    tipo: "NumberLit",
    valor,
    linea,
    columna,
  }),

  StringLit: (valor, linea, columna) => ({
    tipo: "StringLit",
    valor,
    linea,
    columna,
  }),

  Identifier: (nombre, linea, columna) => ({
    tipo: "Identifier",
    nombre,
    linea,
    columna,
  }),
};

module.exports = { Nodo };
