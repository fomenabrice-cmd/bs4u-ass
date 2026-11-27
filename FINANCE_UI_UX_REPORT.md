# FINANCE_UI_UX_REPORT
_Généré le 2026-11-27_

## Navigation

### Avant
4 liens plats dans la sidebar Finance (sans groupement).

### Après (implémenté)
Groupe Finance avec 4 sous-groupes collapsibles :
- **Vue d'ensemble** (lien direct, toujours visible)
- **Pilotage** : Marges, Commissions, Rentabilité, Rapports
- **Trésorerie** : Trésorerie & comptes, Dépenses (perm), Encaissements (perm), Factures (perm), Journal, Clôtures
- **Capital & actifs** : Capital, Réserves, Immobilisations, Amortissements, Emprunts
- **Config** : Paramètres

Sous-groupes auto-ouverts quand on est sur `/finance/*`. RBAC respecté via `perm` field.

## Composants UI par page

| Page | Pattern | Spécificités |
|---|---|---|
| Vue d'ensemble | KPI cards (4 sections) | Période courante, format XAF fr-CM |
| Marges | Calcul depuis KPIs | 3 métriques : brute, nette, dépenses |
| Commissions | Table + agrégation par opérateur | Badges colorés par statut |
| Rentabilité | Simulateur interactif | Seuil de rentabilité temps réel |
| Rapports | Liste de 6 types | Boutons à implémenter |
| Trésorerie | 2 sections : reconciliations + MoMo | Icônes CheckCircle/XCircle |
| Dépenses | Table filtrée | Modal création avec validation |
| Encaissements | Table paginée | Factures reçues |
| Factures | Table | Statut coloré |
| Journal | Table + modal écriture | Validation équilibre débit/crédit |
| Clôtures | Timeline périodes | Bouton fermeture période |
| Capital | Liste cartes | Stub — empty state affiché |
| Réserves | Progress bars | Stub — empty state affiché |
| Immobilisations | Grid de cartes | Stub + modal création inactive |
| Amortissements | Table calendrier | Stub — empty state affiché |
| Emprunts | Cards + modal | Stub + modal création inactive |
| Paramètres | Liste allocation rules | Read-only |

## Points d'amélioration identifiés

1. **Rapports** : boutons `alert()` → implémenter export réel (CSV/PDF)
2. **Paramètres** : pas d'édition des allocation_rules → formulaire édition à ajouter
3. **Marges** : pas de détail par produit → nécessite intégration Stock (Phase 4)
4. **Journal** : modal création sans sélecteur de compte SYSCOHADA → liste déroulante `chart_of_accounts`
5. **Scroll sidebar** : Finance en bas du menu — considérer réorganisation ou sticky header
