import { useRef, useState } from 'react';
import { EMPTY_DATA, TYPES, demoData } from '../data/defaults';
import { ageAt } from '../lib/accounts';
import { downloadFile, today } from '../lib/format';
import { normalize, usePatrimoine } from '../store/usePatrimoine';
import { Button, Card, Field, Input, NumberInput, Select } from '../components/ui';

export default function Settings() {
  const { data, updateSettings, replaceAll } = usePatrimoine();
  const s = data.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string>();

  const restore = async (f: File) => {
    try {
      const d = normalize(JSON.parse(await f.text()));
      if (confirm(`Remplacer tes données actuelles par cette sauvegarde (${d.accounts.length} comptes) ?`)) {
        replaceAll(d);
        setMsg('Sauvegarde restaurée ✔');
      }
    } catch (e) {
      setMsg(`Impossible de lire ce fichier : ${(e as Error).message}`);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Profil & hypothèses">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date de naissance" hint={`Tu as ${ageAt(s.birthDate, new Date())} ans.`}>
            <Input type="date" value={s.birthDate} max={today()} onChange={(e) => e.target.value && updateSettings({ birthDate: e.target.value })} />
          </Field>
          <Field label="Projeter jusqu'à l'âge de">
            <NumberInput value={s.targetAge} onChange={(n) => n > 0 && n <= 120 && updateSettings({ targetAge: Math.round(n) })} />
          </Field>
          <Field label="Inflation annuelle (%)" hint="Sert à afficher les montants en euros d'aujourd'hui.">
            <NumberInput value={s.inflation} step={0.1} onChange={(n) => updateSettings({ inflation: n })} />
          </Field>
          <Field label="Tranche marginale d'imposition (%)" hint="Utilisée pour la sortie du PER.">
            <Select value={s.tmi} onChange={(e) => updateSettings({ tmi: Number(e.target.value) })}>
              {[0, 11, 30, 41, 45].map((t) => <option key={t} value={t}>{t} %</option>)}
            </Select>
          </Field>
          <Field label="Abattement assurance-vie > 8 ans">
            <Select value={s.avAllowance} onChange={(e) => updateSettings({ avAllowance: Number(e.target.value) })}>
              <option value={4600}>4 600 € (personne seule)</option>
              <option value={9200}>9 200 € (couple)</option>
            </Select>
          </Field>
          <Field label="Compte de débordement" hint="Reçoit les versements quand un livret ou le PEA atteint son plafond.">
            <Select value={s.overflowAccountId ?? ''} onChange={(e) => updateSettings({ overflowAccountId: e.target.value || undefined })}>
              <option value="">Aucun (excédent non placé)</option>
              {data.accounts.filter((a) => !TYPES[a.type].liability && !TYPES[a.type].cap).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <Card title="Sauvegarde">
        <p className="text-sm text-ink2">
          Tes données sont enregistrées uniquement dans ce navigateur. Exporte une sauvegarde régulièrement (ou pour passer
          sur un autre appareil) et restaure-la ici.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => downloadFile(`patrimoine-${today()}.json`, JSON.stringify(data, null, 2), 'application/json')}>Exporter (JSON)</Button>
          <Button onClick={() => fileRef.current?.click()}>Restaurer une sauvegarde…</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ''; }} />
        </div>
        {msg && <p className="mt-2 text-sm text-ink2">{msg}</p>}
        <hr className="my-4 border-line" />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => confirm('Remplacer tes données par le jeu d\'exemple ?') && replaceAll(demoData())}>Charger l'exemple</Button>
          <Button variant="danger" onClick={() => confirm('Tout effacer ? Pense à exporter avant.') && replaceAll(EMPTY_DATA)}>Tout effacer</Button>
        </div>
      </Card>

      <Card title="À propos des calculs" className="lg:col-span-2">
        <ul className="grid list-disc gap-1 pl-5 text-sm text-ink2">
          <li>Simulation mois par mois : intérêts composés au taux annuel de chaque compte, puis versement mensuel ; valeurs relevées au 31 décembre.</li>
          <li>Plafonds : Livret A 22 950 €, LDDS 12 000 €, LEP 10 000 €, PEL 61 200 €, CEL 15 300 € (solde), PEA 150 000 € (versements). Les intérêts peuvent dépasser le plafond.</li>
          <li>Impôt latent = impôt dû si tout était retiré à cette date : PFU 30 % (CTO, crypto, PEL/CEL, PEA &lt; 5 ans, AV &lt; 8 ans), 17,2 % pour PEA &gt; 5 ans, 17,2 % + 7,5 % après abattement pour AV &gt; 8 ans, TMI sur les versements + PFU sur les gains pour le PER. Livrets et résidence principale exonérés.</li>
          <li>Les taux par défaut sont indicatifs : ajuste-les compte par compte. Les performances passées ne préjugent pas des performances futures.</li>
          <li>Connexion bancaire automatique : non incluse (nécessite un agrégateur agréé type Powens ou GoCardless et un serveur). Utilise l'import CSV ou la mise à jour manuelle.</li>
        </ul>
      </Card>
    </div>
  );
}
