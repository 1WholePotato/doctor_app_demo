create function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users
  set email = new.email
  where id = new.id
    and email is distinct from new.email;
  return new;
end;
$$;

revoke execute on function public.sync_profile_email() from public, anon, authenticated;

create trigger sync_profile_email
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();

revoke update on table public.users from anon, authenticated;
grant update (
  id, role_id, first_name, last_name, birth_date, id_num, passport_num, cell_num, sanc_num, active, created_at
) on table public.users to anon, authenticated;

do $$
declare
  drifted record;
begin
  for drifted in
    select u.id, a.email as auth_email
    from public.users u
    join auth.users a on a.id = u.id
    where a.email is not null
      and u.email is distinct from a.email
  loop
    begin
      update public.users set email = drifted.auth_email where id = drifted.id;
      raise notice 'Profile % email now matches its Auth email', drifted.id;
    exception when others then
      raise warning 'Profile % still differs from its Auth email: % (%)', drifted.id, sqlerrm, sqlstate;
    end;
  end loop;
end;
$$;
