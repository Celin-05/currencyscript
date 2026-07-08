# CurrencyScript

Analizador léxico, sintáctico y semántico para **CurrencyScript**, un lenguaje
de dominio específico para operaciones financieras con distintas monedas.

Proyecto Final — Asignatura Compiladores.
Autor: **Celin Álvarez Vega**.

## Requisitos

- Node.js v18 o superior (probado con Node v22).
- No se requieren dependencias externas: la implementación es JavaScript
  puro (léxico y parser de descenso recursivo escritos a mano).

## Estructura del repositorio

```
currencyscript/
├── lexer.js              # Analizador léxico
├── ast.js                # Definición de nodos del AST
├── parser.js             # Analizador sintáctico (descenso recursivo)
├── semantic.js           # Analizador semántico + tabla de símbolos
├── main.js               # Punto de entrada: ejecuta los programas de prueba
├── README.md             # Este archivo
└── pruebas/
    ├── prueba_valida.cs             # Programa correcto en las 3 fases
    ├── prueba_error_sintactico.cs   # Programa con error sintáctico
    ├── prueba_error_semantico.cs    # Programa con error semántico
    └── prueba_extendida.cs         # Programa adicional (5 errores semánticos
                                      # distintos en un solo archivo, para
                                      # demostrar el reporte múltiple en una
                                      # sola pasada)
```

## Ejecución

```bash
cd currencyscript/
node main.js
```

Esto analiza, en orden, los cuatro programas de `pruebas/` e imprime en
consola el resultado de cada fase (léxica, sintáctica, semántica), deteniendo
el análisis de un archivo en la primera fase que falle (no tiene sentido
continuar al análisis semántico si el árbol sintáctico no pudo construirse).

### Resultado esperado

```
prueba_valida.cs               -> OK
prueba_error_sintactico.cs     -> ERROR (fase sintactica)
prueba_error_semantico.cs      -> ERROR (fase semantica)
prueba_extendida.cs            -> ERROR (fase semantica)
```

### Analizar un archivo propio

El punto de entrada actual está pensado para ejecutar la batería de pruebas
de `pruebas/`. Para analizar un archivo `.cs` distinto, puede usarse
directamente el pipeline desde el REPL de Node o un script corto:

```js
const fs = require("fs");
const { Lexer } = require("./lexer");
const { Parser } = require("./parser");
const { AnalizadorSemantico } = require("./semantic");

const codigo = fs.readFileSync("mi_programa.cs", "utf-8");
const { tokens, errores: erroresLexicos } = new Lexer(codigo).tokenizar();
if (erroresLexicos.length) {
  erroresLexicos.forEach(e =>
    console.log(`Error léxico [línea ${e.linea}, columna ${e.columna}]: ${e.message}`)
  );
} else {
  const parser = new Parser(tokens);
  const ast = parser.parsearPrograma();
  if (parser.errores.length) {
    parser.errores.forEach(e =>
      console.log(`Error sintáctico [línea ${e.linea}, columna ${e.columna}]: ${e.message}`)
    );
  } else {
    const errores = new AnalizadorSemantico().analizar(ast);
    errores.forEach(e => console.log(`Error semántico [línea ${e.linea}]: ${e.message}`));
    if (!errores.length) console.log("Programa válido.");
  }
}
```

## Documentación técnica completa

Ver `CurrencyScript_Documento_Tecnico.pdf` para la descripción completa del
DSL, la tabla de tokens, la gramática EBNF, las reglas semánticas y las
decisiones de diseño justificadas.
