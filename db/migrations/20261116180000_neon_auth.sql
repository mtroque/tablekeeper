-- Neon Auth (X4): point profiles, campaigns and play_sessions at neon_auth."user".
-- Fresh start: drop any pre-Neon-Auth rows before adding the foreign keys.

delete from public.play_sessions
where not exists (select 1 from neon_auth."user" u where u.id = user_id);

delete from public.campaigns
where not exists (select 1 from neon_auth."user" u where u.id = user_id);

delete from public.profiles
where not exists (select 1 from neon_auth."user" u where u.id = id);

alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id) references neon_auth."user" (id) on delete cascade;

alter table public.campaigns
  add constraint campaigns_user_id_fkey
  foreign key (user_id) references neon_auth."user" (id) on delete cascade;

alter table public.play_sessions
  add constraint play_sessions_user_id_fkey
  foreign key (user_id) references neon_auth."user" (id) on delete cascade;
