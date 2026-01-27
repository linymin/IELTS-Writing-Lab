-- Fix RLS policies and ensure user synchronization

-- 1. Add INSERT policies for evaluations and attempts
create policy "Users can insert own evaluations" on public.evaluations for insert with check (
  exists (select 1 from public.essays where essays.id = evaluations.essay_id and essays.user_id = auth.uid())
);

create policy "Users can insert own attempts" on public.attempts for insert with check (
  exists (select 1 from public.essays where essays.id = attempts.essay_id and essays.user_id = auth.uid())
);

-- 2. Create a trigger to automatically create a public.users entry when a new user signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists to avoid errors on multiple runs
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. (Optional) Backfill existing users if any
insert into public.users (id, email)
select id, email from auth.users
on conflict (id) do nothing;
