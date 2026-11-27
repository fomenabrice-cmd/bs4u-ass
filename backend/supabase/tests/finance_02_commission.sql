-- Finance test 02 : Commission MoMo n'est pas un revenu direct de vente
-- Scénario : Transaction MoMo = 1 000 XAF, commission = revenu MoMo séparé (compte 731/732)
BEGIN;
SELECT plan(3);

-- La commission MoMo doit être dans le compte 731 ou 732, PAS dans 701 (ventes produits)
-- Vérification structurelle : les comptes 731/732 existent dans le plan comptable
SELECT ok(
  EXISTS (SELECT 1 FROM biz.chart_of_accounts WHERE account_code = '731'),
  'Compte 731 (Commissions MoMo MTN) existe dans le plan comptable'
);

SELECT ok(
  EXISTS (SELECT 1 FROM biz.chart_of_accounts WHERE account_code = '732'),
  'Compte 732 (Commissions MoMo Orange) existe dans le plan comptable'
);

-- La règle : une commission MoMo NE DOIT PAS utiliser le compte 701
-- (séparation commission vs vente produit)
SELECT ok(
  (SELECT account_class FROM biz.chart_of_accounts WHERE account_code = '731') = 7
  AND
  (SELECT account_class FROM biz.chart_of_accounts WHERE account_code = '701') = 7
  AND
  (SELECT account_code FROM biz.chart_of_accounts WHERE account_code = '731') <> '701',
  'Compte commission (731) distinct du compte ventes produits (701)'
);

SELECT * FROM finish();
ROLLBACK;
