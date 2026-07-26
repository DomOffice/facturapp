-- ============================================================
-- FacturApp - Vidage complet des donnees de la base DEV
--
-- Ce script conserve :
--   - les tables ;
--   - les colonnes ;
--   - les index ;
--   - les contraintes ;
--   - les migrations Prisma.
--
-- Il vide toutes les tables du schema public, sauf
-- "_prisma_migrations", puis remet les identites a zero.
-- ============================================================

\set ON_ERROR_STOP on

\echo
\echo ============================================================
\echo FACTURAPP - VIDAGE DES DONNEES DEV
\echo ============================================================
\echo

SELECT
  current_database() AS base_courante,
  current_user AS utilisateur_courant,
  now() AS date_execution;

DO $$
DECLARE
  liste_tables text;
BEGIN
  /*
   * Construction de la liste de toutes les tables ordinaires
   * du schema public, sauf _prisma_migrations.
   */
  SELECT string_agg(
    format('%I.%I', schemaname, tablename),
    ', '
    ORDER BY tablename
  )
  INTO liste_tables
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename <> '_prisma_migrations';

  IF liste_tables IS NULL THEN
    RAISE NOTICE
      'Aucune table a vider dans le schema public.';
    RETURN;
  END IF;

  RAISE NOTICE
    'Vidage des tables DEV : %',
    liste_tables;

  /*
   * RESTART IDENTITY remet les sequences liees aux colonnes
   * serial/identity a leur valeur initiale.
   *
   * CASCADE permet de gerer les relations entre les tables.
   *
   * Aucune table ni colonne n'est supprimee.
   */
  EXECUTE format(
    'TRUNCATE TABLE %s RESTART IDENTITY CASCADE',
    liste_tables
  );
END
$$;

\echo
\echo Vidage DEV termine.
\echo