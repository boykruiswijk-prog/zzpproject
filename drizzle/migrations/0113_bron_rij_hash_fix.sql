CREATE OR REPLACE FUNCTION public.bron_rij_voor_lead(_id uuid) RETURNS bigint LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE h bigint := 0; s text := replace(_id::text,'-',''); i int;
BEGIN
  FOR i IN 1..length(s) LOOP
    h := (((h * 31 + ascii(substr(s,i,1))) % 4294967296) + 4294967296) % 4294967296;
    IF h >= 2147483648 THEN h := h - 4294967296; END IF;
  END LOOP;
  RETURN (abs(h) % 2000000000) + 100000;
END $$;