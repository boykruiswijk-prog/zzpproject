create or replace function public.get_exact_koppeling_fout()
returns text language sql stable security definer set search_path = public as $$
  select case when public.is_team_member(auth.uid()) then (select last_error from public.exact_config limit 1) else null end
$$;
revoke all on function public.get_exact_koppeling_fout() from public, anon;
grant execute on function public.get_exact_koppeling_fout() to authenticated;