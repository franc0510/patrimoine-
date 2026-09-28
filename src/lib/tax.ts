import { TYPES } from '../data/defaults';
import type { AccountType, Settings } from '../types';

export const PFU = 0.3; // prélèvement forfaitaire unique (12,8 % IR + 17,2 % PS)
export const PS = 0.172; // prélèvements sociaux
export const AV_IR_AFTER_8Y = 0.075;

/**
 * Impôt latent (approximatif) si l'enveloppe était entièrement liquidée.
 * Hypothèses simplifiées : pas de prise en compte des PS déjà prélevés sur les fonds €,
 * ni du seuil de 150 k€ de versements en assurance-vie, ni des cas de déblocage anticipé.
 */
export function latentTax(
  type: AccountType,
  balance: number,
  costBasis: number,
  holdingYears: number,
  settings: Pick<Settings, 'tmi' | 'avAllowance'>,
): number {
  if (balance <= 0) return 0;
  const gains = Math.max(0, balance - costBasis);
  switch (TYPES[type].tax) {
    case 'exempt':
      return 0;
    case 'flat':
      return gains * PFU;
    case 'pea':
      return gains * (holdingYears >= 5 ? PS : PFU);
    case 'av':
      if (holdingYears < 8) return gains * PFU;
      return gains * PS + Math.max(0, gains - settings.avAllowance) * AV_IR_AFTER_8Y;
    case 'per':
      // Sortie en capital : versements (déduits à l'entrée) imposés au barème, gains au PFU.
      return Math.min(costBasis, balance) * (settings.tmi / 100) + gains * PFU;
  }
}
