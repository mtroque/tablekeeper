-- Gives back one consumed request for today (UTC) on both the global and subject rows when
-- an ask fails on our side. Locks global first to match llm_consume_request (D-034), and
-- never lets a count go below zero.
create function public.llm_refund_request(
  p_subject_type text,
  p_subject_key text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'utc')::date;
begin
  update public.llm_usage
  set requests = greatest(0, requests - 1)
  where subject_type = 'global' and subject_key = 'global' and day = today;

  if p_subject_type <> 'global' then
    update public.llm_usage
    set requests = greatest(0, requests - 1)
    where subject_type = p_subject_type and subject_key = p_subject_key and day = today;
  end if;
end;
$$;

revoke all on function public.llm_refund_request(text, text) from public, app_user;
