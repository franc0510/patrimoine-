import { TYPES } from '../data/defaults';
import type { AccountType, PatrimoineData } from '../types';
import { ageAt, currentBalance, loanPayment } from './accounts';
import { latentTax } from './tax';

export interface ProjectionOptions {
  /** Décalage (en points de %) appliqué au rendement des actifs de marché : scénario pessimiste / optimiste. */
  rateShift?: number;
  /** Date de départ (par défaut : maintenant). */
  now?: Date;
}

export interface Series {
  id: string;
  name: string;
  type: AccountType;
  liability: boolean;
  }

export interface ProjectionRow {
  year: number;
  age: number;
  /** Valeur de chaque série (dettes en positif), en euros courants. */
  values: Record<string, number>;
  assets: number;
  liabilities: number;
  net: number;
  tax: number;
  netAfterTax: number;
  /** Cumul des versements (mensuels + apports ponctuels) depuis aujourd'hui, en euros courants. */
  contributed: number;
  /** Cumul des retraits depuis aujourd'hui, en euros courants. */
  withdrawn: number;
  /** Cumul des gains (intérêts, plus-values, revalorisation) sur les actifs, en euros courants. */
  gains: number;
  /** Mêmes cumuls, chaque flux étant converti en euros d'aujourd'hui à la date où il a lieu. */
  real: { contributed: number; withdrawn: number; gains: number };
  /** Facteur d'inflation cumulé : diviser une valeur par ce facteur donne des euros d'aujourd'hui. */
  inflationIndex: number;
}

export interface ProjectionResult {
  series: Series[];
  rows: ProjectionRow[];
  warnings: string[];
}

interface Position {
  id: string;
  name: string;
  type: AccountType;
  liability: boolean;
  annualRate: number;
  monthly: number;
  growth: number;
  balance: number;
  costBasis: number;
  openDate: Date;
}

export const OVERFLOW_ID = '__overflow__';

