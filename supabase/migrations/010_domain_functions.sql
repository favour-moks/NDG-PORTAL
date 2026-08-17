-- SQL mirror of src/lib/domain/names.ts normaliseName(). Keep these in sync —
-- unaccent + lower + strip punctuation to spaces + split + sort tokens + rejoin.
-- `stable` not `immutable`: unaccent depends on a dictionary configuration,
-- which the planner should not assume is fixed forever.
create or replace function normalise_name(input text) returns text
language sql stable as $$
  select coalesce(
    array_to_string(
      (
        select array_agg(token order by token)
        from unnest(
          regexp_split_to_array(
            regexp_replace(lower(unaccent(input)), '[^a-z0-9\s]', ' ', 'g'),
            '\s+'
          )
        ) as token
        where token <> ''
      ),
      ' '
    ),
    ''
  )
$$;

-- Identifier encryption/decryption for BVN/NIN. Called with the key as an
-- explicit parameter (PII_ENCRYPTION_KEY, held server-side in the Next.js
-- app, never in the database config) so the ciphertext never has to
-- round-trip through a JS PGP library. Only ever called from server-only
-- code with a direct Postgres connection (src/lib/import/*, identifier
-- reveal action) — never exposed to a client role.
create or replace function encrypt_identifier(plain text, key text) returns bytea
language sql stable as $$
  select pgp_sym_encrypt(plain, key, 'cipher-algo=aes256')
$$;

create or replace function decrypt_identifier(cipher bytea, key text) returns text
language sql stable as $$
  select pgp_sym_decrypt(cipher, key)
$$;
