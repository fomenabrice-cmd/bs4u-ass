-- Seed de référence BS4U — rôles, permissions, séries de numérotation, paramètres
-- Exécuté lors de : pnpm db:reset
-- NE JAMAIS EXÉCUTER EN PRODUCTION sans autorisation du porteur

-- =====================================================================
-- SÉRIES DE NUMÉROTATION
-- =====================================================================
insert into ops.number_series (series_code, prefix, pattern, reset_cycle, description) values
  ('ORDER',    'CMD',  'CMD-{YYYY}-{NNNNNN}', 'yearly',  'Commandes BS4U'),
  ('INVOICE',  'FAC',  'FAC-{YYYY}-{NNNNNN}', 'yearly',  'Factures'),
  ('QUOTE',    'DEV',  'DEV-{YYYY}-{NNNNNN}', 'yearly',  'Devis'),
  ('RECEIPT',  'RCU',  'RCU-{YYYY}-{NNNNNN}', 'yearly',  'Reçus de paiement'),
  ('CREDIT',   'AVO',  'AVO-{YYYY}-{NNNNNN}', 'yearly',  'Avoirs'),
  ('CUSTOMER', 'CLI',  'CLI-{NNNNNN}',         'never',   'Numéros clients'),
  ('EMPLOYEE', 'EMP',  'EMP-{NNNNNN}',         'never',   'Numéros employés'),
  ('MEMBER',   'MBR',  'MBR-{YYYY}-{NNNNNN}', 'never',   'Numéros membres association'),
  ('APPLICATION', 'CAN', 'CAN-{YYYY}-{NNNNNN}', 'yearly', 'Candidatures d''adhésion'),
  ('DUE',      'COT',  'COT-{YYYY}-{NNNNNN}', 'yearly',  'Cotisations associatives'),
  ('MOMO',     'MM',   'MM-{YYYY}-{NNNNNN}',  'yearly',  'Opérations Mobile Money'),
  ('PRINT',    'IMP',  'IMP-{YYYY}-{NNNNNN}', 'yearly',  'Travaux d''impression'),
  ('PROJECT',  'PRJ',  'PRJ-{YYYY}-{NNNNNN}', 'yearly',  'Projets numériques')
on conflict (series_code) do nothing;

-- =====================================================================
-- PERMISSIONS (catalogue complet du CLAUDE.md §06)
-- =====================================================================

-- Platform
insert into core.permissions (code, domain, label_fr, is_sensitive) values
  ('platform.users.read',         'platform', 'Lire les utilisateurs', false),
  ('platform.users.manage',       'platform', 'Gérer les utilisateurs', true),
  ('platform.roles.read',         'platform', 'Lire les rôles', false),
  ('platform.roles.manage',       'platform', 'Gérer les rôles', true),
  ('platform.settings.manage',    'platform', 'Gérer les paramètres', true),
  ('platform.flags.manage',       'platform', 'Gérer les feature flags', true),
  ('platform.integrations.manage','platform', 'Gérer les intégrations', true),
  ('platform.ai.manage',          'platform', 'Gérer l''IA', true),
  ('platform.jobs.read',          'platform', 'Lire les jobs', false),
  ('platform.jobs.retry',         'platform', 'Relancer les jobs', false),
  ('platform.backups.read',       'platform', 'Lire les sauvegardes', false),
  ('audit.read.platform',         'platform', 'Lire le journal plateforme', true),
  ('audit.read.business',         'platform', 'Lire le journal entreprise', true),
  ('audit.read.association',      'platform', 'Lire le journal association', true),
  ('audit.export',                'platform', 'Exporter le journal', true)
on conflict (code) do nothing;

-- Business — Tableau de bord
insert into core.permissions (code, domain, label_fr, is_sensitive) values
  ('biz.dashboard.read',   'business', 'Tableau de bord', false),
  ('biz.dashboard.finance','business', 'Données financières du tableau de bord', true)
on conflict (code) do nothing;

