import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ASSET_GROUPS, GROUPS, TYPES, demoData } from '../data/defaults';
import { ageAt, currentBalance, lastUpdate, netWorthHistory } from '../lib/accounts';
import { dateFr, eur, eurCompact, pct } from '../lib/format';
import { usePatrimoine } from '../store/usePatrimoine';
import { Button, Card, Stat, Swatch, useChartTheme } from '../components/ui';
import type { Tab } from '../App';

export default function Dashboard({ go }: { go: (t: Tab) => void }) {
  const { data, replaceAll } = usePatrimoine();
  const theme = useChartTheme();
  const { accounts, settings } = data;

  if (!accounts.length) {
    return (
      <Card>
        <div className="mx-auto max-w-xl py-8 text-center">
          <h2 className="text-xl font-semibold">Bienvenue 👋</h2>
          <p className="mt-2 text-ink2">
            Ajoute tes comptes (livrets, PEA, assurance-vie, PER, immobilier, crédits…) ou importe un CSV pour voir ton
            patrimoine, puis projette-le année par année jusqu'à tes {settings.targetAge} ans.
          </p>
          <p className="mt-2 text-sm text-muted">Tout reste dans ton navigateur : aucune donnée n'est envoyée sur internet.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={() => go('accounts')}>Ajouter mes comptes</Button>
            <Button onClick={() => go('settings')}>Renseigner ma date de naissance</Button>
            <Button onClick={() => replaceAll(demoData())}>Charger un exemple</Button>
          </div>
        </div>
      </Card>
    );
  }

  const assets = accounts.filter((a) => !TYPES[a.type].liability);
  const debts = accounts.filter((a) => TYPES[a.type].liability);
  const totalAssets = assets.reduce((s, a) => s + currentBalance(a), 0);
  const totalDebts = debts.reduce((s, a) => s + currentBalance(a), 0);
  const monthly = assets.reduce((s, a) => s + a.monthlyContribution, 0);
  const weightedRate = totalAssets ? assets.reduce((s, a) => s + currentBalance(a) * a.rate, 0) / totalAssets : 0;

  const byGroup = ASSET_GROUPS.map((g) => ({
    key: g,
    ...GROUPS[g],
    value: assets.filter((a) => TYPES[a.type].group === g).reduce((s, a) => s + currentBalance(a), 0),
  })).filter((g) => g.value > 0);
  const maxGroup = Math.max(...byGroup.map((g) => g.value), 1);

  const history = netWorthHistory(accounts);
  const sorted = [...accounts].sort((a, b) => TYPES[a.type].group.localeCompare(TYPES[b.type].group) || currentBalance(b) - currentBalance(a));

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Patrimoine net" value={eur(totalAssets - totalDebts)} hint={`À ${ageAt(settings.birthDate, new Date())} ans`} />
        <Stat label="Actifs" value={eur(totalAssets)} hint={`Rendement moyen attendu ${pct(weightedRate)}`} />
        <Stat label="Dettes" value={eur(totalDebts)} tone={totalDebts > 0 ? 'bad' : undefined} hint={`${debts.length} crédit(s)`} />
        <Stat label="Épargne mensuelle" value={eur(monthly)} hint={`${eur(monthly * 12)} / an`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card title="Répartition des actifs" className="lg:col-span-2">
          <ul className="grid gap-3">
            {byGroup.map((g) => (
              <li key={g.key}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2"><Swatch color={theme.series[g.slot]} />{g.label}</span>
                  <span className="tnum">{eur(g.value)} <span className="text-muted">· {pct((g.value / totalAssets) * 100, 0)}</span></span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-sunken">
                  <div className="h-2 rounded-full" style={{ width: `${(g.value / maxGroup) * 100}%`, background: theme.series[g.slot] }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Évolution du patrimoine net" className="lg:col-span-3">
          {history.length < 2 ? (
            <p className="py-10 text-center text-sm text-muted">
              Mets à jour tes soldes régulièrement (bouton « Nouveau solde » dans Comptes) pour voir l'évolution ici.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={history} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={theme.grid} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={dateFr} stroke={theme.axis} tick={{ fill: theme.muted, fontSize: 12 }} />
                  <YAxis tickFormatter={eurCompact} stroke={theme.axis} tick={{ fill: theme.muted, fontSize: 12 }} width={64} />
                  <Tooltip
                    cursor={{ stroke: theme.axis }}
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="rounded-lg border border-line bg-surface p-2.5 text-xs shadow-lg">
                          <div className="text-ink2">{dateFr(String(payload[0].payload.date))}</div>
                          <div className="tnum mt-0.5 font-semibold text-ink">{eur(Number(payload[0].value))}</div>
                        </div>
                      ) : null
                    }
                  />
                  <Line type="monotone" dataKey="net" stroke={theme.series[0]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: theme.surface }} activeDot={{ r: 5 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card title="Mes comptes" action={<Button onClick={() => go('accounts')}>Gérer</Button>}>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-muted">
              <tr className="border-b border-line">
                <th className="py-2 font-normal">Compte</th>
                <th className="py-2 font-normal">Type</th>
                <th className="py-2 text-right font-normal">Solde</th>
                <th className="py-2 text-right font-normal">Rendement</th>
                <th className="py-2 text-right font-normal">Versement / mois</th>
                <th className="py-2 text-right font-normal">Mis à jour</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => {
                const t = TYPES[a.type];
                return (
                  <tr key={a.id} className="border-b border-line last:border-0">
                    <td className="py-2">
                      <div className="flex items-center gap-2"><Swatch color={theme.series[GROUPS[t.group].slot]} />{a.name}</div>
                      {a.institution && <div className="pl-4.5 text-xs text-muted">{a.institution}</div>}
                    </td>
                    <td className="py-2 text-ink2">{t.label}</td>
                    <td className={`tnum py-2 text-right ${t.liability ? 'text-bad' : ''}`}>{t.liability ? '−' : ''}{eur(currentBalance(a))}</td>
                    <td className="tnum py-2 text-right">{pct(a.rate)}</td>
                    <td className="tnum py-2 text-right">{a.monthlyContribution ? eur(a.monthlyContribution) : '—'}</td>
                    <td className="tnum py-2 text-right text-muted">{dateFr(lastUpdate(a))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
