export type AccountType =
  | 'courant'
  | 'livretA'
  | 'ldds'
  | 'lep'
  | 'pel'
  | 'cel'
  | 'pea'
  | 'av_euro'
  | 'av_uc'
  | 'per'
  | 'cto'
  | 'crypto'
  | 'immo'
  | 'credit'
  | 'autre';

/** Solde relevé à une date donnée (ISO yyyy-mm-dd). Pour un crédit : capital restant dû (positif). */
export interface Snapshot {
  date: string;
  balance: number;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  institution?: string;
  /** Historique des soldes, trié par date croissante. */
  snapshots: Snapshot[];
  /** Rendement annuel attendu en % (crédit : taux du prêt ; immobilier : revalorisation). */
  rate: number;
  /** Versement mensuel en € (crédit : mensualité de remboursement). */
  monthlyContribution: number;
  /** Hausse annuelle du versement mensuel en %. */
  contributionGrowth: number;
  /** Date d'ouverture (ancienneté fiscale PEA / assurance-vie). */
  openDate?: string;
  /** Total des versements effectués (base fiscale). Par défaut : solde actuel. */
  costBasis?: number;
}

interface EventBase {
  id: string;
  label: string;
}

/** Apport (montant > 0) ou retrait (montant < 0) ponctuel, en début d'année de l'âge indiqué. */
export interface LumpSumEvent extends EventBase {
  kind: 'lumpSum';
  age: number;
  amount: number;
  accountId: string;
}

/** Modifie le versement mensuel d'un compte (ou de tous) à partir d'un âge. 0 = arrêt (ex : retraite). */
export interface ContributionChangeEvent extends EventBase {
  kind: 'contributionChange';
  age: number;
  accountId: string | 'all';
  monthly: number;
}

/** Retrait annuel (en euros d'aujourd'hui, indexé sur l'inflation) entre deux âges. */
export interface WithdrawalEvent extends EventBase {
  kind: 'withdrawal';
  fromAge: number;
  toAge: number;
  annualAmount: number;
  accountId: string;
}

/** Achat d'un bien (immobilier…) avec apport prélevé sur un compte et éventuel crédit. */
export interface PurchaseEvent extends EventBase {
  kind: 'purchase';
  age: number;
  price: number;
  appreciation: number;
  downPaymentAccountId: string;
  loanAmount: number;
  loanRate: number;
  loanYears: number;
}

export type LifeEvent = LumpSumEvent | ContributionChangeEvent | WithdrawalEvent | PurchaseEvent;

export interface Settings {
  birthDate: string;
  targetAge: number;
  /** Inflation annuelle en %. */
  inflation: number;
  /** Tranche marginale d'imposition en % (sortie PER). */
  tmi: number;
  /** Abattement annuel assurance-vie > 8 ans (4 600 € seul, 9 200 € couple). */
  avAllowance: number;
  /** Compte recevant les versements qui dépassent un plafond (livrets, PEA…). */
  overflowAccountId?: string;
}

export interface PatrimoineData {
  version: 1;
  accounts: Account[];
  events: LifeEvent[];
  settings: Settings;
}