-- Business — Clients
insert into core.permissions (code, domain, label_fr, is_sensitive) values
  ('biz.customers.read',   'business', 'Lire les clients', false),
  ('biz.customers.manage', 'business', 'Gérer les clients', false),
  ('biz.customers.merge',  'business', 'Fusionner des clients', true)
on conflict (code) do nothing;

-- Business — Commandes
insert into core.permissions (code, domain, label_fr, is_sensitive) values
  ('biz.orders.read',            'business', 'Lire les commandes', false),
  ('biz.orders.create',          'business', 'Créer des commandes', false),
  ('biz.orders.update',          'business', 'Modifier des commandes', false),
  ('biz.orders.produce',         'business', 'Produire (impression)', false),
  ('biz.orders.qc',              'business', 'Contrôle qualité', false),
  ('biz.orders.deliver',         'business', 'Livraison', false),
  ('biz.orders.cancel',          'business', 'Annuler des commandes', false),
  ('biz.orders.close_with_balance','business','Clôturer avec solde', true),
  ('biz.quotes.manage',          'business', 'Gérer les devis', false)
on conflict (code) do nothing;

-- Business — Documents
insert into core.permissions (code, domain, label_fr, is_sensitive) values
  ('biz.documents.read',     'business', 'Lire les documents', false),
  ('biz.documents.create',   'business', 'Créer des documents', false),
  ('biz.documents.validate', 'business', 'Valider des documents', false),
  ('biz.templates.manage',   'business', 'Gérer les modèles', false)
on conflict (code) do nothing;

-- Business — Impression
insert into core.permissions (code, domain, label_fr, is_sensitive) values
  ('biz.printing.queue',         'business', 'File d''impression', false),
  ('biz.printing.operate',       'business', 'Opérer l''impression', false),
  ('biz.printing.pricing.manage','business', 'Gérer la tarification impression', true),
  ('biz.deliveries.manage',      'business', 'Gérer les livraisons', false)
on conflict (code) do nothing;

-- Business — Boutique / Ventes
insert into core.permissions (code, domain, label_fr, is_sensitive) values
  ('biz.catalog.read',    'business', 'Lire le catalogue', false),
  ('biz.catalog.manage',  'business', 'Gérer le catalogue', false),
  ('biz.prices.manage',   'business', 'Gérer les prix', true),
  ('biz.sales.create',    'business', 'Créer des ventes', false),
  ('biz.sales.discount',  'business', 'Accorder des remises', true),
  ('biz.sales.credit',    'business', 'Enregistrer des avoirs', true),
  ('biz.sales.void',      'business', 'Annuler des ventes', true),
  ('biz.sales.return',    'business', 'Enregistrer des retours', true)
on conflict (code) do nothing;

-- Business — Stocks
insert into core.permissions (code, domain, label_fr, is_sensitive) values
  ('biz.inventory.read',          'business', 'Lire les stocks', false),
  ('biz.inventory.receive',       'business', 'Réceptionner des stocks', false),
  ('biz.inventory.adjust',        'business', 'Ajuster les stocks', true),
  ('biz.inventory.count',         'business', 'Inventorier', false),
  ('biz.inventory.validate_count','business', 'Valider l''inventaire', true),
  ('biz.purchasing.manage',       'business', 'Gérer les achats', false),
  ('biz.suppliers.manage',        'business', 'Gérer les fournisseurs', false)
on conflict (code) do nothing;

-- Business — Finance
insert into core.permissions (code, domain, label_fr, is_sensitive) values
  ('biz.invoices.read',     'business', 'Lire les factures', true),
  ('biz.invoices.create',   'business', 'Créer des factures', true),
  ('biz.invoices.validate', 'business', 'Valider les factures', true),
  ('biz.invoices.credit_note','business','Émettre des avoirs', true),
  ('biz.payments.record',   'business', 'Enregistrer des paiements', true),
  ('biz.payments.confirm',  'business', 'Confirmer des paiements', true),
  ('biz.finance.reverse',   'business', 'Contre-passer', true),
  ('biz.expenses.create',   'business', 'Créer des dépenses', true),
  ('biz.expenses.approve',  'business', 'Approuver des dépenses', true),
  ('biz.finance.read',      'business', 'Lire les données financières', true),
  ('biz.finance.export',    'business', 'Exporter les données financières', true),
  ('biz.treasury.reconcile','business', 'Rapprocher la trésorerie', true)
