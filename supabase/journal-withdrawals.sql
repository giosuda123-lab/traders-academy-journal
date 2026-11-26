-- Trade Journal: per-user cash withdrawals, separate from trading performance.
-- Run in Supabase SQL Editor before deploying journal UI.
create table if not exists public.journal_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null check(length(account_id) between 1 and 100),
  withdrawal_date date not null,
  amount_usd numeric(16,2) not null check(amount_usd>0),
  note text not null default '' check(length(note)<=500),
  created_at timestamptz not null default now()
);
create index if not exists journal_withdrawals_user_date on public.journal_withdrawals(user_id,withdrawal_date desc);
alter table public.journal_withdrawals enable row level security;
revoke all on public.journal_withdrawals from anon,authenticated;
grant select,insert,update,delete on public.journal_withdrawals to authenticated;
drop policy if exists "Read own withdrawals" on public.journal_withdrawals;
create policy "Read own withdrawals" on public.journal_withdrawals for select to authenticated
 using (user_id=(select auth.uid()));
drop policy if exists "Add own withdrawals" on public.journal_withdrawals;
create policy "Add own withdrawals" on public.journal_withdrawals for insert to authenticated
 with check (user_id=(select auth.uid()));
drop policy if exists "Update own withdrawals" on public.journal_withdrawals;
create policy "Update own withdrawals" on public.journal_withdrawals for update to authenticated
 using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists "Delete own withdrawals" on public.journal_withdrawals;
create policy "Delete own withdrawals" on public.journal_withdrawals for delete to authenticated
 using (user_id=(select auth.uid()));
