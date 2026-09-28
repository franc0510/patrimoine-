const eurFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eurCompactFmt = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

export const eur = (n: number) => eurFmt.format(Math.round(n) === 0 ? 0 : n);
export const eurCompact = (n: number) => `${eurCompactFmt.format(n)} €`;
export const pct = (n: number, digits = 1) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: digits })} %`;
export const dateFr = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—');
export const today = () => new Date().toISOString().slice(0, 10);

/** Accepte « 12 345,67 », « 12345.67 », « -1 200 € »… */
export function parseAmount(v: string | number | undefined): number {
  if (typeof v === 'number') return v;
  if (!v) return NaN;
  const s = v.replace(/[\s  €]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  return Number(s);
}

export function downloadFile(name: string, content: string, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