on conflict (code) do nothing;

-- Business — Caisse
insert into core.permissions (code, domain, label_fr, is_sensitive) values
  ('biz.cash.open',    'business', 'Ouvrir la caisse', false),
  ('biz.cash.operate', 'business', 'Opérer la caisse', false),
  ('biz.cash.close',   'business', 'Clôturer la caisse', true),
  ('biz.cash.review',  'business', 'Revoir une clôture', true),
  ('biz.cash.reopen',  'business', 'Rouvrir une caisse', true)
on conflict (code) do nothing;

-- Business — Formation
insert into core.permissions (code, domain, label_fr, is_sensitive) values
  ('biz.training.read',       'business', 'Lire les formations', false),
  ('biz.training.manage',     'business', 'Gérer les formations', false),
  ('biz.training.attendance', 'business', 'Marquer les présences', false),
  ('biz.training.grade',      'business', 'Évaluer les apprenants', false),
  ('biz.certificates.issue',  'business', 'Émettre des certificats', false),
  ('biz.certificates.revoke', 'business', 'Révoquer des certificats', true)
on conflict (code) do nothing;

-- Business — Projets, RH, Rapports
insert into core.permissions (code, domain, label_fr, is_sensitive) values
  ('biz.projects.read',       'business', 'Lire les projets', false),
  ('biz.projects.manage',     'business', 'Gérer les projets', false),
  ('biz.subscriptions.manage','business', 'Gérer les abonnements/hébergements', false),
  ('biz.employees.read',      'business', 'Lire les employés', false),
  ('biz.employees.manage',    'business', 'Gérer les employés', true),
  ('biz.reports.read',        'business', 'Lire les rapports', true),
  ('biz.reports.export',      'business', 'Exporter les rapports', true)
on conflict (code) do nothing;

-- Mobile Money
insert into core.permissions (code, domain, label_fr, is_sensitive) values
  ('momo.transactions.read',   'business', 'Lire les transactions MoMo', true),
  ('momo.transactions.create', 'business', 'Créer des transactions MoMo', true),
  ('momo.transactions.confirm','business', 'Confirmer des transactions MoMo', true),
  ('momo.transactions.reverse','business', 'Annuler des transactions MoMo', true),
  ('momo.accounts.manage',     'business', 'Gérer les comptes MoMo', true),
  ('momo.commissions.manage',  'business', 'Gérer les commissions MoMo', true),
  ('momo.closing.submit',      'business', 'Soumettre une clôture MoMo', true),
  ('momo.closing.approve',     'business', 'Approuver une clôture MoMo', true),
  ('momo.closing.reopen',      'business', 'Rouvrir une clôture MoMo', true),
  ('momo.reconcile',           'business', 'Rapprocher MoMo', true)
on conflict (code) do nothing;

