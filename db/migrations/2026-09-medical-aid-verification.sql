-- Medical aid verification
-- ============================================================================
-- Run once against the live database. Every statement is idempotent, so
-- running it a second time is harmless.
--
-- What it does:
--   1. Adds 'pending_medical_aid' to the appointment_status enum.
--   2. Adds the three columns that record the practice's decision.
--
-- Run this BEFORE deploying the code that writes the new status: Postgres
-- requires an enum value to be committed before any row may use it.

-- 1. The new appointment status ---------------------------------------------
alter type appointment_status add value if not exists 'pending_medical_aid';

-- 2. The decision columns ----------------------------------------------------
alter table appointments
  add column if not exists medical_aid_decision       text,
  add column if not exists medical_aid_decision_at    timestamptz,
  add column if not exists medical_aid_decline_reason text;

-- Only the two real outcomes may be stored. A typo here would quietly change
-- which email a client receives, so the database refuses one.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'appointments_medical_aid_decision_check'
  ) then
    alter table appointments
      add constraint appointments_medical_aid_decision_check
      check (medical_aid_decision is null or medical_aid_decision in ('accepted', 'declined'));
  end if;
end $$;

-- Staff open this list every day; it should not scan the whole table.
create index if not exists appointments_pending_medical_aid_idx
  on appointments (start_at)
  where status = 'pending_medical_aid';
