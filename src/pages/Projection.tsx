import { useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ASSET_GROUPS, GROUPS, TYPES, type GroupKey } from '../data/defaults';
import { ageAt, uid } from '../lib/accounts';
import { downloadFile, eur, eurCompact } from '../lib/format';
import { OVERFLOW_ID, project, type ProjectionRow } from '../lib/projection';
import { usePatrimoine } from '../store/usePatrimoine';
import type { ContributionChangeEvent, LifeEvent } from '../types';
import { Button, Card, Field, Input, Modal, NumberInput, Select, Stat, Swatch, useChartTheme } from '../components/ui';
import type { Tab } from '../App';

const SCENARIOS = [
  { label: 'Pessimiste', shift: -2 },
  { label: 'Central', shift: 0 },
  { label: 'Optimiste', shift: 2 },
];

export default function Projection({ go }: { go: (t: Tab) => void }) {
  const { data, upsertEvent, deleteEvent } = usePatrimoine();
  const theme = useChartTheme();
  const [shift, setShift] = useState(0);
  const [real, setReal] = useState(true);
  const [afterTax, setAfterTax] = useState(false);
  const [editing, setEditing] = useState<LifeEvent | null>(null);

  const result = useMemo(() => project(data, { rateShift: shift }), [data, shift]);
  const { settings } = data;
  const birthYear = new Date(settings.birthDate).getFullYear();
  const currentAge = ageAt(settings.birthDate, new Date());

  if (!data.accounts.length) {
    return <Card><p className="py-6 text-center text-sm text-muted">Ajoute d'abord des comptes pour lancer une projection. <Button className="ml-2" onClick={() => go('accounts')}>Mes comptes</Button></p></Card>;
  }
  if (currentAge >= settings.targetAge) {
    return <Card><p className="py-6 text-center text-sm text-muted">Vérifie ta date de naissance dans Paramètres.</p></Card>;
  }

  const groupOf = (id: string): GroupKey => {
    if (id === OVERFLOW_ID) return 'liquid';
    const s = result.series.find((x) => x.id === id);
    return s ? TYPES[s.type].group : 'other';
  };
  const k = (r: ProjectionRow) => (real ? 1 / r.inflationIndex : 1);
  const cum = (r: ProjectionRow) => (real ? r.real : r);
  const netOf = (r: ProjectionRow) => (afterTax ? r.netAfterTax : r.net) * k(r);
  const usedGroups = ASSET_GROUPS.filter((g) => result.rows.some((r) => Object.entries(r.values).some(([id, v]) => groupOf(id) === g && v > 0.5)));

  const chartData = result.rows.slice(1).map((r) => {
    const o: Record<string, number> = { age: r.age, year: r.year, net: netOf(r), debts: r.liabilities * k(r) };
    for (const g of usedGroups) o[g] = 0;
    for (const [id, v] of Object.entries(r.values)) {
      const g = groupOf(id);
      if (g !== 'debt') o[g] = (o[g] ?? 0) + v * k(r);
    }
    return o;
  });

  const last = result.rows.at(-1)!;
  const retireEvent = data.events.find((e): e is ContributionChangeEvent => e.kind === 'contributionChange' && e.accountId === 'all' && e.monthly === 0);
  const atRetire = retireEvent && result.rows.find((r, i) => i > 0 && r.age === retireEvent.age - 1);
  const milestones = [100_000, 500_000, 1_000_000].map((m) => ({ m, row: result.rows.find((r) => netOf(r) >= m) }));

  const exportCsv = () => {
    const head = ['annee', 'age', 'actifs', 'dettes', 'patrimoine_net', 'impot_latent', 'net_apres_impot', 'verse_cumule', 'gains_cumules', 'retraits_cumules', 'indice_inflation'];
    const lines = result.rows.slice(1).map((r) => [r.year, r.age, r.assets, r.liabilities, r.net, r.tax, r.netAfterTax, r.contributed, r.gains, r.withdrawn, r.inflationIndex].map((v, i) => (i < 2 ? v : v.toFixed(2).replace('.', ','))).join(';'));
    downloadFile('projection-patrimoine.csv', [head.join(';'), ...lines].join('\n'), 'text/csv');
  };

  const unit = real ? "€ d'aujourd'hui" : '€ courants';

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex rounded-lg border border-line bg-surface p-0.5" role="group" aria-label="Scénario">
          {SCENARIOS.map((s) => (
            <button key={s.shift} type="button" onClick={() => setShift(s.shift)} className={`rounded-md px-3 py-1 text-sm ${shift === s.shift ? 'bg-accent text-accent-ink' : 'text-ink2 hover:bg-sunken'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={real} onChange={(e) => setReal(e.target.checked)} />Euros constants (inflation {settings.inflation} %)</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={afterTax} onChange={(e) => setAfterTax(e.target.checked)} />Net d'impôts latents</label>
      </div>
      {shift !== 0 && <p className="-mt-2 text-xs text-muted">Scénario {shift > 0 ? 'optimiste' : 'pessimiste'} : {shift > 0 ? '+' : '−'}{Math.abs(shift)} points sur les actifs de marché (PEA, CTO, UC, PER, crypto).</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Patrimoine net à ${last.age} ans`} value={eur(netOf(last))} hint={`en ${last.year}, ${unit}`} />
        {atRetire ? (
          <Stat label={`À la retraite (${retireEvent!.age} ans)`} value={eur(netOf(atRetire))} hint={unit} />
        ) : (
          <Stat label="En euros courants" value={eur(afterTax ? last.netAfterTax : last.net)} hint={`inflation cumulée ×${last.inflationIndex.toFixed(2)}`} />
        )}
        <Stat label="Total versé d'ici là" value={eur(cum(last).contributed)} hint={`versements + apports, ${unit}`} />
        <Stat label="Gains cumulés" value={eur(cum(last).gains)} hint={`intérêts, plus-values, revalorisation, ${unit}`} />
      </div>

      <Card
        title={`Projection année par année jusqu'à ${settings.targetAge} ans`}
        action={<span className="text-xs text-muted">{unit}</span>}
      >
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink2">
          {usedGroups.map((g) => <span key={g} className="flex items-center gap-1.5"><Swatch color={theme.series[GROUPS[g].slot]} />{GROUPS[g].label}</span>)}
          <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4" style={{ background: theme.ink }} />Patrimoine net{afterTax ? ' après impôts' : ''}</span>
        </div>
        <div className="h-80">
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={theme.grid} vertical={false} />
              <XAxis dataKey="age" stroke={theme.axis} tick={{ fill: theme.muted, fontSize: 12 }} tickFormatter={(a) => `${a} ans`} minTickGap={24} />
              <YAxis tickFormatter={eurCompact} stroke={theme.axis} tick={{ fill: theme.muted, fontSize: 12 }} width={64} />
              <Tooltip content={<ChartTooltip groups={usedGroups} theme={theme} afterTax={afterTax} />} cursor={{ stroke: theme.axis }} />
              {usedGroups.map((g) => (
                <Area key={g} type="monotone" dataKey={g} stackId="a" stroke={theme.surface} strokeWidth={1} fill={theme.series[GROUPS[g].slot]} fillOpacity={0.85} isAnimationActive={false} />
              ))}
              <Line type="monotone" dataKey="net" stroke={theme.ink} strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink2">
          {milestones.map(({ m, row }) => (
            <li key={m}>{eurCompact(m)} : {row ? <strong className="text-ink">{row.age} ans ({row.year})</strong> : <span className="text-muted">non atteint</span>}</li>
          ))}
        </ul>
        {result.warnings.length > 0 && (
          <ul className="mt-3 grid gap-1 rounded-lg bg-sunken p-3 text-sm text-ink2">
            {result.warnings.map((w) => <li key={w}>⚠ {w}</li>)}
          </ul>
        )}
      </Card>

      <Card
        title="Événements de vie"
        action={
          <div className="flex flex-wrap gap-2">
            {EVENT_TEMPLATES.map((t) => <Button key={t.kind} onClick={() => setEditing(t.make(data.accounts[0]?.id ?? '', currentAge))}>+ {t.label}</Button>)}
          </div>
        }
      >
        {data.events.length === 0 ? (
          <p className="text-sm text-muted">Ajoute un achat immobilier, un héritage, ta retraite (arrêt des versements) ou des retraits réguliers pour affiner la projection.</p>
        ) : (
          <ul className="divide-y divide-line">
            {[...data.events].sort((a, b) => evAge(a) - evAge(b)).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <div className="font-medium">{e.label}</div>
                  <div className="text-xs text-muted">{describe(e, data.accounts.map((a) => ({ id: a.id, name: a.name })), birthYear)}</div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setEditing(e)}>Modifier</Button>
                  <Button variant="danger" onClick={() => deleteEvent(e.id)}>Supprimer</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Tableau annuel" action={<Button onClick={exportCsv}>Exporter en CSV</Button>}>
        <div className="-mx-4 max-h-[480px] overflow-auto px-4">
          <table className="tnum w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 bg-surface text-left text-muted">
              <tr className="border-b border-line">
                {['Année', 'Âge', 'Actifs', 'Dettes', 'Patrimoine net', 'Impôt latent', 'Net après impôt', 'Versé cumulé', 'Gains cumulés'].map((h, i) => (
                  <th key={h} className={`py-2 font-normal ${i > 1 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r, i) => (
                <tr key={i} className={`border-b border-line last:border-0 ${i === 0 ? 'font-medium' : ''}`}>
                  <td className="py-1.5">{i === 0 ? "Aujourd'hui" : r.year}</td>
                  <td>{r.age}</td>
                  <td className="text-right">{eur(r.assets * k(r))}</td>
                  <td className="text-right text-ink2">{r.liabilities > 0.5 ? eur(r.liabilities * k(r)) : '—'}</td>
                  <td className="text-right font-medium">{eur(r.net * k(r))}</td>
                  <td className="text-right text-ink2">{eur(r.tax * k(r))}</td>
                  <td className="text-right">{eur(r.netAfterTax * k(r))}</td>
                  <td className="text-right text-ink2">{eur(cum(r).contributed)}</td>
                  <td className="text-right text-ink2">{eur(cum(r).gains)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">Montants en {unit}. Âge = âge atteint dans l'année ; valeurs au 31 décembre.</p>
      </Card>

      {editing && (
        <EventForm initial={editing} accounts={data.accounts.filter((a) => !TYPES[a.type].liability)} onClose={() => setEditing(null)} onSave={(e) => { upsertEvent(e); setEditing(null); }} />
      )}
    </div>
  );
}

type Theme = ReturnType<typeof useChartTheme>;

function ChartTooltip({ active, payload, groups, theme, afterTax }: { active?: boolean; payload?: { payload: Record<string, number> }[]; groups: GroupKey[]; theme: Theme; afterTax: boolean }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface p-3 text-xs shadow-lg">
      <div className="mb-1.5 font-semibold text-ink">{d.age} ans · {d.year}</div>
      <table className="tnum">
        <tbody>
          {[...groups].reverse().filter((g) => d[g] > 0.5).map((g) => (
            <tr key={g}><td className="pr-3 text-ink2"><span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: theme.series[GROUPS[g].slot] }} />{GROUPS[g].label}</td><td className="text-right text-ink">{eur(d[g])}</td></tr>
          ))}
          {d.debts > 0.5 && <tr><td className="pr-3 text-ink2">Dettes</td><td className="text-right text-ink">−{eur(d.debts)}</td></tr>}
          <tr className="border-t border-line font-semibold"><td className="pt-1 pr-3 text-ink">Net{afterTax ? ' après impôts' : ''}</td><td className="pt-1 text-right text-ink">{eur(d.net)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

const evAge = (e: LifeEvent) => (e.kind === 'withdrawal' ? e.fromAge : e.age);

function describe(e: LifeEvent, accounts: { id: string; name: string }[], birthYear: number): string {
  const acc = (id: string) => (id === 'all' ? 'tous les comptes' : accounts.find((a) => a.id === id)?.name ?? 'compte supprimé');
  switch (e.kind) {
    case 'lumpSum':
      return `${e.age} ans (${birthYear + e.age}) · ${e.amount >= 0 ? 'apport' : 'retrait'} de ${eur(Math.abs(e.amount))} sur ${acc(e.accountId)}`;
    case 'contributionChange':
      return `${e.age} ans (${birthYear + e.age}) · versement mensuel ${e.monthly ? `fixé à ${eur(e.monthly)}` : 'arrêté'} sur ${acc(e.accountId)}`;
    case 'withdrawal':
      return `de ${e.fromAge} à ${e.toAge} ans · ${eur(e.annualAmount)}/an (€ d'aujourd'hui) depuis ${acc(e.accountId)}`;
    case 'purchase':
      return `${e.age} ans (${birthYear + e.age}) · prix ${eur(e.price)}, apport ${eur(Math.max(0, e.price - e.loanAmount))} depuis ${acc(e.downPaymentAccountId)}${e.loanAmount ? `, crédit ${eur(e.loanAmount)} à ${e.loanRate} % sur ${e.loanYears} ans` : ''}`;
  }
}

const EVENT_TEMPLATES: { kind: LifeEvent['kind']; label: string; make: (acc: string, age: number) => LifeEvent }[] = [
  { kind: 'purchase', label: 'Achat immobilier', make: (acc, age) => ({ id: uid(), kind: 'purchase', label: 'Achat résidence principale', age: age + 3, price: 250000, appreciation: 1.5, downPaymentAccountId: acc, loanAmount: 225000, loanRate: 3.5, loanYears: 25 }) },
  { kind: 'lumpSum', label: 'Apport / retrait ponctuel', make: (acc, age) => ({ id: uid(), kind: 'lumpSum', label: 'Héritage', age: age + 10, amount: 20000, accountId: acc }) },
  { kind: 'contributionChange', label: 'Changement de versement', make: () => ({ id: uid(), kind: 'contributionChange', label: 'Retraite : arrêt des versements', age: 64, accountId: 'all', monthly: 0 }) },
  { kind: 'withdrawal', label: 'Retraits réguliers', make: (acc) => ({ id: uid(), kind: 'withdrawal', label: 'Complément de retraite', fromAge: 64, toAge: 80, annualAmount: 6000, accountId: acc }) },
];

function EventForm({ initial, accounts, onClose, onSave }: { initial: LifeEvent; accounts: { id: string; name: string }[]; onClose: () => void; onSave: (e: LifeEvent) => void }) {
  const [e, setE] = useState<LifeEvent>(initial);
  const set = (p: Partial<LifeEvent>) => setE((x) => ({ ...x, ...p }) as LifeEvent);
  const accountSelect = (value: string, onChange: (v: string) => void, allowAll = false) => (
    <Select value={value} onChange={(ev) => onChange(ev.target.value)}>
      {allowAll && <option value="all">Tous les comptes</option>}
      {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
    </Select>
  );
  const ageHint = "Âge atteint dans l'année ; appliqué en janvier.";

  return (
    <Modal title="Événement de vie" onClose={onClose} footer={<><Button onClick={onClose}>Annuler</Button><Button variant="primary" disabled={!e.label.trim()} onClick={() => onSave(e)}>Enregistrer</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Libellé" className="sm:col-span-2"><Input value={e.label} onChange={(ev) => set({ label: ev.target.value })} /></Field>
        {e.kind === 'lumpSum' && <>
          <Field label="Âge" hint={ageHint}><NumberInput value={e.age} onChange={(n) => set({ age: Math.round(n) })} /></Field>
          <Field label="Montant (€)" hint="Positif = apport, négatif = retrait."><NumberInput value={e.amount} onChange={(n) => set({ amount: n })} /></Field>
          <Field label="Compte" className="sm:col-span-2">{accountSelect(e.accountId, (v) => set({ accountId: v }))}</Field>
        </>}
        {e.kind === 'contributionChange' && <>
          <Field label="À partir de l'âge" hint={ageHint}><NumberInput value={e.age} onChange={(n) => set({ age: Math.round(n) })} /></Field>
          <Field label="Nouveau versement mensuel (€)" hint="0 = arrêt des versements."><NumberInput value={e.monthly} onChange={(n) => set({ monthly: n })} /></Field>
          <Field label="Compte" className="sm:col-span-2">{accountSelect(e.accountId, (v) => set({ accountId: v }), true)}</Field>
        </>}
        {e.kind === 'withdrawal' && <>
          <Field label="De l'âge"><NumberInput value={e.fromAge} onChange={(n) => set({ fromAge: Math.round(n) })} /></Field>
          <Field label="Jusqu'à l'âge (inclus)"><NumberInput value={e.toAge} onChange={(n) => set({ toAge: Math.round(n) })} /></Field>
          <Field label="Montant annuel (€ d'aujourd'hui)" hint="Indexé chaque année sur l'inflation, retiré chaque mois."><NumberInput value={e.annualAmount} onChange={(n) => set({ annualAmount: n })} /></Field>
          <Field label="Depuis le compte">{accountSelect(e.accountId, (v) => set({ accountId: v }))}</Field>
        </>}
        {e.kind === 'purchase' && <>
          <Field label="Âge à l'achat" hint={ageHint}><NumberInput value={e.age} onChange={(n) => set({ age: Math.round(n) })} /></Field>
          <Field label="Prix total (€)" hint="Frais de notaire inclus si tu veux les compter."><NumberInput value={e.price} onChange={(n) => set({ price: n })} /></Field>
          <Field label="Montant emprunté (€)" hint={`Apport : ${eur(Math.max(0, e.price - e.loanAmount))}`}><NumberInput value={e.loanAmount} onChange={(n) => set({ loanAmount: n })} /></Field>
          <Field label="Apport prélevé sur">{accountSelect(e.downPaymentAccountId, (v) => set({ downPaymentAccountId: v }))}</Field>
          <Field label="Taux du crédit (%)"><NumberInput value={e.loanRate} step={0.1} onChange={(n) => set({ loanRate: n })} /></Field>
          <Field label="Durée du crédit (années)"><NumberInput value={e.loanYears} onChange={(n) => set({ loanYears: n })} /></Field>
          <Field label="Revalorisation du bien (% / an)"><NumberInput value={e.appreciation} step={0.1} onChange={(n) => set({ appreciation: n })} /></Field>
          <p className="self-end text-xs text-muted sm:col-span-2">Les mensualités sont supposées payées par tes revenus (elles ne sont pas prélevées sur ton épargne).</p>
        </>}
      </div>
    </Modal>
  );
}
