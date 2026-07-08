"use strict";
/**
 * semantic.js — Analizador semántico de CurrencyScript.
 *
 * Recorre el AST manteniendo una tabla de símbolos con ÁMBITOS ANIDADOS
 * (cada bloque { } de un 'si'/'sino' abre un ámbito propio). Verifica:
 *
 *   Obligatorias por Orientaciones Generales (4.3):
 *     - Variable/tasa usada sin declarar.
 *     - Variable/tasa redeclarada en el mismo ámbito.
 *     - Tipos incompatibles en operaciones (+, -, comparaciones).
 *     - Uso antes de asignación: en CurrencyScript, declarar y asignar
 *       ocurren en la misma sentencia ('var x : USD = ...;'), por lo que
 *       este requisito se interpreta como "uso antes del punto de
 *       declaración" (el análisis es secuencial, sin hoisting). Ver
 *       sección 5.5 del documento técnico para la justificación completa.
 *
 *   Propias del dominio (ficha del Estudiante 2):
 *     - Suma/resta entre monedas distintas (o entre moneda y número puro).
 *     - Tasa requerida antes de convertir (con búsqueda transitiva).
 *     - Tasas estrictamente positivas.
 */

class ErrorSemantico extends Error {
  constructor(mensaje, linea) {
    super(mensaje);
    this.linea = linea;
  }
}

const NUMERO = "NUMERO"; // pseudo-tipo para literales/expresiones sin moneda

class Ambito {
  constructor(padre = null) {
    this.padre = padre;
    this.variables = new Map(); // nombre -> { moneda, linea }
    this.tasas = new Map(); // nombre -> { valor, linea }
  }

  declararVariable(nombre, moneda, linea) {
    if (this.variables.has(nombre)) {
      throw new ErrorSemantico(
        `la variable '${nombre}' ya fue declarada en este mismo ámbito`,
        linea
      );
    }
    this.variables.set(nombre, { moneda, linea });
  }

  declararTasa(nombre, valor, linea) {
    if (this.tasas.has(nombre)) {
      throw new ErrorSemantico(
        `la tasa '${nombre}' ya fue declarada en este mismo ámbito`,
        linea
      );
    }
    this.tasas.set(nombre, { valor, linea });
  }

  resolverVariable(nombre) {
    if (this.variables.has(nombre)) return this.variables.get(nombre);
    if (this.padre) return this.padre.resolverVariable(nombre);
    return null;
  }

  // Todas las tasas visibles desde este ámbito hacia afuera (para el grafo de conversión)
  todasLasTasasVisibles() {
    const resultado = new Map();
    let ambito = this;
    const cadena = [];
    while (ambito) {
      cadena.push(ambito);
      ambito = ambito.padre;
    }
    // Del más externo al más interno, para que una tasa interna pueda
    // reutilizar el mismo nombre sin perder las del padre.
    for (let i = cadena.length - 1; i >= 0; i--) {
      for (const [nombre, datos] of cadena[i].tasas) {
        resultado.set(nombre, datos);
      }
    }
    return resultado;
  }

  // Todas las variables visibles de una moneda dada (para 'total')
  variablesVisiblesDeMoneda(moneda) {
    const resultado = [];
    let ambito = this;
    while (ambito) {
      for (const [nombre, datos] of ambito.variables) {
        if (datos.moneda === moneda) resultado.push(nombre);
      }
      ambito = ambito.padre;
    }
    return resultado;
  }
}

class AnalizadorSemantico {
  constructor() {
    this.errores = [];
    this.global = new Ambito(null);
  }

  reportar(mensaje, linea) {
    this.errores.push(new ErrorSemantico(mensaje, linea));
  }

  analizar(programaAST) {
    this.analizarSentencias(programaAST.sentencias, this.global);
    return this.errores;
  }

  analizarSentencias(sentencias, ambito) {
    for (const s of sentencias) {
      try {
        this.analizarSentencia(s, ambito);
      } catch (e) {
        if (e instanceof ErrorSemantico) {
          this.errores.push(e);
        } else {
          throw e;
        }
      }
    }
  }

  analizarSentencia(nodo, ambito) {
    switch (nodo.tipo) {
      case "TasaDecl":
        return this.analizarTasaDecl(nodo, ambito);
      case "VarDecl":
        return this.analizarVarDecl(nodo, ambito);
      case "AssignStmt":
        return this.analizarAssignStmt(nodo, ambito);
      case "PrintStmt":
        return this.analizarPrintStmt(nodo, ambito);
      case "TotalStmt":
        return this.analizarTotalStmt(nodo, ambito);
      case "IfStmt":
        return this.analizarIfStmt(nodo, ambito);
      default:
        throw new Error(`Nodo de sentencia no reconocido: ${nodo.tipo}`);
    }
  }

