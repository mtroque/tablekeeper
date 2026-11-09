-- Burst limit shared by every API instance (X2). Serverless instances can't share memory, so
-- express-rate-limit counts here. Keys are salted IP hashes, never raw IPs. Reached only by the
-- API's service role.

create table public.rate_limit_hits (
  key text primary key,
  hits integer not null,
  reset_at timestamptz not null
);

alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_hits from anon, authenticated;

-- Counts one hit for a key in a fixed window, starting a new window once the old one ended.
-- One statement, so concurrent requests on different instances can't lose a hit. About one
-- call in a hundred also removes windows that ended over an hour ago.
create function public.rate_limit_hit(p_key text, p_window_ms integer)
returns table (hits integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if random() < 0.01 then
    delete from public.rate_limit_hits r where r.reset_at < now() - interval '1 hour';
  end if;

  return query
  insert into public.rate_limit_hits as r (key, hits, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_ms / 1000.0))
  on conflict (key) do update
    set hits = case when r.reset_at <= now() then 1 else r.hits + 1 end,
        reset_at = case when r.reset_at <= now()
          then now() + make_interval(secs => p_window_ms / 1000.0)
          else r.reset_at end
  returning r.hits, r.reset_at;
end;
$$;

-- Takes back a hit (express-rate-limit's skipSuccessfulRequests and friends).
create function public.rate_limit_undo(p_key text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.rate_limit_hits set hits = greatest(hits - 1, 0) where key = p_key;
$$;

revoke all on function public.rate_limit_hit(text, integer) from public, anon, authenticated;
revoke all on function public.rate_limit_undo(text) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer) to service_role;
grant execute on function public.rate_limit_undo(text) to service_role;
grant all on public.rate_limit_hits to service_role;
