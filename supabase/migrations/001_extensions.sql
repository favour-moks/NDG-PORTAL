-- Must be the first migration: later migrations depend on these.
create extension if not exists pg_trgm;
create extension if not exists unaccent;
create extension if not exists pgcrypto;
