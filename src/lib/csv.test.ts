import { describe, expect, it } from 'vitest';
import { CSV_EXAMPLE, guessType, parseCsv } from './csv';

describe('parseCsv', () => {
  it("lit l'exemple fourni (séparateur ;, montants FR, dates FR)", () => {
    const rows = parseCsv(CSV_EXAMPLE, '2026-01-01');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ name: 'Livret A', type: 'livretA', balance: 15200, date: '2026-09-01' });
    expect(rows[1].balance).toBeCloseTo(18450.3);
    expect(rows[2].type).toBe('av_uc');
    expect(rows[3].type).toBe('credit');
  });
  it('accepte la virgule comme séparateur et une date par défaut', () => {
    const rows = parseCsv('nom,solde\nMon LDDS,1200.50', '2026-02-03');
    expect(rows[0]).toMatchObject({ type: 'ldds', balance: 1200.5, date: '2026-02-03' });
  });
  it('signale les lignes invalides', () => {
    expect(parseCsv('nom;solde\n;12\nX;abc', '2026-01-01').map((r) => r.error)).toEqual(['Nom manquant', 'Solde illisible']);
  });
  it('devine les types courants', () => {
    expect(guessType('Compte-titres')).toBe('cto');
    expect(guessType('PER Individuel')).toBe('per');
  });
});