-- Association
insert into core.permissions (code, domain, label_fr, is_sensitive) values
  ('asso.settings.manage',         'association', 'Paramètres association', true),
  ('asso.documents.manage',        'association', 'Gérer les documents officiels', false),
  ('asso.documents.publish',       'association', 'Publier des documents officiels', false),
  ('asso.types.manage',            'association', 'Gérer les types de membres', true),
  ('asso.fees.propose',            'association', 'Proposer des frais', true),
  ('asso.fees.approve',            'association', 'Approuver des frais', true),
  ('asso.applications.read',       'association', 'Lire les candidatures', false),
  ('asso.applications.review',     'association', 'Instruire les candidatures', false),
  ('asso.applications.decide',     'association', 'Décider les candidatures', false),
  ('asso.members.read',            'association', 'Lire les membres', false),
  ('asso.members.read_sensitive',  'association', 'Lire données sensibles membres', true),
  ('asso.members.manage',          'association', 'Gérer les membres', false),
  ('asso.members.suspend',         'association', 'Suspendre un membre', true),
  ('asso.members.expel',           'association', 'Exclure un membre', true),
  ('asso.members.activate',        'association', 'Activer un membre', false),
  ('asso.cards.issue',             'association', 'Émettre des cartes membres', false),
  ('asso.dues.read',               'association', 'Lire les cotisations', true),
  ('asso.dues.issue',              'association', 'Émettre des cotisations', true),
  ('asso.dues.waive',              'association', 'Exonérer de cotisations', true),
  ('asso.payments.read',           'association', 'Lire les paiements association', true),
  ('asso.payments.confirm',        'association', 'Confirmer des paiements', true),
  ('asso.payments.reverse',        'association', 'Contre-passer des paiements', true),
  ('asso.ledger.read',             'association', 'Lire le journal association', true),
  ('asso.ledger.post',             'association', 'Passer des écritures', true),
  ('asso.expenses.create',         'association', 'Créer des dépenses asso', true),
  ('asso.expenses.approve',        'association', 'Approuver des dépenses asso', true),
  ('asso.finance.close_period',    'association', 'Clôturer un exercice', true),
  ('asso.finance.export',          'association', 'Exporter finances asso', true),
  ('asso.member_ledger.read',      'association', 'Lire relevé individuel membre', true),
  ('asso.refunds.approve',         'association', 'Approuver des remboursements', true),
  ('asso.reconcile',               'association', 'Rapprocher trésorerie asso', true),
  ('asso.solidarity.screen',       'association', 'Préselectionner solidarité', true),
  ('asso.solidarity.review',       'association', 'Instruire solidarité', true),
  ('asso.solidarity.decide',       'association', 'Décider solidarité', true),
  ('asso.solidarity.disburse',     'association', 'Décaisser solidarité', true),
  ('asso.solidarity.programs.manage','association','Gérer programmes solidarité', true),
  ('asso.training.manage',         'association', 'Gérer formation asso', false),
  ('asso.mentorships.manage',      'association', 'Gérer mentorat', false),
  ('asso.skills.verify',           'association', 'Vérifier compétences', false),
  ('asso.benefits.manage',         'association', 'Gérer avantages membres', false),
  ('asso.benefits.verify_redemption','association','Vérifier utilisation avantage', false),
  ('asso.opportunities.manage',    'association', 'Gérer opportunités', false),
  ('asso.businesses.verify',       'association', 'Vérifier entreprises membres', false),
  ('asso.reviews.moderate',        'association', 'Modérer avis', false),
  ('asso.events.manage',           'association', 'Gérer événements', false),
  ('asso.projects.manage',         'association', 'Gérer projets collectifs', false),
  ('asso.announcements.publish',   'association', 'Publier annonces', false),
  ('asso.groups.moderate',         'association', 'Modérer groupes', false),
  ('asso.polls.manage',            'association', 'Gérer sondages', false),
  ('asso.library.manage',          'association', 'Gérer bibliothèque', false),
  ('asso.recognitions.manage',     'association', 'Gérer distinctions', false),
  ('asso.governance.read',         'association', 'Lire la gouvernance', false),
  ('asso.governance.manage',       'association', 'Gérer la gouvernance', true),
  ('asso.mandates.manage',         'association', 'Gérer les mandats', true),
  ('asso.assemblies.manage',       'association', 'Gérer les assemblées', false),
  ('asso.resolutions.record',      'association', 'Enregistrer résolutions', false),
  ('asso.elections.manage',        'association', 'Gérer les élections', true),
  ('asso.branches.manage',         'association', 'Gérer les antennes', true)
on conflict (code) do nothing;

