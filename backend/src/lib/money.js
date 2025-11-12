// backend/src/lib/money.js
export function parseMoney(v) {
  if (typeof v === "number") return v;
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  // rimuovi spazi e simboli €; gestisci 1.234,56 e 1234.56
  s = s.replace(/[€\s]/g, "");
  // se ci sono sia . che , assume . = separatore migliaia, , = decimale
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
export function round2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}
