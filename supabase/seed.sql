-- Local email/password test users (never real Google sign-in in tests).
-- Password for all of them: tablekeeper-e2e (also in scripts/lib/test-users.mjs).
-- The on_auth_user_created trigger creates their profiles.

with users (id, email, name) as (
  values
    ('00000000-0000-4000-8000-000000000001'::uuid, 'e2e@local', 'E2E Player'),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'e2e-patchwork@local', 'Patchwork Player'),
    ('00000000-0000-4000-8000-000000000003'::uuid, 'e2e-azul@local', 'Azul Player'),
    ('00000000-0000-4000-8000-000000000004'::uuid, 'e2e-harmonies@local', 'Harmonies Player'),
    ('00000000-0000-4000-8000-000000000005'::uuid, 'e2e-dorfromantik@local', 'Dorfromantik Player')
),
inserted as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  select
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
    extensions.crypt('tablekeeper-e2e', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('full_name', name), now(), now(), '', '', '', ''
  from users
  returning id, email
)
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from inserted;
