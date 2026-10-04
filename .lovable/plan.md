# Plan: kritieke e-mailwachtrij en klantservice beveiligen

## Bevestigde uitgangssituatie

Read-only controle op 4 oktober 2026 bevestigt:

- De vier wachtrij-wrappers zijn `SECURITY DEFINER`, hebben geen vaste `search_path` en zijn uitvoerbaar door `anon` en `authenticated`.
- `email_queue_dispatch()` en `email_queue_wake()` hebben al `search_path = ''`, maar zijn eveneens uitvoerbaar door `anon` en `authenticated`.
- `is_admin(uuid)` heeft `search_path = public` en is uitvoerbaar door `anon`.
- `process-email-queue` en `auth-email-hook` maken intern een client met de serverrol; hun wachtrij-RPC's zijn dus compatibel met service-role-only rechten.
- `process-klant-service` accepteert nu een niet-ingelogde POST, gebruikt zelf de serverrol en vertrouwt polisnummer en e-mailadres uit de aanvraag. De bestaande `/mijn-zp/*` formulieren roepen deze functie rechtstreeks aan.

## 1. Databasefix in één transactionele migratie

Voorgestelde migratie-SQL:

```sql
begin;

-- Vaste, lege search_path. Alle niet-pg_catalog objecten in de bodies zijn al
-- volledig gekwalificeerd: pgmq.*, public.*, cron.*, net.* en vault.*.
alter function public.enqueue_email(text, jsonb)
  set search_path = '';
alter function public.read_email_batch(text, integer, integer)
  set search_path = '';
alter function public.delete_email(text, bigint)
  set search_path = '';
alter function public.move_to_dlq(text, text, bigint, jsonb)
  set search_path = '';
alter function public.email_queue_dispatch()
  set search_path = '';
alter function public.email_queue_wake()
  set search_path = '';
alter function public.is_admin(uuid)
  set search_path = '';

-- Wachtrijbeheer: geen publieke of gebruikerssessie-toegang.
revoke execute on function public.enqueue_email(text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.read_email_batch(text, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.delete_email(text, bigint)
  from public, anon, authenticated;
revoke execute on function public.move_to_dlq(text, text, bigint, jsonb)
  from public, anon, authenticated;
revoke execute on function public.email_queue_dispatch()
  from public, anon, authenticated;
revoke execute on function public.email_queue_wake()
  from public, anon, authenticated;

grant execute on function public.enqueue_email(text, jsonb) to service_role;
grant execute on function public.read_email_batch(text, integer, integer) to service_role;
grant execute on function public.delete_email(text, bigint) to service_role;
grant execute on function public.move_to_dlq(text, text, bigint, jsonb) to service_role;
grant execute on function public.email_queue_dispatch() to service_role;
grant execute on function public.email_queue_wake() to service_role;

-- Rollencontrole: ingelogde gebruikers en serverprocessen mogen deze gebruiken;
-- anonieme bezoekers niet.
revoke execute on function public.is_admin(uuid)
  from public, anon, authenticated;
grant execute on function public.is_admin(uuid)
  to authenticated, service_role;

commit;
```

De database-eigenaar en een eventueel platform-intern onderhoudsaccount blijven buiten de Data API bestaan; onder de applicatierollen krijgt alleen `service_role` toegang tot de zes wachtrijfuncties.

## 2. Controlequeries direct na de migratie

### Verwachte rechtenmatrix

```sql
with functies(signature, authenticated_expected) as (
  values
    ('public.enqueue_email(text,jsonb)', false),
    ('public.read_email_batch(text,integer,integer)', false),
    ('public.delete_email(text,bigint)', false),
    ('public.move_to_dlq(text,text,bigint,jsonb)', false),
    ('public.email_queue_dispatch()', false),
    ('public.email_queue_wake()', false),
    ('public.is_admin(uuid)', true)
), rollen(role_name) as (
  values ('anon'), ('authenticated'), ('service_role')
)
select
  f.signature,
  r.role_name,
  has_function_privilege(r.role_name, f.signature, 'EXECUTE') as has_execute,
  case
    when r.role_name = 'service_role' then true
    when r.role_name = 'authenticated' then f.authenticated_expected
    else false
  end as expected
from functies f
cross join rollen r
order by f.signature, r.role_name;
```

Acceptatie: `has_execute = expected` voor alle 21 regels. Daarmee is onder meer expliciet aangetoond dat `has_function_privilege('anon', ...) = false` voor alle zeven functies.

### SECURITY DEFINER en search_path

```sql
select
  p.oid::regprocedure::text as function_signature,
  p.prosecdef as security_definer,
  p.proconfig as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'enqueue_email', 'read_email_batch', 'delete_email', 'move_to_dlq',
    'email_queue_dispatch', 'email_queue_wake', 'is_admin'
  )
order by function_signature;
```

Acceptatie: elke regel heeft `security_definer = true` en `function_config` bevat `search_path=""`.

