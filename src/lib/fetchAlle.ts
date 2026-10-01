// Haalt alle rijen op in blokken van 1000 (de backend levert per verzoek maximaal 1000 rijen).
export async function fetchAlle<T = any>(
  maakQuery: (van: number, tot: number) => PromiseLike<{ data: any[] | null; error: any }>,
  blok = 1000,
): Promise<{ data: T[]; error: any }> {
  const alles: T[] = [];
  for (let van = 0; ; van += blok) {
    const { data, error } = await maakQuery(van, van + blok - 1);
    if (error) return { data: alles, error };
    alles.push(...((data ?? []) as T[]));
    if (!data || data.length < blok) break;
  }
  return { data: alles, error: null };
}
