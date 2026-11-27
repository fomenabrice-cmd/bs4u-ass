-- Migration 054 : Seed RBAC — permissions manquantes + matrice role_permissions
-- Idempotent (ON CONFLICT DO NOTHING sur permissions, DELETE+INSERT pour role_permissions)
-- À appliquer APRÈS validation du porteur de projet

-- 1. Permissions manquantes (cash, momo, orders, products, contacts, projects)
INSERT INTO public.permissions (id, resource, action, description) VALUES
  (gen_random_uuid(), 'cash',     'read',   'Voir la caisse et les sessions'),
  (gen_random_uuid(), 'cash',     'write',  'Créer et modifier les mouvements de caisse'),
  (gen_random_uuid(), 'momo',     'read',   'Voir les opérations Mobile Money'),
  (gen_random_uuid(), 'momo',     'write',  'Créer et modifier les opérations Mobile Money'),
  (gen_random_uuid(), 'orders',   'read',   'Voir les commandes'),
  (gen_random_uuid(), 'orders',   'write',  'Créer et modifier les commandes'),
  (gen_random_uuid(), 'products', 'read',   'Voir le catalogue produits'),
  (gen_random_uuid(), 'products', 'write',  'Gérer les produits et les stocks'),
  (gen_random_uuid(), 'contacts', 'read',   'Voir les clients et fournisseurs'),
  (gen_random_uuid(), 'contacts', 'write',  'Créer et modifier les contacts'),
  (gen_random_uuid(), 'projects', 'read',   'Voir les projets'),
  (gen_random_uuid(), 'projects', 'write',  'Gérer les projets')
ON CONFLICT (resource, action) DO NOTHING;

-- 2. Matrice role_permissions (read ET write séparés)
-- Vider la table d'abord (elle était vide donc safe, et cette migration est idempotente)
TRUNCATE public.role_permissions;

INSERT INTO public.role_permissions (role, permission_id)
SELECT t.role::app_role, p.id
FROM (VALUES
  -- super_admin : toutes les permissions (read + write)
  ('super_admin','expenses','read'),  ('super_admin','expenses','write'),
  ('super_admin','invoices','read'),  ('super_admin','invoices','write'),
  ('super_admin','members','read'),   ('super_admin','members','write'),
  ('super_admin','reports','read'),   ('super_admin','settings','write'),
  ('super_admin','trainings','read'), ('super_admin','trainings','write'),
  ('super_admin','users','manage'),
  ('super_admin','cash','read'),      ('super_admin','cash','write'),
  ('super_admin','momo','read'),      ('super_admin','momo','write'),
  ('super_admin','orders','read'),    ('super_admin','orders','write'),
  ('super_admin','products','read'),  ('super_admin','products','write'),
  ('super_admin','contacts','read'),  ('super_admin','contacts','write'),
  ('super_admin','projects','read'),  ('super_admin','projects','write'),
  -- admin : identique super_admin
  ('admin','expenses','read'),  ('admin','expenses','write'),
  ('admin','invoices','read'),  ('admin','invoices','write'),
  ('admin','members','read'),   ('admin','members','write'),
  ('admin','reports','read'),   ('admin','settings','write'),
  ('admin','trainings','read'), ('admin','trainings','write'),
  ('admin','users','manage'),
  ('admin','cash','read'),      ('admin','cash','write'),
  ('admin','momo','read'),      ('admin','momo','write'),
  ('admin','orders','read'),    ('admin','orders','write'),
  ('admin','products','read'),  ('admin','products','write'),
  ('admin','contacts','read'),  ('admin','contacts','write'),
  ('admin','projects','read'),  ('admin','projects','write'),
  -- manager : opérations complètes, sans users.manage et settings.write
  ('manager','expenses','read'),  ('manager','expenses','write'),
  ('manager','invoices','read'),  ('manager','invoices','write'),
  ('manager','members','read'),
  ('manager','reports','read'),
  ('manager','trainings','read'), ('manager','trainings','write'),
  ('manager','cash','read'),      ('manager','cash','write'),
  ('manager','momo','read'),      ('manager','momo','write'),
  ('manager','orders','read'),    ('manager','orders','write'),
  ('manager','products','read'),  ('manager','products','write'),
  ('manager','contacts','read'),  ('manager','contacts','write'),
  ('manager','projects','read'),  ('manager','projects','write'),
  -- accountant : lecture + écriture financière uniquement
  ('accountant','expenses','read'),  ('accountant','expenses','write'),
  ('accountant','invoices','read'),  ('accountant','invoices','write'),
  ('accountant','reports','read'),
  ('accountant','members','read'),
  -- secretary : guichet (commandes, contacts, caisse, factures)
  ('secretary','orders','read'),    ('secretary','orders','write'),
  ('secretary','contacts','read'),  ('secretary','contacts','write'),
  ('secretary','products','read'),
  ('secretary','cash','read'),      ('secretary','cash','write'),
  ('secretary','invoices','read'),  ('secretary','invoices','write'),
  -- member : lecture formations et membres
  ('member','trainings','read'),
  ('member','members','read'),
  -- viewer : lecture rapports uniquement
  ('viewer','reports','read')
) AS t(role, resource, action)
JOIN public.permissions p ON p.resource = t.resource AND p.action = t.action
ON CONFLICT DO NOTHING;

-- 3. Fonction has_permission() — vérifie si l'utilisateur a une permission via son rôle
CREATE OR REPLACE FUNCTION public.has_permission(p_resource text, p_action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND ur.organization_id = get_my_org_id()
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
      AND p.resource = p_resource
      AND p.action = p_action
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(text, text) TO authenticated;
