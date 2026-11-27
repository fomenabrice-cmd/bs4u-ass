-- Finance F0.04 — Seed plan de comptes SYSCOHADA simplifié (Cameroun)
-- Prérequis : biz.chart_of_accounts (20261126000200)

insert into biz.chart_of_accounts (account_code, account_name, account_class, account_type) values
  -- Classe 2 : Actifs immobilisés
  ('21',  'Immobilisations corporelles',       2, 'asset'),
  ('210', 'Matériel informatique',             2, 'asset'),
  ('211', 'Matériel de bureau',                2, 'asset'),
  ('212', 'Aménagements locaux',               2, 'asset'),
  ('28',  'Amortissements cumulés',            2, 'asset'),
  ('280', 'Amort. matériel informatique',      2, 'asset'),
  ('281', 'Amort. matériel de bureau',         2, 'asset'),
  -- Classe 3 : Stocks
  ('31',  'Stocks de fournitures',             3, 'asset'),
  ('310', 'Fournitures consommables',          3, 'asset'),
  ('32',  'Stocks de marchandises',            3, 'asset'),
  ('320', 'Marchandises revente',              3, 'asset'),
  -- Classe 4 : Tiers
  ('40',  'Fournisseurs',                      4, 'liability'),
  ('401', 'Fournisseurs ordinaires',           4, 'liability'),
  ('41',  'Clients et comptes rattachés',      4, 'asset'),
  ('411', 'Clients',                           4, 'asset'),
  ('46',  'Associés et actionnaires',          4, 'equity'),
  ('461', 'Apports en capital',                4, 'equity'),
  ('47',  'Créditeurs divers',                 4, 'liability'),
  ('471', 'Dettes financières (emprunts)',     4, 'liability'),
  -- Classe 5 : Trésorerie
  ('51',  'Caisse',                            5, 'asset'),
  ('511', 'Caisse principale',                 5, 'asset'),
  ('512', 'Caisse secondaire',                 5, 'asset'),
  ('52',  'Banque',                            5, 'asset'),
  ('521', 'Compte bancaire principal',         5, 'asset'),
  ('53',  'Mobile Money',                      5, 'asset'),
  ('531', 'MTN MoMo',                          5, 'asset'),
  ('532', 'Orange Money',                      5, 'asset'),
  ('59',  'Réserves de trésorerie',            5, 'asset'),
  ('591', 'Réserve de sécurité',               5, 'asset'),
  ('592', 'Réserve équipements',               5, 'asset'),
  ('593', 'Réserve stock',                     5, 'asset'),
  ('594', 'Fonds de développement',            5, 'asset'),
  -- Classe 6 : Charges
  ('60',  'Achats et variation de stocks',     6, 'expense'),
  ('601', 'Achats de fournitures',             6, 'expense'),
  ('61',  'Services extérieurs',               6, 'expense'),
  ('611', 'Loyer et charges locatives',        6, 'expense'),
  ('612', 'Eau et électricité',               6, 'expense'),
  ('613', 'Internet et téléphone',             6, 'expense'),
  ('62',  'Transports et déplacements',        6, 'expense'),
  ('621', 'Transport marchandises',            6, 'expense'),
  ('63',  'Charges de personnel',              6, 'expense'),
  ('631', 'Salaires et traitements',           6, 'expense'),
  ('64',  'Marketing et communication',        6, 'expense'),
  ('641', 'Publicité',                         6, 'expense'),
  ('65',  'Autres charges d''exploitation',    6, 'expense'),
  ('651', 'Charges diverses',                  6, 'expense'),
  ('68',  'Dotations aux amortissements',      6, 'expense'),
  ('681', 'Amort. immobilisations corporelles',6, 'expense'),
  ('69',  'Charges financières',               6, 'expense'),
  ('691', 'Intérêts sur emprunts',             6, 'expense'),
  -- Classe 7 : Produits
  ('70',  'Ventes de marchandises',            7, 'revenue'),
  ('701', 'Ventes produits physiques',         7, 'revenue'),
  ('71',  'Prestations de services',           7, 'revenue'),
  ('711', 'Impression et photocopie',          7, 'revenue'),
  ('712', 'Scan et numérisation',              7, 'revenue'),
  ('713', 'Reliure et finition',               7, 'revenue'),
  ('714', 'Autres prestations',                7, 'revenue'),
  ('73',  'Commissions et courtages',          7, 'revenue'),
  ('731', 'Commissions MTN MoMo',              7, 'revenue'),
  ('732', 'Commissions Orange Money',          7, 'revenue'),
  ('79',  'Produits divers',                   7, 'revenue'),
  ('791', 'Produits financiers divers',        7, 'revenue')
on conflict (account_code) do nothing;

-- Liens hiérarchiques parent_code
update biz.chart_of_accounts set parent_code = '21' where account_code in ('210','211','212');
update biz.chart_of_accounts set parent_code = '28' where account_code in ('280','281');
update biz.chart_of_accounts set parent_code = '31' where account_code = '310';
update biz.chart_of_accounts set parent_code = '32' where account_code = '320';
update biz.chart_of_accounts set parent_code = '40' where account_code = '401';
update biz.chart_of_accounts set parent_code = '41' where account_code = '411';
update biz.chart_of_accounts set parent_code = '46' where account_code = '461';
update biz.chart_of_accounts set parent_code = '47' where account_code = '471';
update biz.chart_of_accounts set parent_code = '51' where account_code in ('511','512');
update biz.chart_of_accounts set parent_code = '52' where account_code = '521';
update biz.chart_of_accounts set parent_code = '53' where account_code in ('531','532');
update biz.chart_of_accounts set parent_code = '59' where account_code in ('591','592','593','594');
update biz.chart_of_accounts set parent_code = '60' where account_code = '601';
update biz.chart_of_accounts set parent_code = '61' where account_code in ('611','612','613');
update biz.chart_of_accounts set parent_code = '62' where account_code = '621';
update biz.chart_of_accounts set parent_code = '63' where account_code = '631';
update biz.chart_of_accounts set parent_code = '64' where account_code = '641';
update biz.chart_of_accounts set parent_code = '65' where account_code = '651';
update biz.chart_of_accounts set parent_code = '68' where account_code = '681';
update biz.chart_of_accounts set parent_code = '69' where account_code = '691';
update biz.chart_of_accounts set parent_code = '70' where account_code = '701';
update biz.chart_of_accounts set parent_code = '71' where account_code in ('711','712','713','714');
update biz.chart_of_accounts set parent_code = '73' where account_code in ('731','732');
update biz.chart_of_accounts set parent_code = '79' where account_code = '791';
