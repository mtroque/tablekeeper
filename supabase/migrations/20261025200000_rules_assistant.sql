-- Rules assistant (S3): quota accounting, rulebook search and rulebook loading.
-- Every function is reached only by the API's service role (and the ingest script), so each
-- step that must be atomic is one statement or one transaction.

-- ---------- llm_usage ----------

-- Counts one request against the global budget and the subject's daily quota, but only while
-- both are under their limits. Returns null when it was counted, else 'global' or 'subject'.
create function public.llm_consume_request(
  p_subject_type text,
  p_subject_key text,
  p_subject_limit integer,
  p_global_requests integer,
  p_global_tokens bigint
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'utc')::date;
  counted integer;
begin
  insert into public.llm_usage as u (subject_type, subject_key, day, requests)
  values ('global', 'global', today, 1)
  on conflict (subject_type, subject_key, day) do update
    set requests = u.requests + 1
    where u.requests < p_global_requests and u.input_tokens + u.output_tokens < p_global_tokens
  returning u.requests into counted;
  if counted is null then
    return 'global';
  end if;

  insert into public.llm_usage as u (subject_type, subject_key, day, requests)
  values (p_subject_type, p_subject_key, today, 1)
  on conflict (subject_type, subject_key, day) do update
    set requests = u.requests + 1
    where u.requests < p_subject_limit
  returning u.requests into counted;
  if counted is null then
    -- Give the global request back; the subject's quota stopped it.
    update public.llm_usage set requests = requests - 1
    where subject_type = 'global' and subject_key = 'global' and day = today;
    return 'subject';
  end if;
  return null;
end;
$$;

-- Adds a model call's tokens to the subject's and the global rows for today.
create function public.llm_record_tokens(
  p_subject_type text,
  p_subject_key text,
  p_input bigint,
  p_output bigint
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.llm_usage as u (subject_type, subject_key, day, input_tokens, output_tokens)
  values
    (p_subject_type, p_subject_key, (now() at time zone 'utc')::date, p_input, p_output),
    ('global', 'global', (now() at time zone 'utc')::date, p_input, p_output)
  on conflict (subject_type, subject_key, day) do update
    set input_tokens = u.input_tokens + excluded.input_tokens,
        output_tokens = u.output_tokens + excluded.output_tokens;
$$;

-- ---------- rulebooks ----------

-- Full-text search within one rulebook, best first.
create function public.search_rulebook_sections(
  p_rulebook_id uuid,
  p_query text,
  p_limit integer default 5
) returns table (
  id uuid,
  number text,
  title text,
  printed_pages text,
  pdf_page_start integer,
  pdf_page_end integer,
  snippet text,
  rank real
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.number, s.title, s.printed_pages, s.pdf_page_start, s.pdf_page_end,
    pg_catalog.ts_headline('english', s.body, q,
      'MaxFragments=2, MaxWords=30, MinWords=10, StartSel="", StopSel=""') as snippet,
    pg_catalog.ts_rank(s.search, q) as rank
  from public.rulebook_sections s,
    pg_catalog.websearch_to_tsquery('english', p_query) q
  where s.rulebook_id = p_rulebook_id and s.search @@ q
  order by rank desc, s.ordinal
  limit p_limit;
$$;

-- Upserts a game's rulebook and replaces all of its sections, in one transaction.
-- p_rulebook: { game_id, edition, title, publisher_url, source_version }
-- p_sections: [{ key, parent_key, ordinal, number, title, pdf_page_start, pdf_page_end,
--               printed_pages, body }], parents before their children.
create function public.replace_rulebook(p_rulebook jsonb, p_sections jsonb) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  book_id uuid;
  section jsonb;
  new_id uuid;
  ids jsonb := '{}'::jsonb;
begin
  insert into public.rulebooks as r (game_id, edition, title, publisher_url, source_version)
  values (
    p_rulebook ->> 'game_id', p_rulebook ->> 'edition', p_rulebook ->> 'title',
    p_rulebook ->> 'publisher_url', p_rulebook ->> 'source_version'
  )
  on conflict (game_id) do update
    set edition = excluded.edition, title = excluded.title,
        publisher_url = excluded.publisher_url, source_version = excluded.source_version
  returning r.id into book_id;

  delete from public.rulebook_sections where rulebook_id = book_id;

  for section in select value from jsonb_array_elements(p_sections) loop
    insert into public.rulebook_sections (
      rulebook_id, ordinal, number, title, parent_id, pdf_page_start, pdf_page_end,
      printed_pages, body
    ) values (
      book_id,
      (section ->> 'ordinal')::integer,
      section ->> 'number',
      section ->> 'title',
      (ids ->> (section ->> 'parent_key'))::uuid,
      (section ->> 'pdf_page_start')::integer,
      (section ->> 'pdf_page_end')::integer,
      section ->> 'printed_pages',
      section ->> 'body'
    ) returning id into new_id;
    ids := ids || jsonb_build_object(section ->> 'key', new_id);
  end loop;
  return book_id;
end;
$$;

revoke all on function public.llm_consume_request(text, text, integer, integer, bigint) from public, anon, authenticated;
revoke all on function public.llm_record_tokens(text, text, bigint, bigint) from public, anon, authenticated;
revoke all on function public.search_rulebook_sections(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.replace_rulebook(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.llm_consume_request(text, text, integer, integer, bigint) to service_role;
grant execute on function public.llm_record_tokens(text, text, bigint, bigint) to service_role;
grant execute on function public.search_rulebook_sections(uuid, text, integer) to service_role;
grant execute on function public.replace_rulebook(jsonb, jsonb) to service_role;
