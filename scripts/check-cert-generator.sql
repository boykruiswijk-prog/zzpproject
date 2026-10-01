-- Test nummergenerator (alleen lezen). Draai als service_role.
-- Verwacht: bezet nummer (ZPBAV5092, gedeeld) schuift door naar eerstvolgend vrij nummer > 5092;
-- vrij nummer 5170 blijft 5170.
set role service_role;
select
  public.eerste_vrije_certificaatnummer(5092) > 5092 as bezet_schuift_door,
  public.eerste_vrije_certificaatnummer(5170) = 5170 as vrij_blijft,
  not exists (select 1 from public.klant_certificaten where certificaatnummer = 'ZPBAV' || public.eerste_vrije_certificaatnummer(5092)) as resultaat_is_vrij;
