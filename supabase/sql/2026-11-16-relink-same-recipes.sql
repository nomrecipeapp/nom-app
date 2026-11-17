-- Re-link recipes that are the same recipe saved from slightly different links.
-- Run in the Supabase SQL Editor. STEP 1 only looks; STEP 2 changes data.
--
-- Why: Nom treats two saves as "the same recipe" when they share a canonical_id.
-- Until now that id was only shared when the links matched exactly, so
--   https://www.site.com/chili/?utm_source=pinterest  and  https://site.com/chili
-- got different ids, and "friends have this" never showed. The app now ignores
-- those differences for new saves (src/recipeLink.js). This catches up old ones.

-- A link boiled down to what matters. Mirrors recipeLinkKey() in src/recipeLink.js.
create or replace function public.nom_link_key(u text) returns text
language sql immutable as $$
  with parts as (
    select
      regexp_replace(lower(split_part(split_part(regexp_replace(btrim(u), '^[a-zA-Z]+://', ''), '#', 1), '?', 1)),
        '^(www[0-9]?|m|mobile|amp)\.', '') as hostpath,
      split_part(split_part(btrim(u), '#', 1), '?', 2) as query
  ),
  cleaned as (
    select
      regexp_replace(regexp_replace(regexp_replace(hostpath, '/index\.html?$', ''), '/amp/?$', ''), '/+$', '') as hp,
      query
    from parts
  )
  select case
    when u is null or btrim(u) = '' then null
    when u ~* 'nytimes\.com/recipes/[0-9]+'
      then 'cooking.nytimes.com/recipes/' || substring(u from '(?i)nytimes\.com/recipes/([0-9]+)')
    when u ~* '^([a-z]+://)?(www\.)?(delish|goodhousekeeping|countryliving|womansday|thepioneerwoman|esquire|prevention|womenshealthmag|menshealth)\.com/.*/a[0-9]{4,}/'
      then lower(substring(u from '(?i)^(?:[a-z]+://)?(?:www\.)?([a-z]+\.com)/')) || '/' || lower(substring(u from '(?i)/(a[0-9]{4,})/'))
    when u ~* 'instagram\.com/(p|reels?|tv)/'
      then 'instagram.com/p/' || substring(u from '(?i)instagram\.com/(?:p|reels?|tv)/([^/?#]+)')
    when u ~* 'tiktok\.com/.*/video/[0-9]+'
      then 'tiktok.com/video/' || substring(u from '/video/([0-9]+)')
    when u ~* 'youtu\.be/'
      then 'youtube.com/watch/' || substring(u from '(?i)youtu\.be/([^/?#]+)')
    when u ~* 'youtube\.com/' and u ~ '[?&]v='
      then 'youtube.com/watch/' || substring(u from '[?&]v=([^&#]+)')
    when u ~* 'youtube\.com/shorts/'
      then 'youtube.com/watch/' || substring(u from '/shorts/([^/?#]+)')
    else (
      select c.hp || coalesce('?' || (
        select string_agg(k || '=' || lower(v), '&' order by k || '=' || lower(v))
        from (
          select lower(m[1]) as k, m[2] as v
          from regexp_matches(c.query, '(?:^|&)([^=&]+)=([^&]+)', 'g') as m
        ) params
        where k !~ '^(utm_.*|mc_.*|_ga|_gl|fbclid|gclid|dclid|msclkid|yclid|igsh|igshid|smid|unlocked_article_code|ref|ref_src|ref_url|referrer|si|share|share_id|sharetype|cmp|cmpid|campaign|epik|via|s_cid|cid|src|source|from|amp|ito|mbid|xtor)$'
      ), '')
      from cleaned c
    )
  end
$$;


-- ============================================================
-- STEP 1: Look first. Each row is a recipe saved under more than one canonical_id.
-- ============================================================
select public.nom_link_key(source_url) as link,
       count(*) as saves,
       count(distinct canonical_id) as different_ids,
       array_agg(distinct source_url) as links_as_saved
from public.recipes
where source_url is not null and btrim(source_url) <> ''
group by 1
having count(distinct coalesce(canonical_id::text, 'none')) > 1
order by saves desc;


-- ============================================================
-- STEP 2: Re-link. Every save of the same recipe gets the oldest save's canonical_id.
-- Only run after STEP 1 looks right. Select from "begin" to "commit" and Run.
-- ============================================================
begin;

with keyed as (
  select id, canonical_id, created_at, public.nom_link_key(source_url) as k
  from public.recipes
  where source_url is not null and btrim(source_url) <> ''
),
groups as materialized (
  select k,
         coalesce((array_agg(canonical_id order by created_at) filter (where canonical_id is not null))[1], gen_random_uuid()) as keep_id
  from keyed
  where k is not null
  group by k
  having count(distinct coalesce(canonical_id::text, 'none')) > 1
)
update public.recipes r
set canonical_id = g.keep_id
from keyed
join groups g using (k)
where r.id = keyed.id
  and r.canonical_id is distinct from g.keep_id;

commit;
