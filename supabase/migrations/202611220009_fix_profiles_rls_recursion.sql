-- Fix login/profile load: profiles RLS called current_tenant_id() which
-- selected profiles again under RLS -> infinite recursion / stack depth exceeded.

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

revoke all on function public.current_tenant_id() from public;
grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.current_tenant_id() to service_role;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or tenant_id = public.current_tenant_id()
  );
