-- Seeded local test users and profiles (docs/CONVENTIONS.md → Testing, scripts/lib/test-users.mjs).
insert into neon_auth."user" (id, email, name)
values
  ('00000000-0000-4000-8000-000000000001'::uuid, 'e2e@local', 'E2E Player'),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'e2e-patchwork@local', 'Patchwork Player'),
  ('00000000-0000-4000-8000-000000000003'::uuid, 'e2e-azul@local', 'Azul Player'),
  ('00000000-0000-4000-8000-000000000004'::uuid, 'e2e-harmonies@local', 'Harmonies Player'),
  ('00000000-0000-4000-8000-000000000005'::uuid, 'e2e-dorfromantik@local', 'Dorfromantik Player')
on conflict (id) do update
  set email = excluded.email,
      name = excluded.name;

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000000001'::uuid, 'E2E Player'),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'Patchwork Player'),
  ('00000000-0000-4000-8000-000000000003'::uuid, 'Azul Player'),
  ('00000000-0000-4000-8000-000000000004'::uuid, 'Harmonies Player'),
  ('00000000-0000-4000-8000-000000000005'::uuid, 'Dorfromantik Player')
on conflict (id) do update
  set display_name = excluded.display_name;
