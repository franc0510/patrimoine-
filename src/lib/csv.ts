import Papa from 'papaparse';
import { TYPES, TYPE_KEYS } from '../data/defaults';
import type { AccountType } from '../types';
import { parseAmount } from './format';

export interface CsvRow {
  name: string;
  type: AccountType;
  balance: number;
  date: string;
  institution?: string;
  error?: string;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const TYPE_ALIASES: Record<string, AccountType> = {
  ...Object.fromEntries(TYPE_KEYS.map((k) => [norm(k), k])),
  ...Object.fromEntries(TYPE_KEYS.map((k) => [norm(TYPES[k].label), k])),
  livreta: 'livretA', livretbleu: 'livretA', lddsld: 'ldds', ldd: 'ldds',
  assurancevie: 'av_euro', av: 'av_euro', fondseuro: 'av_euro', uc: 'av_uc',
  comptetitres: 'cto', comptetitre: 'cto', perin: 'per', pero: 'per',
  immobilier: 'immo', credit: 'credit', pret: 'credit', dette: 'credit', emprunt: 'credit',
  compte: 'courant', comptecourant: 'courant', cc: 'courant', cryptos: 'crypto',
};

export function guessType(label: string): AccountType {
  const n = norm(label);
  if (TYPE_ALIASES[n]) return TYPE_ALIASES[n];
  const hit = Object.keys(TYPE_ALIASES).sort((a, b) => b.length - a.length).find((k) => k.length > 2 && n.includes(k));
  return hit ? TYPE_ALIASES[hit] : 'autre';
}

function normDate(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const fr = v.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (fr) return `${fr[3]}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(v.trim())) return v.trim().slice(0, 10);
  return undefined;
}

/**
 * Colonnes reconnues (en-tête obligatoire, séparateur ; ou , détecté automatiquement) :
 * nom, type, solde, date (jj/mm/aaaa ou aaaa-mm-jj), etablissement (optionnel).
 */
export function parseCsv(text: string, fallbackDate: string): CsvRow[] {
  const res = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true, transformHeader: norm });
  return res.data.map((r) => {
    const name = (r.nom ?? r.name ?? r.compte ?? '').trim();
    const balance = parseAmount(r.solde ?? r.montant ?? r.balance);
    const date = normDate(r.date) ?? fallbackDate;
    const type = guessType(r.type ?? name);
    const row: CsvRow = { name, type, balance: Math.abs(balance), date, institution: (r.etablissement ?? r.banque ?? '').trim() || undefined };
    if (!name) row.error = 'Nom manquant';
    else if (Number.isNaN(balance)) row.error = 'Solde illisible';
    return row;
  });
}

export const CSV_EXAMPLE = `nom;type;solde;date;etablissement
Livret A;Livret A;15 200,00;01/09/2026;Ma banque
PEA;PEA;18 450,30;01/09/2026;Courtier
Assurance-vie;Assurance-vie (UC);9 800;01/09/2026;Assureur
Prêt immo;Crédit;182 000;01/09/2026;Ma banque`;
