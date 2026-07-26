-- ============================================================
-- FacturApp - Recalage automatique des sequences PostgreSQL
--
-- Pour chaque colonne possedant une sequence, la prochaine valeur
-- sera positionnee apres la plus grande valeur deja importee.
-- ============================================================

\set ON_ERROR_STOP on

\echo
\echo ============================================================
\echo FACTURAPP - RECALCUL DES SEQUENCES
\echo ============================================================
\echo

DO $$
DECLARE
  sequence_record record;
  valeur_max bigint;
  valeur_sequence bigint;
BEGIN
  /*
   * Recherche des colonnes du schema public possedant une sequence
   * serial ou identity accessible par pg_get_serial_sequence.
   */
  FOR sequence_record IN
    SELECT
      cols.table_schema,
      cols.table_name,
      cols.column_name,
      pg_get_serial_sequence(
        format('%I.%I', cols.table_schema, cols.table_name),
        cols.column_name
      ) AS sequence_name
    FROM information_schema.columns AS cols
    WHERE cols.table_schema = 'public'
      AND pg_get_serial_sequence(
        format('%I.%I', cols.table_schema, cols.table_name),
        cols.column_name
      ) IS NOT NULL
    ORDER BY
      cols.table_name,
      cols.ordinal_position
  LOOP
    EXECUTE format(
      'SELECT max(%I)::bigint FROM %I.%I',
      sequence_record.column_name,
      sequence_record.table_schema,
      sequence_record.table_name
    )
    INTO valeur_max;

    /*
     * Table vide :
     * la prochaine valeur doit etre 1.
     *
     * Table non vide :
     * la sequence est placee sur la valeur maximale existante
     * avec is_called = true.
     */
    IF valeur_max IS NULL THEN
      EXECUTE format(
        'SELECT setval(%L, 1, false)',
        sequence_record.sequence_name
      )
      INTO valeur_sequence;

      RAISE NOTICE
        'Sequence % remise a 1 pour %.% (table vide)',
        sequence_record.sequence_name,
        sequence_record.table_schema,
        sequence_record.table_name;
    ELSE
      EXECUTE format(
        'SELECT setval(%L, %s, true)',
        sequence_record.sequence_name,
        valeur_max
      )
      INTO valeur_sequence;

      RAISE NOTICE
        'Sequence % positionnee sur % pour %.%',
        sequence_record.sequence_name,
        valeur_max,
        sequence_record.table_schema,
        sequence_record.table_name;
    END IF;
  END LOOP;
END
$$;

\echo
\echo Recalcul des sequences termine.
\echo