import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, EMPTY_DATA } from '../data/defaults';
import type { Account, LifeEvent, PatrimoineData, Settings } from '../types';
import { sortSnapshots } from '../lib/accounts';

const KEY = 'patrimoine:v1';

function load(): PatrimoineData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch {
    /* stockage indisponible : on repart de zéro */
  }
  return EMPTY_DATA;
}

export function normalize(d: unknown): PatrimoineData {
  const o = (d ?? {}) as Partial<PatrimoineData>;
  if (!Array.isArray(o.accounts)) throw new Error('Fichier invalide : liste de comptes absente.');
  return {
    version: 1,
    accounts: o.accounts.map(sortSnapshots),
    events: Array.isArray(o.events) ? o.events : [],
    settings: { ...DEFAULT_SETTINGS, ...(o.settings ?? {}) },
  };
}

function useStore() {
  const [data, setData] = useState<PatrimoineData>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* navigation privée, quota… : les données restent en mémoire */
    }
  }, [data]);

  return useMemo(() => {
    const upsertAccount = (a: Account) =>
      setData((d) => {
        const acc = sortSnapshots(a);
        const exists = d.accounts.some((x) => x.id === a.id);
        return { ...d, accounts: exists ? d.accounts.map((x) => (x.id === a.id ? acc : x)) : [...d.accounts, acc] };
      });
    return {
      data,
      replaceAll: (d: PatrimoineData) => setData(d),
      upsertAccount,
      upsertAccounts: (list: Account[]) => list.forEach(upsertAccount),
      deleteAccount: (id: string) =>
        setData((d) => ({
          ...d,
          accounts: d.accounts.filter((a) => a.id !== id),
          settings: d.settings.overflowAccountId === id ? { ...d.settings, overflowAccountId: undefined } : d.settings,
        })),
      upsertEvent: (e: LifeEvent) =>
        setData((d) => ({
          ...d,
          events: d.events.some((x) => x.id === e.id) ? d.events.map((x) => (x.id === e.id ? e : x)) : [...d.events, e],
        })),
      deleteEvent: (id: string) => setData((d) => ({ ...d, events: d.events.filter((e) => e.id !== id) })),
      updateSettings: (s: Partial<Settings>) => setData((d) => ({ ...d, settings: { ...d.settings, ...s } })),
    };
  }, [data]);
}

type Store = ReturnType<typeof useStore>;
const Ctx = createContext<Store | null>(null);

export function PatrimoineProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={useStore()}>{children}</Ctx.Provider>;
}

export function usePatrimoine(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('usePatrimoine hors PatrimoineProvider');
  return s;
}
