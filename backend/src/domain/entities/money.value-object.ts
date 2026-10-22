// Domain entities: core business objects, independent of frameworks and infrastructure.

// Dinero como lo define el contrato de CORE: string decimal con dos decimales, en ARS, nunca
// float. Los cálculos se hacen con number y se convierten recién al armar la respuesta.
export type DecimalString = string;

export function toDecimalString(amount: number): DecimalString {
  return (Math.round(amount * 100) / 100).toFixed(2);
}

// Los seeds del prototipo están en millones de ARS.
export function millionsToDecimal(millions: number): DecimalString {
  return toDecimalString(millions * 1_000_000);
}
