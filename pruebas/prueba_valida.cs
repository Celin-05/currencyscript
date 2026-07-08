// prueba_valida.cs
// Programa correcto en las tres fases: léxica, sintáctica y semántica.

tasa USD_a_EUR = 0.92;
tasa EUR_a_COP = 4500;

var salario   : USD = 2000;
var en_euros  : EUR = convertir salario en EUR;

imprimir "Salario convertido a euros:";
imprimir en_euros;

/* La siguiente conversión no tiene tasa directa USD_a_COP declarada,
   pero sí existe la cadena USD -> EUR -> COP, así que debe resolverse
   por búsqueda transitiva. */
var salario_cop : COP = convertir salario en COP;
imprimir salario_cop;

si (salario > 1500) {
    imprimir "El salario supera el umbral de 1500 USD";
    var bono : USD = 100;
    salario = salario + bono;
} sino {
    imprimir "El salario no supera el umbral";
}

imprimir salario;
total USD;