export function project(data: PatrimoineData, opts: ProjectionOptions = {}): ProjectionResult {
  const now = opts.now ?? new Date();
  const shift = opts.rateShift ?? 0;
  const { settings } = data;
  const birthYear = new Date(settings.birthDate).getFullYear();
  const startYear = now.getFullYear();
  const endYear = birthYear + settings.targetAge;
  const warnings = new Set<string>();

  const positions: Position[] = data.accounts.map((a) => {
    const info = TYPES[a.type];
    const balance = currentBalance(a);
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      liability: !!info.liability,
      annualRate: a.rate + (info.market ? shift : 0),
      monthly: a.monthlyContribution,
      growth: a.contributionGrowth,
      balance,
      costBasis: a.costBasis ?? balance,
      openDate: a.openDate ? new Date(a.openDate) : now,
    };
  });
  const byId = new Map(positions.map((p) => [p.id, p]));

  const overflow: Position = {
    id: OVERFLOW_ID, name: 'Épargne hors plafond (non placée)', type: 'courant', liability: false,
    annualRate: 0, monthly: 0, growth: 0, balance: 0, costBasis: 0, openDate: now,
  };
  const overflowTarget = (): Position => {
    const t = settings.overflowAccountId ? byId.get(settings.overflowAccountId) : undefined;
    return t && !t.liability ? t : overflow;
  };

  let contributed = 0;
  let withdrawn = 0;
  let gains = 0;
  const real = { contributed: 0, withdrawn: 0, gains: 0 };
  /** Enregistre un flux dans les cumuls nominaux et réels. */
  const flow = (kind: 'contributed' | 'withdrawn' | 'gains', amount: number) => {
    if (kind === 'contributed') contributed += amount;
    else if (kind === 'withdrawn') withdrawn += amount;
    else gains += amount;
    real[kind] += amount / inflationIndex();
  };
  let monthsElapsed = 0;
  const inflation = settings.inflation / 100;
  const inflationIndex = () => Math.pow(1 + inflation, monthsElapsed / 12);

  /** Place un montant sur une position en respectant son plafond ; l'excédent part vers le compte de débordement. */
  const deposit = (p: Position, amount: number, depth = 0) => {
    const cap = TYPES[p.type].cap;
    let accepted = amount;
    if (cap && p !== overflow) {
      const used = cap.on === 'balance' ? p.balance : p.costBasis;
      accepted = Math.max(0, Math.min(amount, cap.amount - used));
    }
    p.balance += accepted;
    p.costBasis += accepted;
    const rest = amount - accepted;
    if (rest > 1e-9) {
      const target = overflowTarget();
      if (target === overflow) warnings.add(`Plafond atteint sur « ${p.name} » : l'excédent est conservé sans rendement (choisis un compte de débordement dans Paramètres).`);
      deposit(target === p || depth > 3 ? overflow : target, rest, depth + 1);
    }
  };

  /** Retire un montant ; renvoie ce qui a effectivement pu être retiré. */
  const withdraw = (p: Position, amount: number, reason: string): number => {
    const taken = Math.min(amount, Math.max(0, p.balance));
    if (taken < amount - 0.5) warnings.add(`Solde insuffisant sur « ${p.name} » pour : ${reason}.`);
    if (p.balance > 0) p.costBasis *= 1 - taken / p.balance;
    p.balance -= taken;
    return taken;
  };

  const snapshotRow = (year: number, age: number, at: Date): ProjectionRow => {
    const values: Record<string, number> = {};
    let assets = 0;
    let liabilities = 0;
    let tax = 0;
    const all = overflow.balance > 0.5 ? [...positions, overflow] : positions;
    for (const p of all) {
      values[p.id] = p.balance;
      if (p.liability) liabilities += p.balance;
      else {
        assets += p.balance;
        const holding = (at.getTime() - p.openDate.getTime()) / (365.25 * 24 * 3600 * 1000);
        tax += latentTax(p.type, p.balance, p.costBasis, holding, settings);
      }
    }
    const net = assets - liabilities;
    return {
      year, age, values, assets, liabilities, net, tax, netAfterTax: net - tax,
      contributed, withdrawn, gains, real: { ...real }, inflationIndex: inflationIndex(),
    };
  };

  const rows: ProjectionRow[] = [];
  rows.push(snapshotRow(startYear, ageAt(settings.birthDate, now), now));

  for (let year = startYear; year <= endYear; year++) {
    const age = year - birthYear;
    const firstMonth = year === startYear ? now.getMonth() : 0;

    for (let month = firstMonth; month < 12; month++) {
      const isFirstOfYear = month === firstMonth;
      monthsElapsed++;

      if (isFirstOfYear) {
        if (year !== startYear) for (const p of positions) p.monthly *= 1 + p.growth / 100;
        applyYearEvents(year, age);
      }

      for (const p of [...positions, overflow]) {
        const mr = Math.pow(1 + p.annualRate / 100, 1 / 12) - 1;
        if (p.liability) {
          if (p.monthly > 0 && p.balance > 0) p.balance = Math.max(0, p.balance * (1 + mr) - p.monthly);
          continue;
        }
        const g = p.balance * mr;
        p.balance += g;
        flow('gains', g);
        if (p.monthly > 0) {
          deposit(p, p.monthly);
          flow('contributed', p.monthly);
        }
      }

      for (const ev of data.events) {
        if (ev.kind !== 'withdrawal' || age < ev.fromAge || age > ev.toAge) continue;
        const p = byId.get(ev.accountId);
        if (!p) continue;
        flow('withdrawn', withdraw(p, (ev.annualAmount / 12) * inflationIndex(), ev.label));
      }
    }
    rows.push(snapshotRow(year, age, new Date(year, 11, 31)));
  }

  function applyYearEvents(year: number, age: number) {
    for (const ev of data.events) {
      if (ev.kind === 'lumpSum' && ev.age === age) {
        const p = byId.get(ev.accountId);
        if (!p) continue;
        if (ev.amount >= 0) {
          deposit(p, ev.amount);
          flow('contributed', ev.amount);
        } else flow('withdrawn', withdraw(p, -ev.amount, ev.label));
      } else if (ev.kind === 'contributionChange' && ev.age === age) {
        for (const p of positions) {
          if (ev.accountId === 'all' ? !p.liability : p.id === ev.accountId) p.monthly = ev.monthly;
        }
      } else if (ev.kind === 'purchase' && ev.age === age) {
        const down = Math.max(0, ev.price - ev.loanAmount);
        const src = byId.get(ev.downPaymentAccountId);
        if (down > 0) {
          if (src) withdraw(src, down, `apport « ${ev.label} »`);
          else warnings.add(`Aucun compte d'apport pour « ${ev.label} ».`);
        }
        const asset: Position = {
          id: `${ev.id}-bien`, name: ev.label, type: 'immo', liability: false, annualRate: ev.appreciation,
          monthly: 0, growth: 0, balance: ev.price, costBasis: ev.price, openDate: new Date(year, 0, 1),
        };
        positions.push(asset);
        byId.set(asset.id, asset);
        if (ev.loanAmount > 0) {
          const loan: Position = {
            id: `${ev.id}-pret`, name: `Crédit – ${ev.label}`, type: 'credit', liability: true, annualRate: ev.loanRate,
            monthly: loanPayment(ev.loanAmount, ev.loanRate, ev.loanYears), growth: 0, balance: ev.loanAmount,
            costBasis: 0, openDate: new Date(year, 0, 1),
          };
          positions.push(loan);
          byId.set(loan.id, loan);
        }
      }
    }
  }

  const series: Series[] = positions.map((p) => ({ id: p.id, name: p.name, type: p.type, liability: p.liability }));
  if (rows.some((r) => (r.values[OVERFLOW_ID] ?? 0) > 0)) {
    series.push({ id: OVERFLOW_ID, name: overflow.name, type: 'courant', liability: false });
  }
  return { series, rows, warnings: [...warnings] };
}
