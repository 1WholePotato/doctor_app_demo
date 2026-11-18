do $$
begin
  if not exists (select 1 from public.roles where name = 'student') then
    raise exception 'Student profile provisioning needs a role named exactly ''student''';
  end if;
end;
$$;

alter table public.users alter column sanc_num drop not null;

create function public.insert_student_profile(account auth.users)
returns void
language sql
set search_path = ''
as $$
  insert into public.users (
    id, role_id, email, first_name, last_name, birth_date, id_num, passport_num, cell_num, sanc_num
  )
  values (
    account.id,
    (select id from public.roles where name = 'student'),
    account.email,
    nullif(btrim(account.raw_user_meta_data ->> 'first_name'), ''),
    nullif(btrim(account.raw_user_meta_data ->> 'last_name'), ''),
    nullif(btrim(account.raw_user_meta_data ->> 'birth_date'), '')::date,
    nullif(btrim(account.raw_user_meta_data ->> 'id_num'), ''),
    nullif(btrim(account.raw_user_meta_data ->> 'passport_num'), ''),
    nullif(btrim(account.raw_user_meta_data ->> 'cell_num'), ''),
    nullif(btrim(account.raw_user_meta_data ->> 'sanc_num'), '')
  );
$$;

create function public.is_student_registration(metadata jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(metadata, '{}') ?| array['birth_date', 'cell_num', 'id_num', 'passport_num', 'sanc_num'];
$$;

create function public.provision_student_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_user_meta_data, '{}') ?| array['role', 'role_id'] then
    raise exception 'Accounts cannot choose their own role'
      using errcode = 'insufficient_privilege';
  end if;

  if public.is_student_registration(new.raw_user_meta_data) then
    perform public.insert_student_profile(new);
  end if;

  return new;
end;
$$;

revoke execute on function public.insert_student_profile(auth.users) from public, anon, authenticated;
revoke execute on function public.is_student_registration(jsonb) from public, anon, authenticated;
revoke execute on function public.provision_student_profile() from public, anon, authenticated;

create trigger provision_student_profile
  after insert on auth.users
  for each row execute function public.provision_student_profile();

revoke insert on table public.users from anon, authenticated;

do $$
declare
  account auth.users;
begin
  for account in
    select a.*
    from auth.users a
    where public.is_student_registration(a.raw_user_meta_data)
      and not exists (select 1 from public.users u where u.id = a.id)
  loop
    begin
      perform public.insert_student_profile(account);
      raise notice 'Provisioned student profile for auth user %', account.id;
    exception when others then
      raise warning 'Auth user % still has no profile: % (%)', account.id, sqlerrm, sqlstate;
    end;
  end loop;
end;
$$;