-- Discover
insert into core.permissions (code, domain, label_fr, is_sensitive) values
  ('disc.profile.manage_own', 'discover', 'Gérer son profil public', false),
  ('disc.moderate',           'discover', 'Modérer Discover', false),
  ('disc.reports.review',     'discover', 'Traiter les signalements', false),
  ('disc.categories.manage',  'discover', 'Gérer les catégories', false),
  ('disc.feature',            'discover', 'Mettre en avant', false),
  ('disc.contacts.read_all',  'discover', 'Lire tous les contacts', true),
  ('disc.stats.read',         'discover', 'Lire les statistiques Discover', false)
on conflict (code) do nothing;

-- Réunions
insert into core.permissions (code, domain, label_fr, is_sensitive) values
  ('meet.meetings.read',       'platform', 'Lire les réunions', false),
  ('meet.meetings.manage',     'platform', 'Gérer les réunions', false),
  ('meet.recordings.upload',   'platform', 'Uploader des enregistrements', false),
  ('meet.recordings.read',     'platform', 'Lire les enregistrements', false),
  ('meet.recordings.delete',   'platform', 'Supprimer des enregistrements', true),
  ('meet.minutes.edit',        'platform', 'Éditer les PV', false),
  ('meet.minutes.validate',    'platform', 'Valider les PV', false),
  ('meet.ai.assist',           'platform', 'Utiliser l''IA rédactionnelle', false)
on conflict (code) do nothing;

-- =====================================================================
-- RÔLES (voir docs/06_SECURITY_RBAC_RLS.md §4)
-- =====================================================================
insert into core.roles (code, label_fr, domain, is_system) values
  ('PLATFORM_SUPERADMIN',         'Super-administrateur plateforme', 'platform',    true),
  ('PLATFORM_ADMIN',              'Administrateur plateforme',       'platform',    true),
  ('SECURITY_AUDITOR',            'Auditeur sécurité',               'platform',    true),
  ('CONTENT_MODERATOR',           'Modérateur de contenu',           'discover',    true),
  ('BUSINESS_ADMIN',              'Administrateur entreprise',       'business',    true),
  ('BUSINESS_MANAGER',            'Gérant BS4U',                     'business',    true),
  ('SECRETARY',                   'Secrétaire',                      'business',    true),
  ('PRINT_OPERATOR',              'Opérateur impression',            'business',    true),
  ('CASHIER',                     'Caissier / vendeur',              'business',    true),
  ('SALES_AGENT',                 'Agent commercial',                'business',    true),
  ('MOBILE_MONEY_AGENT',          'Agent Mobile Money',              'business',    true),
  ('STOCK_MANAGER',               'Gestionnaire de stock',           'business',    true),
  ('BUSINESS_ACCOUNTANT',         'Comptable entreprise',            'business',    true),
  ('COMMERCIAL_TRAINING_MANAGER', 'Responsable formation commerciale','business',   true),
  ('TRAINER',                     'Formateur',                       'learning',    true),
  ('DIGITAL_PROJECT_LEAD',        'Chef de projet numérique',        'business',    true),
  ('ASSOCIATION_ADMIN',           'Administrateur association',      'association', true),
  ('ASSOCIATION_PRESIDENT',       'Président',                       'association', true),
  ('ASSOCIATION_SECRETARY',       'Secrétaire général association',  'association', true),
  ('ASSOCIATION_TREASURER',       'Trésorier associatif',            'association', true),
  ('ASSOCIATION_ASSISTANT_TREASURER','Trésorier adjoint',            'association', true),
  ('MEMBERSHIP_MANAGER',          'Responsable des adhésions',       'association', true),
  ('SOLIDARITY_COMMITTEE_MEMBER', 'Comité de solidarité',            'association', true),
  ('TRAINING_COORDINATOR',        'Coordinateur formation asso',     'association', true),
  ('BRANCH_LEAD',                 'Responsable d''antenne',          'association', true),
  ('MENTOR',                      'Mentor',                          'association', true),
  ('ASSOCIATION_MEMBER',          'Membre de l''association',        'association', true),
  ('CUSTOMER',                    'Client',                          'discover',    true),
  ('LEARNER',                     'Apprenant',                       'learning',    true)
