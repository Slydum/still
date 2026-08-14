-- Phase 2 data architecture: split the legacy settings blob into independently
-- versioned account, Work, Money, and Health records.

alter table public.still_records
  drop constraint if exists still_records_record_type_check;

alter table public.still_records
  add constraint still_records_record_type_check check (
    record_type in (
      'task',
      'event',
      'journal_entry',
      'expense',
      'entity_link',
      'work_shift',
      'check_in',
      'settings',
      'work_settings',
      'money_settings',
      'health_settings'
    )
  );

comment on constraint still_records_record_type_check on public.still_records is
  'Allows permanent Still records plus independently versioned account, Work, Money, and Health settings.';
