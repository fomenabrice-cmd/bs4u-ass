# Guide utilisateur — Module Finance (F0–F8)

> Application : BS4U Manager  
> Public : Gestionnaires, comptables, responsables d'agence  
> Pré-requis : Compte authentifié avec permission `finance:read`

---

## Navigation

Le module Finance est accessible depuis le menu latéral → **Finance**.  
Il comprend 8 sections (onglets) :

| Onglet | Rôle |
|--------|------|
| Tableau de bord | Vue synthétique des KPI de la période |
| Journal | Écritures comptables |
| Immobilisations | Actifs et amortissements |
| Emprunts & Capital | Emprunts, remboursements, apports |
| Marges | Analyse marges brutes/nettes |
| Rentabilité | Courbe de rentabilité |
| Rapports | Bilan simplifié |
| Commissions | Synthèse commissions MoMo |

---

## F0 — Tableau de bord Finance

**Accès** : Finance → Tableau de bord

Affiche les KPI de la période comptable en cours :

| KPI | Description |
|-----|-------------|
| Revenus ventes | Chiffre d'affaires produits |
| Revenus services | Chiffre d'affaires services |
| Commissions | Commissions MoMo nettes |
| Charges | Dépenses opérationnelles |
| Dotations | Amortissements de la période |
| Résultat net | Revenus − Charges − Dotations |
| Trésorerie totale | Solde de tous les comptes |
| Fonds disponibles | Trésorerie − Réserves obligatoires |

La période s'affiche automatiquement (période `open` la plus récente).

---

## F1 — Journal comptable

**Accès** : Finance → Journal  
**Permission requise** : `finance:write` pour créer des écritures

### Consulter les écritures

Le tableau liste toutes les écritures de la période en cours, triées par date décroissante.

Colonnes : N° d'écriture · Date · Description · Source · Montant · Statut

Statuts :
- **Brouillon** (jaune) : écriture créée, non validée
- **Posté** (vert) : écriture définitive, immuable
- **Annulé** (gris) : écriture contra-passée

### Créer une écriture manuelle

