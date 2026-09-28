import { useState } from 'react';
import { GROUPS, TYPES, TYPE_KEYS } from '../data/defaults';
import { currentBalance, lastUpdate, uid } from '../lib/accounts';
import { CSV_EXAMPLE, parseCsv, type CsvRow } from '../lib/csv';
import { dateFr, downloadFile, eur, pct, today } from '../lib/format';
import { usePatrimoine } from '../store/usePatrimoine';
import type { Account, AccountType } from '../types';
import { Button, Card, Field, Input, Modal, NumberInput, Select, Swatch, useChartTheme } from '../components/ui';

function newAccount(type: AccountType = 'livretA'): Account {
  return {
    id: uid(), name: TYPES[type].label, type, snapshots: [{ date: today(), balance: 0 }],
    rate: TYPES[type].rate, monthlyContribution: 0, contributionGrowth: 0,
  };
}

export default function Accounts() {
  const { data, upsertAccount, deleteAccount } = usePatrimoine();
  const theme = useChartTheme();
  const [editing, setEditing] = useState<{ account: Account; isNew: boolean } | null>(null);
  const [balanceFor, setBalanceFor] = useState<Account | null>(null);
  const [importing, setImporting] = useState(false);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => setEditing({ account: newAccount(), isNew: true })}>+ Ajouter un compte</Button>
        <Button onClick={() => setImporting(true)}>Importer un CSV</Button>
      </div>

      {data.accounts.length === 0 && (
        <Card><p className="py-6 text-center text-sm text-muted">Aucun compte pour l'instant.</p></Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {data.accounts.map((a) => {
          const t = TYPES[a.type];
          return (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold"><Swatch color={theme.series[GROUPS[t.group].slot]} /><span className="truncate">{a.name}</span></div>
                  <div className="text-xs text-muted">{t.label}{a.institution ? ` · ${a.institution}` : ''}</div>
                </div>
                <div className="text-right">
                  <div className={`tnum text-lg font-semibold ${t.liability ? 'text-bad' : ''}`}>{t.liability ? '−' : ''}{eur(currentBalance(a))}</div>
                  <div className="text-xs text-muted">au {dateFr(lastUpdate(a))}</div>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-xs text-muted">{t.liability ? 'Taux' : 'Rendement'}</dt><dd className="tnum">{pct(a.rate)}</dd></div>
                <div><dt className="text-xs text-muted">{t.liability ? 'Mensualité' : 'Versement / mois'}</dt><dd className="tnum">{eur(a.monthlyContribution)}</dd></div>
                <div><dt className="text-xs text-muted">Relevés</dt><dd className="tnum">{a.snapshots.length}</dd></div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => setBalanceFor(a)}>Nouveau solde</Button>
                <Button onClick={() => setEditing({ account: a, isNew: false })}>Modifier</Button>
                <Button variant="danger" onClick={() => confirm(`Supprimer « ${a.name} » et son historique ?`) && deleteAccount(a.id)}>Supprimer</Button>
              </div>
            </Card>
          );
        })}
      </div>

      {editing && (
        <AccountForm
          initial={editing.account}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onSave={(a) => { upsertAccount(a); setEditing(null); }}
        />
      )}
      {balanceFor && (
        <BalanceModal
          account={data.accounts.find((a) => a.id === balanceFor.id) ?? balanceFor}
          onClose={() => setBalanceFor(null)}
          onSave={upsertAccount}
        />
      )}
      {importing && <CsvImport onClose={() => setImporting(false)} />}
    </div>
  );
}

