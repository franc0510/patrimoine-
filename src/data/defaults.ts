import type { AccountType, PatrimoineData, Settings } from '../types';

export type TaxKind = 'exempt' | 'flat' | 'pea' | 'av' | 'per';

export interface TypeInfo {
  label: string;
  /** Rendement annuel par défaut en % (indicatif, modifiable). */
  rate: number;
  liability?: boolean;
  /** Plafond : sur le solde (livrets) ou sur le cumul des versements (PEA). */
  cap?: { amount: number; on: 'balance' | 'contributions' };
  tax: TaxKind;
  /** Actif de marché : concerné par le curseur de scénario pessimiste / optimiste. */
  market?: boolean;
  group: GroupKey;
}

/**
 * Regroupements affichés dans les graphiques. L'ordre fixe les couleurs (palette catégorielle
 * validée daltonisme, jamais recyclée) : une couleur suit toujours le même groupe.
 */
export const GROUPS = {
  regulated: { label: 'Épargne réglementée', slot: 0 },
  stocks: { label: 'Bourse (PEA, CTO)', slot: 1 },
  av: { label: 'Assurance-vie', slot: 2 },
  liquid: { label: 'Liquidités', slot: 3 },
  retirement: { label: 'Retraite (PER)', slot: 4 },
  realestate: { label: 'Immobilier', slot: 5 },
  other: { label: 'Crypto & autres', slot: 6 },
  debt: { label: 'Dettes', slot: 7 },
} as const;

export type GroupKey = keyof typeof GROUPS;
export const ASSET_GROUPS = (Object.keys(GROUPS) as GroupKey[]).filter((g) => g !== 'debt');

export const PALETTE = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};

export const TYPES: Record<AccountType, TypeInfo> = {
  courant: { label: 'Compte courant', rate: 0, tax: 'exempt', group: 'liquid' },
  livretA: { label: 'Livret A', rate: 1.7, cap: { amount: 22950, on: 'balance' }, tax: 'exempt', group: 'regulated' },
  ldds: { label: 'LDDS', rate: 1.7, cap: { amount: 12000, on: 'balance' }, tax: 'exempt', group: 'regulated' },
  lep: { label: 'LEP', rate: 2.7, cap: { amount: 10000, on: 'balance' }, tax: 'exempt', group: 'regulated' },
  pel: { label: 'PEL', rate: 1.75, cap: { amount: 61200, on: 'balance' }, tax: 'flat', group: 'regulated' },
  cel: { label: 'CEL', rate: 1.0, cap: { amount: 15300, on: 'balance' }, tax: 'flat', group: 'regulated' },
  pea: { label: 'PEA', rate: 6, cap: { amount: 150000, on: 'contributions' }, tax: 'pea', market: true, group: 'stocks' },
  av_euro: { label: 'Assurance-vie (fonds €)', rate: 2.5, tax: 'av', group: 'av' },
  av_uc: { label: 'Assurance-vie (UC)', rate: 5, tax: 'av', market: true, group: 'av' },
  per: { label: 'PER', rate: 5, tax: 'per', market: true, group: 'retirement' },
  cto: { label: 'Compte-titres', rate: 6, tax: 'flat', market: true, group: 'stocks' },
  crypto: { label: 'Crypto', rate: 5, tax: 'flat', market: true, group: 'other' },
  immo: { label: 'Immobilier', rate: 1.5, tax: 'exempt', group: 'realestate' },
  credit: { label: 'Crédit / dette', rate: 3.5, liability: true, tax: 'exempt', group: 'debt' },
  autre: { label: 'Autre', rate: 0, tax: 'exempt', group: 'other' },
};

export const TYPE_KEYS = Object.keys(TYPES) as AccountType[];

export const DEFAULT_SETTINGS: Settings = {
  birthDate: '1995-01-01',
  targetAge: 80,
  inflation: 2,
  tmi: 30,
  avAllowance: 4600,
};

export const EMPTY_DATA: PatrimoineData = {
  version: 1,
  accounts: [],
  events: [],
  settings: DEFAULT_SETTINGS,
};

/** Jeu de données d'exemple pour découvrir l'application. */
export function demoData(): PatrimoineData {
  const y = new Date().getFullYear();
  const d = (yy: number, m: number) => `${yy}-${String(m).padStart(2, '0')}-01`;
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS, overflowAccountId: 'demo-av' },
    accounts: [
      {
        id: 'demo-cc', name: 'Compte courant', type: 'courant', institution: 'Ma banque',
        snapshots: [{ date: d(y - 1, 1), balance: 1800 }, { date: d(y, 1), balance: 2500 }],
        rate: 0, monthlyContribution: 0, contributionGrowth: 0,
      },
      {
        id: 'demo-la', name: 'Livret A', type: 'livretA', institution: 'Ma banque',
        snapshots: [{ date: d(y - 1, 1), balance: 12000 }, { date: d(y, 1), balance: 16000 }],
        rate: 1.7, monthlyContribution: 200, contributionGrowth: 0,
      },
      {
        id: 'demo-pea', name: 'PEA', type: 'pea', institution: 'Courtier',
        snapshots: [{ date: d(y - 1, 1), balance: 9000 }, { date: d(y, 1), balance: 14500 }],
        rate: 6, monthlyContribution: 300, contributionGrowth: 2, openDate: d(y - 4, 3), costBasis: 12000,
      },
      {
        id: 'demo-av', name: 'Assurance-vie', type: 'av_uc', institution: 'Assureur',
        snapshots: [{ date: d(y - 1, 1), balance: 6000 }, { date: d(y, 1), balance: 8200 }],
        rate: 4.5, monthlyContribution: 150, contributionGrowth: 2, openDate: d(y - 6, 6), costBasis: 7000,
      },
    ],
    events: [
      {
        id: 'demo-ev-house', label: 'Achat résidence principale', kind: 'purchase', age: 35,
        price: 300000, appreciation: 1.5, downPaymentAccountId: 'demo-la', loanAmount: 285000, loanRate: 3.5, loanYears: 25,
      },
      { id: 'demo-ev-ret', label: 'Retraite : arrêt des versements', kind: 'contributionChange', age: 64, accountId: 'all', monthly: 0 },
      { id: 'demo-ev-rente', label: 'Complément de retraite', kind: 'withdrawal', fromAge: 64, toAge: 80, annualAmount: 6000, accountId: 'demo-av' },
    ],
  };
}
