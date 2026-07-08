// prueba_extendida.cs
// No es uno de los tres programas obligatorios; se incluye para demostrar,
// en un solo archivo, cada una de las reglas semánticas nuevas añadidas al
// corregir el documento original (ver sección 5.6 del documento técnico):
//   - tasa negativa
//   - variable redeclarada en el mismo ámbito
//   - variable usada sin declarar
//   - conversión sin ruta (ni directa ni transitiva)
//   - total sobre una moneda sin variables declaradas
// Todos estos son errores semánticos intencionales, en el mismo archivo,
// para mostrar que el analizador reporta VARIOS errores en una sola pasada.

tasa USD_a_EUR = -0.5;

var a : USD = 10;
var a : USD = 20;

imprimir b;

var monto : BRL = 50;
imprimir convertir monto en MXN;

total MXN;
