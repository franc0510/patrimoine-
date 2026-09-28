import { TYPES } from '../data/defaults';
import type { Account } from '../types';

export function currentBalance(a: Account): number {
  return a.snapshots.length ? a.snapshots[a.snapshots.length - 1].balance : 0;
}

export function lastUpdate(a: Account): string | undefined {
  return a.snapshots.length ? a.snapshots[a.snapshots.length - 1].date : undefined;
}

/** Contribution signée au patrimoine net (les dettes comptent en négatif). */
export function signedBalance(a: Account): number {
  return TYPES[a.type].liability ? -currentBalance(a) : currentBalance(a);
}

export function sortSnapshots(a: Account): Account {
  return { ...a, snapshots: [...a.snapshots].sort((x, y) => x.date.localeCompare(y.date)) };
}

/** Patrimoine net à chaque date où au moins un solde a été relevé. */
export function netWorthHistory(accounts: Account[]): { date: string; net: number }[] {
  const dates = [...new Set(accounts.flatMap((a) => a.snapshots.map((s) => s.date)))].sort();
  return dates.map((date) => {
    let net = 0;
    for (const a of accounts) {
      let bal: number | undefined;
      for (const s of a.snapshots) if (s.date <= date) bal = s.balance;
      if (bal !== undefined) net += TYPES[a.type].liability ? -bal : bal;
    }
    return { date, net };
  });
}

export function ageAt(birthDate: string, at: Date): number {
  const b = new Date(birthDate);
  let age = at.getFullYear() - b.getFullYear();
  if (at.getMonth() < b.getMonth() || (at.getMonth() === b.getMonth() && at.getDate() < b.getDate())) age--;
  return age;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** Mensualité d'un prêt amortissable. */
export function loanPayment(principal: number, annualRatePct: number, years: number): number {
  const n = Math.round(years * 12);
  if (n <= 0) return principal;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}