on conflict (code) do nothing;

-- =====================================================================
-- ASSIGNATION DE PERMISSIONS AUX RÔLES (extrait principal)
-- =====================================================================

-- Helper : assigner plusieurs permissions à un rôle
create or replace function ops._assign_permissions(p_role_code text, p_permission_codes text[])
returns void language plpgsql as $$
declare
  v_role_id uuid;
  v_perm_code text;
  v_perm_id uuid;
begin
  select id into v_role_id from core.roles where code = p_role_code;
  if v_role_id is null then return; end if;

  foreach v_perm_code in array p_permission_codes loop
    select id into v_perm_id from core.permissions where code = v_perm_code;
    if v_perm_id is not null then
      insert into core.role_permissions (role_id, permission_id)
      values (v_role_id, v_perm_id)
      on conflict do nothing;
    end if;
  end loop;
end;
$$;

-- PLATFORM_SUPERADMIN — tout plateforme
select ops._assign_permissions('PLATFORM_SUPERADMIN', array[
  'platform.users.read','platform.users.manage','platform.roles.read','platform.roles.manage',
  'platform.settings.manage','platform.flags.manage','platform.integrations.manage',
  'platform.ai.manage','platform.jobs.read','platform.jobs.retry','platform.backups.read',
  'audit.read.platform','audit.read.business','audit.read.association','audit.export'
]);

-- PLATFORM_ADMIN
select ops._assign_permissions('PLATFORM_ADMIN', array[
  'platform.users.read','platform.users.manage','platform.roles.read',
  'platform.settings.manage','platform.flags.manage','platform.jobs.read','platform.jobs.retry'
]);

-- SECURITY_AUDITOR
select ops._assign_permissions('SECURITY_AUDITOR', array[
  'audit.read.platform','audit.read.business','audit.read.association','audit.export'
]);

-- BUSINESS_MANAGER
select ops._assign_permissions('BUSINESS_MANAGER', array[
  'biz.dashboard.read','biz.dashboard.finance',
  'biz.customers.read','biz.customers.manage',
  'biz.orders.read','biz.orders.create','biz.orders.update','biz.orders.deliver',
  'biz.orders.cancel','biz.orders.close_with_balance','biz.quotes.manage',
  'biz.documents.read','biz.documents.validate','biz.templates.manage',
  'biz.printing.pricing.manage','biz.deliveries.manage',
  'biz.catalog.read','biz.catalog.manage','biz.prices.manage',
  'biz.sales.discount','biz.sales.void',
  'biz.inventory.read','biz.purchasing.manage','biz.suppliers.manage',
  'biz.invoices.read','biz.invoices.validate','biz.payments.confirm',
  'biz.finance.reverse','biz.expenses.approve','biz.finance.read','biz.finance.export',
  'biz.treasury.reconcile','biz.cash.review','biz.cash.reopen',
  'biz.training.read','biz.training.manage','biz.certificates.issue',
  'biz.projects.read','biz.projects.manage','biz.subscriptions.manage',
  'biz.employees.read','biz.reports.read','biz.reports.export',
  'momo.closing.approve','momo.reconcile'
]);

-- SECRETARY
select ops._assign_permissions('SECRETARY', array[
  'biz.customers.read','biz.customers.manage',
  'biz.orders.create','biz.orders.update','biz.orders.deliver',
  'biz.documents.read','biz.documents.create','biz.quotes.manage',
  'biz.dashboard.read','meet.ai.assist'
]);

-- PRINT_OPERATOR
select ops._assign_permissions('PRINT_OPERATOR', array[
  'biz.printing.queue','biz.printing.operate',
  'biz.orders.produce','biz.orders.qc','biz.deliveries.manage',
  'biz.dashboard.read'
]);

