import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../data/defaults';
import type { Account, LifeEvent, PatrimoineData, Settings } from '../types';
import { loanPayment } from './accounts';
import { OVERFLOW_ID, project } from './projection';
import { latentTax } from './tax';

const NOW = new Date(2026, 0, 1); // 1er janvier : 12 mois pleins la première année

function account(p: Partial<Account> & Pick<Account, 'id' | 'type'>, balance: number): Account {
  return {
    name: p.id, rate: 0, monthlyContribution: 0, contributionGrowth: 0,
    snapshots: [{ date: '2026-01-01', balance }], ...p,
  };
}

function data(accounts: Account[], events: LifeEvent[] = [], settings: Partial<Settings> = {}): PatrimoineData {
  return { version: 1, accounts, events, settings: { ...DEFAULT_SETTINGS, birthDate: '1996-06-15', ...settings } };
}

describe('project', () => {
  it("s'arrête l'année des 80 ans, une ligne par an", () => {
    const r = project(data([account({ id: 'a', type: 'courant' }, 100)]), { now: NOW });
    expect(r.rows[0].age).toBe(29);
    expect(r.rows.at(-1)!.age).toBe(80);
    expect(r.rows.at(-1)!.year).toBe(1996 + 80);
    expect(r.rows.length).toBe(1 + (2076 - 2026 + 1));
  });

  it('capitalise les intérêts comme la formule fermée', () => {
    const r = project(data([account({ id: 'a', type: 'cto', rate: 5 }, 10000)]), { now: NOW });
    const after10 = r.rows.find((x) => x.year === 2035)!;
    expect(after10.values.a).toBeCloseTo(10000 * 1.05 ** 10, 2);
  });

  it('cumule les versements mensuels', () => {
    const r = project(data([account({ id: 'a', type: 'courant', monthlyContribution: 100 }, 0)]), { now: NOW });
    expect(r.rows[1].values.a).toBeCloseTo(1200);
    expect(r.rows[1].contributed).toBeCloseTo(1200);
  });

  it('respecte le plafond du Livret A et redirige vers le compte de débordement', () => {
    const d = data(
      [account({ id: 'la', type: 'livretA', monthlyContribution: 1000 }, 22000), account({ id: 'cto', type: 'cto' }, 0)],
      [],
      { overflowAccountId: 'cto' },
    );
    const r = project(d, { now: NOW });
    expect(r.rows[1].values.la).toBeCloseTo(22950);
    expect(r.rows[1].values.cto).toBeCloseTo(12000 - 950);
  });

  it("garde l'excédent hors plafond sans compte de débordement", () => {
    const r = project(data([account({ id: 'la', type: 'livretA', monthlyContribution: 1000 }, 22950)]), { now: NOW });
    expect(r.rows[1].values[OVERFLOW_ID]).toBeCloseTo(12000);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('arrête les versements à la retraite', () => {
    const d = data(
      [account({ id: 'a', type: 'courant', monthlyContribution: 100 }, 0)],
      [{ id: 'e', label: 'Retraite', kind: 'contributionChange', age: 64, accountId: 'all', monthly: 0 }],
    );
    const r = project(d, { now: NOW });
    const at63 = r.rows.find((x) => x.age === 63)!;
    expect(r.rows.at(-1)!.values.a).toBeCloseTo(at63.values.a);
  });

  it("calcule l'indice d'inflation", () => {
    const r = project(data([account({ id: 'a', type: 'courant' }, 100)], [], { inflation: 2 }), { now: NOW });
    expect(r.rows.find((x) => x.year === 2035)!.inflationIndex).toBeCloseTo(1.02 ** 10, 6);
  });

  it('convertit les cumuls en euros constants flux par flux', () => {
    const d = data([account({ id: 'a', type: 'courant', monthlyContribution: 100 }, 0)], [], { inflation: 2 });
    const r = project(d, { now: NOW });
    const y10 = r.rows.find((x) => x.year === 2035)!;
    expect(y10.contributed).toBeCloseTo(12000);
    expect(y10.real.contributed).toBeLessThan(12000);
    expect(y10.real.contributed).toBeGreaterThan(12000 / 1.02 ** 10);
  });

  it("amortit entièrement le crédit d'un achat à l'échéance", () => {
    const d = data(
      [account({ id: 'cash', type: 'courant' }, 50000)],
      [{
        id: 'house', label: 'Maison', kind: 'purchase', age: 30, price: 250000, appreciation: 0,
        downPaymentAccountId: 'cash', loanAmount: 200000, loanRate: 3.5, loanYears: 20,
      }],
    );
    const r = project(d, { now: NOW });
    const buy = r.rows.find((x) => x.age === 30)!;
    expect(buy.values.cash).toBeCloseTo(0);
    expect(buy.values['house-bien']).toBeCloseTo(250000);
    expect(buy.values['house-pret']).toBeGreaterThan(190000);
    expect(r.rows.find((x) => x.age === 49)!.values['house-pret']).toBeCloseTo(0, 0);
  });

  it('effectue les retraits annuels indexés sur l’inflation', () => {
    const d = data(
      [account({ id: 'a', type: 'courant' }, 100000)],
      [{ id: 'w', label: 'Rente', kind: 'withdrawal', fromAge: 30, toAge: 30, annualAmount: 12000, accountId: 'a' }],
      { inflation: 0 },
    );
    const r = project(d, { now: NOW });
    expect(r.rows[1].values.a).toBeCloseTo(88000);
    expect(r.rows[1].withdrawn).toBeCloseTo(12000);
  });

  it('applique le décalage de scénario uniquement aux actifs de marché', () => {
    const d = data([account({ id: 'pea', type: 'pea', rate: 5 }, 1000), account({ id: 'la', type: 'livretA', rate: 2 }, 1000)]);
    const r = project(d, { now: NOW, rateShift: 2 });
    expect(r.rows[1].values.pea).toBeCloseTo(1070);
    expect(r.rows[1].values.la).toBeCloseTo(1020);
  });
});

describe('latentTax', () => {
  const s = { tmi: 30, avAllowance: 4600 };
  it('exonère les livrets', () => expect(latentTax('livretA', 20000, 10000, 3, s)).toBe(0));
  it('PEA : PFU avant 5 ans, PS après', () => {
    expect(latentTax('pea', 20000, 10000, 3, s)).toBeCloseTo(3000);
    expect(latentTax('pea', 20000, 10000, 6, s)).toBeCloseTo(1720);
  });
  it('assurance-vie après 8 ans avec abattement', () => {
    expect(latentTax('av_uc', 20000, 10000, 9, s)).toBeCloseTo(1720 + 5400 * 0.075);
  });
});

describe('loanPayment', () => {
  it('calcule une mensualité classique', () => expect(loanPayment(200000, 3.5, 20)).toBeCloseTo(1159.92, 1));
});
