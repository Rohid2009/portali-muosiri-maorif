-- Сабти тағйирот тағйирнашаванда: UPDATE ва DELETE манъ.
-- Истифода: npx prisma migrate dev --create-only --name audit_append_only
-- сипас ин матнро ба migration.sql-и нав гузоред ва npx prisma migrate dev иҷро кунед.

CREATE OR REPLACE FUNCTION audit_log_block_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog тағйирнашаванда аст: % манъ', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON "AuditLog";
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_changes();

DROP TRIGGER IF EXISTS audit_log_no_truncate ON "AuditLog";
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_block_changes();

-- Баҳо: агар ғоиб бошад, баҳо набояд бошад; баҳо 1–10.
ALTER TABLE "JournalEntry" DROP CONSTRAINT IF EXISTS journal_grade_range;
ALTER TABLE "JournalEntry" ADD CONSTRAINT journal_grade_range
  CHECK (grade IS NULL OR (grade BETWEEN 1 AND 10));

ALTER TABLE "JournalEntry" DROP CONSTRAINT IF EXISTS journal_absent_no_grade;
ALTER TABLE "JournalEntry" ADD CONSTRAINT journal_absent_no_grade
  CHECK (attendance = 'PRESENT' OR grade IS NULL);

ALTER TABLE "Quarter" DROP CONSTRAINT IF EXISTS quarter_number_range;
ALTER TABLE "Quarter" ADD CONSTRAINT quarter_number_range CHECK (number BETWEEN 1 AND 4);