-- CASHIER
select ops._assign_permissions('CASHIER', array[
  'biz.cash.open','biz.cash.operate','biz.cash.close',
  'biz.sales.create','biz.payments.record',
  'biz.customers.read','biz.catalog.read',
  'asso.benefits.verify_redemption','biz.dashboard.read'
]);

-- MOBILE_MONEY_AGENT
select ops._assign_permissions('MOBILE_MONEY_AGENT', array[
  'momo.transactions.read','momo.transactions.create','momo.closing.submit',
  'biz.dashboard.read'
]);

-- STOCK_MANAGER
select ops._assign_permissions('STOCK_MANAGER', array[
  'biz.inventory.read','biz.inventory.receive','biz.inventory.adjust',
  'biz.inventory.count','biz.inventory.validate_count',
  'biz.purchasing.manage','biz.suppliers.manage',
  'biz.catalog.read','biz.catalog.manage','biz.dashboard.read'
]);

-- ASSOCIATION_ADMIN
select ops._assign_permissions('ASSOCIATION_ADMIN', array[
  'asso.settings.manage','asso.documents.manage','asso.documents.publish',
  'asso.types.manage','asso.applications.read','asso.applications.review','asso.applications.decide',
  'asso.members.read','asso.members.manage','asso.members.activate','asso.cards.issue',
  'asso.events.manage','asso.projects.manage','asso.announcements.publish',
  'asso.groups.moderate','asso.polls.manage','asso.library.manage',
  'asso.benefits.manage','asso.governance.read','audit.read.association'
]);

-- ASSOCIATION_TREASURER
select ops._assign_permissions('ASSOCIATION_TREASURER', array[
  'asso.dues.read','asso.dues.issue','asso.dues.waive',
  'asso.payments.read','asso.payments.confirm','asso.payments.reverse',
  'asso.ledger.read','asso.ledger.post',
  'asso.expenses.create','asso.expenses.approve',
  'asso.finance.close_period','asso.finance.export',
  'asso.member_ledger.read','asso.refunds.approve','asso.reconcile'
]);

-- =====================================================================
-- PARAMÈTRES SYSTÈME (décisions en attente)
-- =====================================================================
insert into core.system_settings (key, value, scope, description, is_decision_pending, decision_ref) values
  -- Décisions en attente (voir 22_OPEN_DECISIONS.md)
  ('asso.fee.standard_active_xaf',     'null', 'association',
   'Montant cotisation annuelle membre actif (FCFA)', true, 'AD-001'),
  ('asso.fee.youth_xaf',               'null', 'association',
   'Montant cotisation annuelle membre jeune (FCFA)', true, 'AD-002'),
  ('asso.fee.founder_exemption',       'null', 'association',
   'Exonération fondateurs (true/false + conditions)', true, 'AD-003'),
  ('asso.governance.votes_per_member', 'null', 'association',
   'Nombre de votes par membre en AG', true, 'AD-004'),
  ('biz.tax.vat_enabled',             'false', 'business',
   'Activation TVA (false = désactivé)', false, 'BU-006'),
  ('biz.tax.vat_rate_bps',            '0',    'business',
   'Taux TVA en points de base (0 = désactivé)', false, 'BU-006'),
  ('biz.printing.default_prices',     'null', 'business',
   'Tarifs d''impression par format/couleur/face', true, 'BU-001'),
  ('platform.domain',                 '"bs4u.cm"', 'platform',
   'Domaine officiel du site', false, null),
  ('platform.country_code',           '"CM"',  'platform',
   'Code pays par défaut', false, null),
  ('platform.currency',               '"XAF"', 'platform',
   'Monnaie (XAF = FCFA, pas de décimale)', false, null),
  ('platform.timezone',               '"Africa/Douala"', 'platform',
   'Fuseau horaire de référence', false, null)
on conflict (key) do nothing;

-- Nettoyage de la fonction helper
drop function if exists ops._assign_permissions(text, text[]);
