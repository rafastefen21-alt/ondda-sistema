/**
 * lib/boleto.ts — utilitários para renderizar o boleto (padrão FEBRABAN).
 *
 * O código de barras do boleto usa o padrão Interleaved 2 of 5 (I25) com
 * 44 dígitos. Esta função devolve as barras pretas (posição + largura em
 * "unidades"), para o PDF escalar conforme a largura desejada.
 */

const PADROES: Record<string, string> = {
  "0": "NNWWN", "1": "WNNNW", "2": "NWNNW", "3": "WWNNN", "4": "NNWNW",
  "5": "WNWNN", "6": "NWWNN", "7": "NNNWW", "8": "WNNWN", "9": "NWNWN",
};

const NARROW = 1;
const WIDE = 3;

export interface BarrasI25 {
  /** Barras pretas: x = posição inicial, w = largura, ambos em unidades. */
  bars: Array<{ x: number; w: number }>;
  /** Largura total em unidades (para escalar). */
  total: number;
}

/** Gera as barras Interleaved 2 of 5 de um código de barras de boleto (44 dígitos). */
export function barrasI25(codigo: string): BarrasI25 {
  const d = (codigo ?? "").replace(/\D/g, "");
  if (d.length === 0 || d.length % 2 !== 0) {
    throw new Error("Código de barras inválido para I25 (precisa de dígitos em quantidade par).");
  }

  const elementos: Array<{ bar: boolean; w: number }> = [];

  // Start: barra estreita, espaço estreito, barra estreita, espaço estreito
  elementos.push(
    { bar: true, w: NARROW }, { bar: false, w: NARROW },
    { bar: true, w: NARROW }, { bar: false, w: NARROW },
  );

  // Cada par de dígitos: 1º nas barras, 2º nos espaços (intercalado)
  for (let i = 0; i < d.length; i += 2) {
    const p1 = PADROES[d[i]];
    const p2 = PADROES[d[i + 1]];
    for (let k = 0; k < 5; k++) {
      elementos.push({ bar: true,  w: p1[k] === "W" ? WIDE : NARROW });
      elementos.push({ bar: false, w: p2[k] === "W" ? WIDE : NARROW });
    }
  }

  // Stop: barra larga, espaço estreito, barra estreita
  elementos.push(
    { bar: true, w: WIDE }, { bar: false, w: NARROW }, { bar: true, w: NARROW },
  );

  const bars: Array<{ x: number; w: number }> = [];
  let x = 0;
  for (const e of elementos) {
    if (e.bar) bars.push({ x, w: e.w });
    x += e.w;
  }
  return { bars, total: x };
}
