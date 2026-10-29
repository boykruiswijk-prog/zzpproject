import { expect, it } from 'vitest';
import { leadStatusFout } from '@/lib/leadStatusFout';
it('behoudt de echte onbekende serverfout', () => {
  expect(leadStatusFout({message:'De aanvraag heeft al een polis.'})).toBe('De aanvraag heeft al een polis.');
});
it('vertaalt technische toegangsweigering zonder een succes te claimen', () => {
  expect(leadStatusFout({message:'permission denied for table leads'})).toContain('geen toestemming');
});