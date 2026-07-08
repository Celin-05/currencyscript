// prueba_error_semantico.cs
// Programa sintácticamente correcto, pero semánticamente inválido:
// intento de sumar USD con EUR sin conversión explícita.

tasa USD_a_COP = 4000;

var sueldo : USD = 1000;
var gasto  : EUR = 500;

imprimir sueldo + gasto;
