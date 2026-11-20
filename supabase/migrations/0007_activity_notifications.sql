create or replace function public.notify_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record; payload jsonb;
begin
  if new.publish_status <> 'published' then return new; end if;
  if tg_op = 'UPDATE' and old.publish_status = 'published' then return new; end if;
  -- Old activities (for example a bulk import) must not email everyone.
  if new.activity_date < current_date - 30 then return new; end if;

  payload := jsonb_build_object('title', new.title, 'summary', new.summary, 'slug', new.slug,
                                'activity_date', new.activity_date, 'location', new.location);

  for r in select full_name, lower(email) as email from members
            where status = 'active' and member_type = 'volunteer' and consent_contact
              and email is not null
              and (new.district_id is null or district_id = new.district_id) loop
    perform enqueue_notification('email', 'activity_announcement', r.email,
      payload || jsonb_build_object('name', r.full_name),
      'activity_announcement:' || new.id || ':' || r.email, false);
  end loop;
  return new;
end $$;

drop trigger if exists notify_activity on public.activities;
create trigger notify_activity after insert or update on public.activities
  for each row execute function public.notify_activity();

revoke execute on function public.notify_activity() from public, anon, authenticated;