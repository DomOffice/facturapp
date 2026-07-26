\set ON_ERROR_STOP on

\pset border 2
\pset null '(null)'

\echo
\echo ============================================================
\echo FACTURAPP - VERIFICATION APRES RESTAURATION
\echo ============================================================
\echo

SELECT
  current_database() AS base_courante,
  current_user AS utilisateur_courant,
  inet_server_addr() AS adresse_serveur,
  inet_server_port() AS port_serveur,
  now() AS date_verification;

\echo
\echo ------------------------------------------------------------
\echo TABLES PRESENTES DANS LE SCHEMA PUBLIC
\echo ------------------------------------------------------------
\echo

SELECT
  tablename AS table_postgresql
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

\echo
\echo ------------------------------------------------------------
\echo COMPTAGES DES TABLES
\echo ------------------------------------------------------------
\echo

/*
 * Ne pas utiliser ON COMMIT DROP ici.
 *
 * psql fonctionne normalement en autocommit et supprimerait
 * immediatement la table apres sa creation.
 */
CREATE TEMP TABLE verification_comptages (
  table_name text NOT NULL,
  row_count bigint NOT NULL
);

DO $$
DECLARE
  table_record record;
  nombre_lignes bigint;
BEGIN
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.%I',
      table_record.tablename
    )
    INTO nombre_lignes;

    INSERT INTO verification_comptages (
      table_name,
      row_count
    )
    VALUES (
      table_record.tablename,
      nombre_lignes
    );
  END LOOP;
END
$$;

SELECT
  table_name,
  row_count
FROM verification_comptages
ORDER BY table_name;

\echo
\echo ------------------------------------------------------------
\echo SEQUENCES DU SCHEMA PUBLIC
\echo ------------------------------------------------------------
\echo

SELECT
  schemaname,
  sequencename,
  last_value
FROM pg_sequences
WHERE schemaname = 'public'
ORDER BY sequencename;

\echo
\echo ------------------------------------------------------------
\echo TABLES ATTENDUES POUR OCR ET STOCK
\echo ------------------------------------------------------------
\echo

WITH tables_attendues(nom_logique, noms_possibles) AS (
  VALUES
    (
      'DocumentImporte',
      ARRAY[
        'DocumentImporte',
        'documents_importes'
      ]::text[]
    ),
    (
      'LigneImportee',
      ARRAY[
        'LigneImportee',
        'lignes_importees'
      ]::text[]
    ),
    (
      'AssociationArticleFournisseur',
      ARRAY[
        'AssociationArticleFournisseur',
        'associations_articles_fournisseurs'
      ]::text[]
    ),
    (
      'IntegrationStock',
      ARRAY[
        'IntegrationStock',
        'integrations_stock'
      ]::text[]
    ),
    (
      'MouvementStock',
      ARRAY[
        'MouvementStock',
        'mouvements_stock'
      ]::text[]
    )
)
SELECT
  nom_logique,
  EXISTS (
    SELECT 1
    FROM pg_tables AS tables_publiques
    WHERE tables_publiques.schemaname = 'public'
      AND tables_publiques.tablename = ANY (
        tables_attendues.noms_possibles
      )
  ) AS presente
FROM tables_attendues
ORDER BY nom_logique;

\echo
\echo ------------------------------------------------------------
\echo CONTROLE DES CONTRAINTES ETRANGERES NON VALIDEES
\echo ------------------------------------------------------------
\echo

SELECT
  namespace.nspname AS schema_name,
  table_class.relname AS table_name,
  contrainte.conname AS constraint_name
FROM pg_constraint AS contrainte
JOIN pg_class AS table_class
  ON table_class.oid = contrainte.conrelid
JOIN pg_namespace AS namespace
  ON namespace.oid = table_class.relnamespace
WHERE contrainte.contype = 'f'
  AND namespace.nspname = 'public'
  AND contrainte.convalidated = false
ORDER BY
  table_class.relname,
  contrainte.conname;

\echo
\echo ------------------------------------------------------------
\echo FIN DE LA VERIFICATION
\echo ------------------------------------------------------------
\echo

SELECT
  'Verification terminee' AS resultat,
  now() AS date_fin;