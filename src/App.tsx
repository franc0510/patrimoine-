import { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Projection from './pages/Projection';
import Settings from './pages/Settings';

export type Tab = 'dashboard' | 'accounts' | 'projection' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Tableau de bord' },
  { id: 'accounts', label: 'Comptes' },
  { id: 'projection', label: 'Projection' },
  { id: 'settings', label: 'Paramètres' },
];

const fromHash = (): Tab => {
  const h = window.location.hash.slice(1);
  return TABS.some((t) => t.id === h) ? (h as Tab) : 'dashboard';
};

export default function App() {
  const [tab, setTab] = useState<Tab>(fromHash);
  useEffect(() => {
    const f = () => setTab(fromHash());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  const go = (t: Tab) => { window.location.hash = t; setTab(t); };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <h1 className="text-xl font-bold">💶 Mon patrimoine</h1>
        <nav className="-mx-1 flex flex-wrap gap-y-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => go(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`mx-1 shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${tab === t.id ? 'bg-accent text-accent-ink' : 'text-ink2 hover:bg-sunken'}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'dashboard' && <Dashboard go={go} />}
        {tab === 'accounts' && <Accounts />}
        {tab === 'projection' && <Projection go={go} />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  );
}