function AccountForm({ initial, isNew, onClose, onSave }: { initial: Account; isNew: boolean; onClose: () => void; onSave: (a: Account) => void }) {
  const [a, setA] = useState(initial);
  const set = (p: Partial<Account>) => setA((x) => ({ ...x, ...p }));
  const t = TYPES[a.type];
  const taxed = t.tax !== 'exempt';
  const needsOpenDate = t.tax === 'pea' || t.tax === 'av';
  const balance = currentBalance(a);

  const changeType = (type: AccountType) =>
    set({
      type,
      rate: TYPES[type].rate,
      name: a.name === TYPES[a.type].label || !a.name ? TYPES[type].label : a.name,
    });

  return (
    <Modal
      title={isNew ? 'Nouveau compte' : `Modifier « ${initial.name} »`}
      onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="primary" disabled={!a.name.trim()} onClick={() => onSave(a)}>Enregistrer</Button>
      </>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type">
          <Select value={a.type} onChange={(e) => changeType(e.target.value as AccountType)}>
            {TYPE_KEYS.map((k) => <option key={k} value={k}>{TYPES[k].label}</option>)}
          </Select>
        </Field>
        <Field label="Nom"><Input value={a.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Établissement (optionnel)"><Input value={a.institution ?? ''} onChange={(e) => set({ institution: e.target.value || undefined })} /></Field>
        {isNew ? (
          <Field label={t.liability ? 'Capital restant dû (€)' : t.group === 'realestate' ? 'Valeur estimée (€)' : 'Solde actuel (€)'}>
            <NumberInput value={balance} onChange={(n) => set({ snapshots: [{ date: a.snapshots[0]?.date ?? today(), balance: n }] })} />
          </Field>
        ) : (
          <Field label="Solde actuel" hint="Utilise « Nouveau solde » pour le mettre à jour."><div className="tnum py-1.5">{eur(balance)}</div></Field>
        )}
        <Field
          label={t.liability ? 'Taux du crédit (% / an)' : t.group === 'realestate' ? 'Revalorisation (% / an)' : 'Rendement attendu (% / an)'}
          hint={t.liability ? undefined : `Défaut pour ce type : ${pct(t.rate, 2)}`}
        >
          <NumberInput value={a.rate} step={0.1} onChange={(n) => set({ rate: n })} />
        </Field>
        <Field label={t.liability ? 'Mensualité (€)' : 'Versement mensuel (€)'} hint={t.liability ? 'Laisse 0 pour un prêt in fine.' : t.cap ? `Plafond : ${eur(t.cap.amount)} ${t.cap.on === 'balance' ? 'de solde' : 'de versements'}` : undefined}>
          <NumberInput value={a.monthlyContribution} onChange={(n) => set({ monthlyContribution: n })} />
        </Field>
        {!t.liability && (
          <Field label="Hausse annuelle du versement (%)" hint="Ex. 2 % pour suivre ton salaire.">
            <NumberInput value={a.contributionGrowth} step={0.5} onChange={(n) => set({ contributionGrowth: n })} />
          </Field>
        )}
        {needsOpenDate && (
          <Field label="Date d'ouverture" hint={t.tax === 'pea' ? 'Fiscalité allégée après 5 ans.' : 'Fiscalité allégée après 8 ans.'}>
            <Input type="date" value={a.openDate ?? ''} onChange={(e) => set({ openDate: e.target.value || undefined })} />
          </Field>
        )}
        {taxed && (
          <Field label="Total versé à ce jour (€)" hint="Sert à calculer la plus-value imposable. Vide = solde actuel.">
            <NumberInput value={a.costBasis ?? balance} onChange={(n) => set({ costBasis: n })} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

function BalanceModal({ account, onClose, onSave }: { account: Account; onClose: () => void; onSave: (a: Account) => void }) {
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(currentBalance(account));
  const save = () => {
    onSave({ ...account, snapshots: [...account.snapshots.filter((s) => s.date !== date), { date, balance: amount }] });
    onClose();
  };
  const remove = (d: string) => onSave({ ...account, snapshots: account.snapshots.filter((s) => s.date !== d) });

  return (
    <Modal title={`Solde – ${account.name}`} onClose={onClose} footer={<><Button onClick={onClose}>Fermer</Button><Button variant="primary" onClick={save}>Enregistrer ce solde</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Solde (€)"><NumberInput value={amount} onChange={setAmount} /></Field>
      </div>
      <h3 className="mt-5 mb-2 text-sm font-semibold">Historique</h3>
      <ul className="divide-y divide-line text-sm">
        {[...account.snapshots].reverse().map((s) => (
          <li key={s.date} className="flex items-center justify-between py-1.5">
            <span className="text-ink2">{dateFr(s.date)}</span>
            <span className="flex items-center gap-3">
              <span className="tnum">{eur(s.balance)}</span>
              {account.snapshots.length > 1 && (
                <button type="button" className="text-xs text-muted hover:text-bad" onClick={() => remove(s.date)}>retirer</button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function CsvImport({ onClose }: { onClose: () => void }) {
  const { data, upsertAccounts } = usePatrimoine();
  const [text, setText] = useState('');
  const [rows, setRows] = useState<CsvRow[]>([]);
  const match = (name: string) => data.accounts.find((a) => a.name.trim().toLowerCase() === name.trim().toLowerCase());

  const parse = (t: string) => { setText(t); setRows(t.trim() ? parseCsv(t, today()) : []); };
  const valid = rows.filter((r) => !r.error);

  const doImport = () => {
    upsertAccounts(valid.map((r) => {
      const existing = match(r.name);
      if (existing) {
        return { ...existing, institution: existing.institution ?? r.institution, snapshots: [...existing.snapshots.filter((s) => s.date !== r.date), { date: r.date, balance: r.balance }] };
      }
      return { ...newAccount(r.type), name: r.name, institution: r.institution, snapshots: [{ date: r.date, balance: r.balance }] };
    }));
    onClose();
  };

  return (
    <Modal
      title="Importer des soldes (CSV)"
      onClose={onClose}
      footer={<><Button onClick={onClose}>Annuler</Button><Button variant="primary" disabled={!valid.length} onClick={doImport}>Importer {valid.length || ''} ligne(s)</Button></>}
    >
      <p className="text-sm text-ink2">
        Colonnes : <code>nom;type;solde;date;etablissement</code>. Séparateur « ; » ou « , », montants au format français acceptés.
        Un compte portant le même nom reçoit un nouveau solde daté ; sinon il est créé.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <label className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-sunken">
          Choisir un fichier…
          <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) parse(await f.text()); }} />
        </label>
        <Button onClick={() => parse(CSV_EXAMPLE)}>Coller l'exemple</Button>
        <Button onClick={() => downloadFile('modele-patrimoine.csv', CSV_EXAMPLE, 'text/csv')}>Télécharger le modèle</Button>
      </div>
      <textarea className="tnum mt-3 h-32 w-full rounded-lg border border-line bg-plane p-2 font-mono text-xs" placeholder="…ou colle ton CSV ici" value={text} onChange={(e) => parse(e.target.value)} />
      {rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-muted"><tr className="border-b border-line"><th className="py-1 font-normal">Nom</th><th className="py-1 font-normal">Type</th><th className="py-1 text-right font-normal">Solde</th><th className="py-1 text-right font-normal">Date</th><th className="py-1 font-normal" /></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="py-1">{r.name || '—'}</td>
                  <td className="py-1">
                    {match(r.name) ? <span className="text-ink2">{TYPES[match(r.name)!.type].label}</span> : (
                      <select className="rounded border border-line bg-plane px-1 py-0.5" value={r.type} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, type: e.target.value as AccountType } : x)))}>
                        {TYPE_KEYS.map((k) => <option key={k} value={k}>{TYPES[k].label}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="tnum py-1 text-right">{Number.isNaN(r.balance) ? '—' : eur(r.balance)}</td>
                  <td className="tnum py-1 text-right">{dateFr(r.date)}</td>
                  <td className="py-1 pl-2 text-xs">{r.error ? <span className="text-bad">⚠ {r.error}</span> : match(r.name) ? <span className="text-muted">mise à jour</span> : <span className="text-good">nouveau</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
