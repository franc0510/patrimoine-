# 💶 Mon patrimoine

Application web pour suivre son patrimoine (livrets, PEA, assurance-vie, PER, compte-titres, crypto, immobilier, crédits)
et le projeter **année par année jusqu'à 80 ans** (âge configurable).

Toutes les données restent **dans ton navigateur** (localStorage) : rien n'est envoyé sur un serveur.
Pense à exporter une sauvegarde JSON depuis *Paramètres*.

## Fonctionnalités

- **Tableau de bord** : patrimoine net, actifs, dettes, épargne mensuelle, répartition par catégorie, évolution historique.
- **Comptes** : ajout / modification, historique des soldes datés, import CSV avec aperçu.
- **Projection** :
  - rendement et versement mensuel par compte, hausse annuelle des versements ;
  - plafonds réglementaires (Livret A, LDDS, LEP, PEL, CEL, PEA) avec compte de débordement ;
  - euros courants ou constants (inflation) ;
  - impôt latent (PFU, PEA > 5 ans, assurance-vie > 8 ans avec abattement, PER à la TMI) ;
  - scénarios pessimiste / central / optimiste (±2 points sur les actifs de marché) ;
  - événements de vie : achat immobilier avec crédit, apport ou retrait ponctuel, changement / arrêt des versements
    (retraite), retraits réguliers indexés sur l'inflation ;
  - graphique empilé, jalons (100 k€, 500 k€, 1 M€), tableau annuel exportable en CSV.

## Lancer en local

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # tests du moteur de projection et de l'import CSV
npm run build    # build de production dans dist/
```

## Format CSV

En-tête obligatoire, séparateur `;` ou `,`, montants et dates au format français acceptés :

```csv
nom;type;solde;date;etablissement
Livret A;Livret A;15 200,00;01/09/2026;Ma banque
PEA;PEA;18 450,30;01/09/2026;Courtier
Prêt immo;Crédit;182 000;01/09/2026;Ma banque
```

Un compte portant déjà ce nom reçoit un nouveau solde daté ; sinon il est créé (le type est deviné et modifiable dans l'aperçu).
La plupart des banques permettent d'exporter les soldes ou relevés en CSV.

## Déploiement

Le workflow `.github/workflows/deploy.yml` publie le site sur GitHub Pages à chaque push sur `main`
(activer *Settings → Pages → Source : GitHub Actions* dans le dépôt).

## Connexion bancaire automatique

Non incluse : en France elle passe par un agrégateur agréé (Powens/Budget Insight, GoCardless Bank Account Data…)
qui nécessite un compte développeur et un serveur pour garder les clés secrètes. Le modèle de données
(`src/types.ts`, soldes datés par compte) permet d'en brancher un plus tard : il suffit d'ajouter des `Snapshot`.

## Avertissement

Les calculs (fiscalité notamment) sont simplifiés et les rendements par défaut indicatifs. Ce n'est pas un conseil en investissement.