### Geen onverwachte applicatierollen

```sql
select
  p.oid::regprocedure::text as function_signature,
  coalesce(r.rolname, 'PUBLIC') as grantee,
  x.privilege_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(p.proacl) x
left join pg_roles r on r.oid = x.grantee
where n.nspname = 'public'
  and p.proname in (
    'enqueue_email', 'read_email_batch', 'delete_email', 'move_to_dlq',
    'email_queue_dispatch', 'email_queue_wake', 'is_admin'
  )
  and x.privilege_type = 'EXECUTE'
order by function_signature, grantee;
```

Acceptatie: geen `PUBLIC`/`anon`; `authenticated` uitsluitend bij `is_admin(uuid)`; `service_role` bij alle zeven. Database-eigenaar en platform-interne onderhoudsrollen worden apart als niet-Data-API rollen beoordeeld.

## 3. Regressiecontrole e-mailwachtrij zonder echte e-mail

- Voeg een database-smoketest toe die binnen één teruggedraaide transactie als `service_role` een aparte testqueue gebruikt en `enqueue_email`, `read_email_batch`, `move_to_dlq` en `delete_email` doorloopt. Geen productiewachtrij of bestaand bericht wordt geraakt.
- Voeg negatieve tests toe die als `anon` en `authenticated` alle zes wachtrijfuncties aanroepen en uitsluitend `permission denied` accepteren.
- Test `is_admin(uuid)` als anon (geweigerd), als ingelogde gebruiker (uitvoerbaar, correcte boolean) en als service role (uitvoerbaar).
- Laat regressietests van `auth-email-hook` en `process-email-queue` met gemockte mailverzending controleren dat hun service-role-clients de RPC's nog kunnen gebruiken. Roep de live dispatcher niet aan, zodat geen echte mail wordt verstuurd en geen bestaande queue wordt gewijzigd.
- Controleer daarna de database- en functielogs op uitsluitend de verwachte testresultaten, zonder payloads, tokens of links te loggen.

## 4. `process-klant-service`: portal-authenticatie en eigendomscontrole

Kies de veilige portalroute in plaats van alleen anti-spam; een rate limit voorkomt volume, maar bewijst niet dat een polis van de aanvrager is.

- Vereis een Bearer-token en valideer dit in de functie met `getClaims()`; ontbrekend/ongeldig token geeft `401`.
- Gebruik `claims.sub` als enige gebruikersidentiteit. Controleer server-side dat `policies.certificate_number = polisnummer` én `policies.user_id = claims.sub`; geen match geeft een generieke `403`, zonder te onthullen of het polisnummer bestaat.
- Neem het bestemmingsadres voor de bevestiging uit het geverifieerde account, niet uit de request-body. Sla `user_id = claims.sub` op. Een meegestuurd afwijkend e-mailadres wordt genegeerd of afgewezen.
- Pas ook `guardPublicSubmission` toe als extra laag, met een eigen limiet voor `klant-service`; voeg honeypot en invultijd toe aan de formulieren. Eigendomscontrole blijft leidend.
- Bescherm de bestaande `/mijn-zp/polis`, `/pauzeren`, `/documenten` en `/opzeggen` routes met de bestaande portal-login en stuur na inloggen terug naar de gekozen actie. Er komt geen publieke fallback die alleen naam/e-mail/polisnummer vergelijkt.
- Behoud bestaande validatie, interne meldingen, testmarkering en klantmailinhoud; wijzig alleen authenticatie, eigendom en misbruikbeperking.

## 5. Acceptatietests voor klantservice

- Zonder token, met anon-token en met verlopen token: `401`, geen aanvraag en geen mail.
- Geldige portalgebruiker met polis van een ander: `403`, geen aanvraag en geen mail.
- Geldige portalgebruiker met eigen polis: precies één aanvraag met correct `user_id`; in een gemockte/testomgeving precies de verwachte interne melding en bevestiging.
- Body met een ander e-mailadres: er kan nooit naar dat adres worden verzonden.
- Honeypot, te snelle inzending en overschreden IP-limiet: geweigerd vóór insert en mail.
- Controleer alle vier acties (`certificaat`, `pauzeren`, `documenten`, `opzeggen`), inclusief bestaande opzegvalidatie.

## Uitvoeringsvolgorde bij later akkoord

1. Database-migratie toepassen en direct de rechten- en `search_path`-queries uitvoeren.
2. Negatieve RPC-tests en teruggedraaide service-role-smoketest uitvoeren.
3. `process-klant-service` en de vier Mijn ZP-formulieren aanpassen en geautomatiseerd testen.
4. Aangepaste functie uitrollen; e-mailwachtrijfuncties alleen opnieuw uitrollen als hun code wijzigt.
5. Securityscan en linter draaien; bevinding pas sluiten als alle rechtenmatrixregels en klantservice-misbruiktests slagen.
6. Niet publiceren en geen echte e-mails versturen.