  analizarTasaDecl(nodo, ambito) {
    if (nodo.valor <= 0) {
      this.reportar(
        `la tasa '${nodo.nombre}' debe ser estrictamente positiva (se declaró con valor ${nodo.valor})`,
        nodo.linea
      );
    }
    ambito.declararTasa(nodo.nombre, nodo.valor, nodo.linea);
  }

  analizarVarDecl(nodo, ambito) {
    const tipoExpr = this.tipoDeExpresion(nodo.expresion, ambito);
    if (tipoExpr && tipoExpr !== NUMERO && tipoExpr !== nodo.moneda) {
      this.reportar(
        `no se puede inicializar la variable '${nodo.nombre}' de tipo '${nodo.moneda}' con una expresión de tipo '${tipoExpr}'`,
        nodo.linea
      );
    }
    ambito.declararVariable(nodo.nombre, nodo.moneda, nodo.linea);
  }

  analizarAssignStmt(nodo, ambito) {
    const variable = ambito.resolverVariable(nodo.nombre);
    if (!variable) {
      this.reportar(
        `no se puede asignar a '${nodo.nombre}': la variable no ha sido declarada`,
        nodo.linea
      );
      // Aun así se analiza la expresión para detectar más errores.
      this.tipoDeExpresion(nodo.expresion, ambito);
      return;
    }
    const tipoExpr = this.tipoDeExpresion(nodo.expresion, ambito);
    if (tipoExpr && tipoExpr !== NUMERO && tipoExpr !== variable.moneda) {
      this.reportar(
        `no se puede asignar un valor de tipo '${tipoExpr}' a la variable '${nodo.nombre}' de tipo '${variable.moneda}'`,
        nodo.linea
      );
    }
  }

  analizarPrintStmt(nodo, ambito) {
    if (!nodo.esCadena) {
      this.tipoDeExpresion(nodo.expresion, ambito);
    }
  }

  analizarTotalStmt(nodo, ambito) {
    const nombres = ambito.variablesVisiblesDeMoneda(nodo.moneda);
    if (nombres.length === 0) {
      this.reportar(
        `no hay variables de tipo '${nodo.moneda}' declaradas para calcular el total`,
        nodo.linea
      );
    }
  }

  analizarIfStmt(nodo, ambito) {
    this.analizarCondicion(nodo.condicion, ambito);
    const ambitoSi = new Ambito(ambito);
    this.analizarSentencias(nodo.bloqueSi, ambitoSi);
    if (nodo.bloqueSino) {
      const ambitoSino = new Ambito(ambito);
      this.analizarSentencias(nodo.bloqueSino, ambitoSino);
    }
  }

  analizarCondicion(nodo, ambito) {
    const tipoIzq = this.tipoDeExpresion(nodo.izquierda, ambito);
    if (nodo.operador === null) return; // condición simple, ya validada arriba
    const tipoDer = this.tipoDeExpresion(nodo.derecha, ambito);
    // Comparar una moneda contra un número puro es válido (el número se
    // interpreta como un umbral en esa misma moneda, p. ej. "salario > 1500").
    // Solo es error comparar DOS monedas distintas entre sí.
    if (
      tipoIzq &&
      tipoDer &&
      tipoIzq !== NUMERO &&
      tipoDer !== NUMERO &&
      tipoIzq !== tipoDer
    ) {
      this.reportar(
        `no se puede comparar un valor de tipo '${tipoIzq}' con uno de tipo '${tipoDer}'`,
        nodo.linea
      );
    }
  }

  /**
   * Calcula el tipo de una expresión (NUMERO o un código de moneda) y,
   * de paso, reporta cualquier error semántico encontrado dentro de ella.
   * Devuelve null si la expresión ya contiene un error irrecuperable
   * (para no propagar errores en cascada).
   */
  tipoDeExpresion(nodo, ambito) {
    switch (nodo.tipo) {
      case "NumberLit":
        return NUMERO;

      case "Identifier": {
        const variable = ambito.resolverVariable(nodo.nombre);
        if (!variable) {
          this.reportar(
            `la variable '${nodo.nombre}' se usa sin haber sido declarada`,
            nodo.linea
          );
          return null;
        }
        return variable.moneda;
      }

      case "UnaryExpr":
        return this.tipoDeExpresion(nodo.operando, ambito);

      case "BinaryExpr":
        return this.tipoDeBinaryExpr(nodo, ambito);

      case "ConvertExpr":
        return this.tipoDeConvertExpr(nodo, ambito);

      default:
        throw new Error(`Nodo de expresión no reconocido: ${nodo.tipo}`);
    }
  }

