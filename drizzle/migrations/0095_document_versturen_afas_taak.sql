ALTER TABLE public.crm_taken DROP CONSTRAINT crm_taken_soort_check;
ALTER TABLE public.crm_taken ADD CONSTRAINT crm_taken_soort_check CHECK (soort = ANY (ARRAY['exact_aanpassen','nieuwe_aanvraag_nodig','afas_factuur_opvragen']));
ALTER TABLE public.interne_melding_ontvangers DROP CONSTRAINT interne_melding_ontvangers_soort_check;
ALTER TABLE public.interne_melding_ontvangers ADD CONSTRAINT interne_melding_ontvangers_soort_check CHECK (soort = ANY (ARRAY['algemeen','exact_boeking','bav_override','afas_factuur']));