1. Cliquer **Nouvelle écriture** (bouton bleu, haut à droite)
2. Remplir :
   - **Description** : libellé de l'écriture (obligatoire)
   - **Date** : date comptable (défaut = aujourd'hui)
3. Saisir au moins **2 lignes** (compte débit + compte crédit) :
   - Code compte SYSCOHADA (ex: `601` Achat marchandises, `411` Clients)
   - Type : Débit ou Crédit
   - Montant en XAF
4. L'indicateur d'équilibre s'affiche en temps réel (vert si Débit = Crédit)
5. Cliquer **Créer (brouillon)**

> L'écriture est créée en statut **Brouillon**. Elle sera postée lors de la clôture de période.

**Numérotation automatique** : format `JNL-2026-000001`

---

## F2 — Immobilisations

**Accès** : Finance → Immobilisations

### Consulter les actifs

Chaque actif s'affiche en carte avec :
- Statut (Actif / Cédé / Totalement amorti)
- Numéro d'immobilisation (`IMM-YYYY-NNNNNN`)
- Coût d'acquisition
- Valeur nette comptable
- Barre de progression d'amortissement

### Enregistrer une nouvelle immobilisation

1. Cliquer **Nouvelle immobilisation**
2. Remplir :
   - **Désignation** : nom de l'actif (ex: "Ordinateur portable Dell")
   - **Catégorie** : Matériel IT / Bureau / Mobilier / Véhicule / Autre
   - **Durée d'amortissement** : en mois (ex: 36 mois = 3 ans)
   - **Coût d'acquisition** : montant en XAF
   - **Valeur résiduelle** : valeur en fin de vie (peut être 0)
   - **Date d'acquisition**
   - Notes (optionnel)
3. Cliquer **Créer l'actif**

**Numérotation automatique** : format `IMM-2026-000001`

Le **tableau d'amortissement linéaire** est généré automatiquement.

> Validation : le coût doit être supérieur à la valeur résiduelle.

### Calculer les dotations

Les dotations sont calculées automatiquement via la RPC `compute_depreciation` lors de la clôture de période. Les entrées sont idempotentes.

---

## F3 — Emprunts & Capital

**Accès** : Finance → Emprunts & Capital

### Consulter les emprunts

Tableau des emprunts actifs et soldés avec :
- Numéro d'emprunt (`EMR-YYYY-NNNNNN`)
- Prêteur et type (Bancaire / Personnel / Fournisseur / Autre)
- Capital initial · Remboursé · Restant dû

### Enregistrer un emprunt

1. Cliquer **Nouvel emprunt**
2. Remplir :
   - **Prêteur** : nom de la banque ou de la personne
   - **Type** : Bancaire / Personnel / Fournisseur / Autre
   - **Capital emprunté** : montant en XAF
   - **Taux annuel** : en % (0 si prêt sans intérêt)
   - **Date de décaissement**
   - **Date d'échéance** (optionnel)
3. Cliquer **Créer l'emprunt**

**Numérotation automatique** : format `EMR-2026-000001`

### Enregistrer un remboursement

Sur un emprunt `Actif`, cliquer **Enregistrer un remboursement** :

1. **Date de remboursement**
2. **Capital remboursé** (XAF)
3. **Intérêts** (XAF)
4. **Frais** (XAF)
5. Le **Total** se calcule automatiquement

> Validation : capital + intérêts + frais = total (vérification anti-écart)

### Consulter les apports en capital

Le bas de la page affiche les apports en capital des associés/actionnaires avec nom, montant et date.

---

## F4 — Analyse des marges

**Accès** : Finance → Marges

Affiche pour la période en cours :
- **Marge brute** = Revenus totaux − Charges directes
- **Taux de marge brute** = Marge brute / Revenus × 100
- Évolution graphique des 6 dernières périodes
- Comparaison budgétaire (si budget configuré)

---

## F5 — Rentabilité

**Accès** : Finance → Rentabilité

Courbe de rentabilité mensuelle avec :
- Revenus vs. Charges par période
- Point mort (break-even)
- Résultat net cumulé

---

## F6 — Rapports financiers

**Accès** : Finance → Rapports

Bilan simplifié de la période :
- **Actif** : trésorerie, immobilisations nettes, créances
- **Passif** : capital, réserves, emprunts restants, résultat

Le rapport peut être imprimé via le bouton **Exporter** (PDF).

---

## F7 — Commissions MoMo

**Accès** : Finance → Commissions

Synthèse des commissions perçues sur les opérations MoMo :
- Commissions nettes par période
- Répartition par opérateur (MTN, Orange, etc.)
- Évolution mensuelle

> Les commissions sont agrégées depuis les clôtures journalières MoMo.  
> Seules les commissions nettes sont comptabilisées en revenus (pas les montants transactionnels bruts).

---

## Gestion des périodes comptables

### Ouvrir une période
Depuis Administration → Périodes, créer une nouvelle période avec :
- Label (ex: "Décembre 2026")
- Date de début et fin
- Statut `open`

Une seule période peut être `open` à la fois.

### Clôturer une période
1. Vérifier que toutes les écritures en brouillon sont correctes
2. Passer la période en `closed` (bloque la création de nouvelles écritures)
3. Lancer le calcul des dotations (`compute_depreciation`)
4. Vérifier le tableau de bord KPI
5. Passer en `locked` pour archivage définitif

---

## Codes d'erreur courants

| Erreur | Cause | Solution |
|--------|-------|---------|
| "Écriture non équilibrée" | Débit ≠ Crédit | Vérifier les montants de chaque ligne |
| "Aucune période ouverte" | Pas de période `open` | Créer ou rouvrir une période |
| "Le coût doit dépasser la valeur résiduelle" | Formulaire actif invalide | Corriger les montants |
| "Description requise" | Champ vide | Saisir une description |

---

## Droits requis

| Action | Permission |
|--------|-----------|
| Consulter le tableau de bord | `finance:read` |
| Lire journal, actifs, emprunts | `finance:read` |
| Créer écriture, actif, emprunt | `finance:write` |
| Clôturer une période | `finance:admin` |
| Calculer les dotations | `finance:admin` |