  tipoDeBinaryExpr(nodo, ambito) {
    const tipoIzq = this.tipoDeExpresion(nodo.izquierda, ambito);
    const tipoDer = this.tipoDeExpresion(nodo.derecha, ambito);
    if (tipoIzq === null || tipoDer === null) return null; // error ya reportado abajo

    if (nodo.operador === "+" || nodo.operador === "-") {
      if (tipoIzq === NUMERO && tipoDer === NUMERO) return NUMERO;
      if (tipoIzq !== NUMERO && tipoDer !== NUMERO) {
        if (tipoIzq !== tipoDer) {
          this.reportar(
            `no se puede sumar/restar '${tipoIzq}' con '${tipoDer}' sin una conversión explícita`,
            nodo.linea
          );
          return null;
        }
        return tipoIzq;
      }
      // Un lado es moneda y el otro un número puro: no tiene sentido económico.
      const tipoMoneda = tipoIzq !== NUMERO ? tipoIzq : tipoDer;
      this.reportar(
        `no se puede sumar/restar un valor monetario ('${tipoMoneda}') con un número sin moneda`,
        nodo.linea
      );
      return null;
    }

    // '*' y '/'
    if (tipoIzq !== NUMERO && tipoDer !== NUMERO) {
      this.reportar(
        `no se pueden multiplicar o dividir dos valores monetarios entre sí ('${tipoIzq}' y '${tipoDer}')`,
        nodo.linea
      );
      return null;
    }
    if (tipoIzq === NUMERO && tipoDer === NUMERO) return NUMERO;
    return tipoIzq !== NUMERO ? tipoIzq : tipoDer; // escalar * moneda = moneda
  }

  tipoDeConvertExpr(nodo, ambito) {
    const tipoOrigen = this.tipoDeExpresion(nodo.expresion, ambito);
    if (tipoOrigen === null) return null;
    if (tipoOrigen === NUMERO) {
      this.reportar(
        `solo se pueden convertir valores monetarios, no números sin moneda`,
        nodo.linea
      );
      return null;
    }
    if (tipoOrigen === nodo.monedaDestino) {
      return nodo.monedaDestino; // conversión trivial, no requiere tasa
    }
    const tasas = ambito.todasLasTasasVisibles();
    const rutaEncontrada = this.existeRutaDeConversion(
      tipoOrigen,
      nodo.monedaDestino,
      tasas
    );
    if (!rutaEncontrada) {
      this.reportar(
        `no existe una tasa (directa o encadenada) que permita convertir de '${tipoOrigen}' a '${nodo.monedaDestino}'`,
        nodo.linea
      );
      return null;
    }
    return nodo.monedaDestino;
  }

  /**
   * Búsqueda en amplitud (BFS) sobre el grafo no dirigido formado por las
   * tasas declaradas (cada 'tasa ORIGEN_a_DESTINO' agrega una arista en
   * ambos sentidos), permitiendo conversiones transitivas del tipo
   * USD -> EUR -> COP aunque no exista una tasa directa USD_a_COP.
   */
  existeRutaDeConversion(origen, destino, tasas) {
    const grafo = new Map(); // moneda -> [ {vecino, tasaEfectiva} ]
    const agregarArista = (a, b) => {
      if (!grafo.has(a)) grafo.set(a, []);
      grafo.get(a).push(b);
    };

    for (const nombre of tasas.keys()) {
      const partes = nombre.split("_a_");
      if (partes.length !== 2) continue; // nombre de tasa no sigue el patrón; se ignora aquí
      const [a, b] = partes;
      agregarArista(a, b);
      agregarArista(b, a);
    }

    const visitados = new Set([origen]);
    const cola = [origen];
    while (cola.length > 0) {
      const actual = cola.shift();
      if (actual === destino) return true;
      for (const vecino of grafo.get(actual) || []) {
        if (!visitados.has(vecino)) {
          visitados.add(vecino);
          cola.push(vecino);
        }
      }
    }
    return visitados.has(destino);
  }
}

module.exports = { AnalizadorSemantico, ErrorSemantico, NUMERO };
