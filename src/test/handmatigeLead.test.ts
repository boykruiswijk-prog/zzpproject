import { describe,it,expect } from 'vitest';
import { handmatigeLeadFout, handmatigeLeadGegevens, legeHandmatigeLead, aanvraagVoorinvulling } from '@/lib/handmatigeLead';
import { controleerLeadsOpbouw } from '../../supabase/functions/_shared/dashboardOpbouw';
import { bouwSchermPayload } from '../../supabase/functions/_shared/schermAnonimiseer';
const g={...legeHandmatigeLead,voornaam:'Boy',achternaam:'Test'};
describe('A19 regels',()=>{
 it('email of telefoon is voldoende, minimaal één verplicht',()=>{expect(handmatigeLeadFout(g)).toBeTruthy();expect(handmatigeLeadFout({...g,email:'test@zpzaken.nl'})).toBeNull();expect(handmatigeLeadFout({...g,telefoon:'+31612345678'})).toBeNull();});
 it('normaliseert telefoon en email vóór dubbelcheck',()=>{expect(handmatigeLeadGegevens({...g,email:' TEST@zpzaken.nl ',telefoon:'00316 12345678'})).toMatchObject({email:'test@zpzaken.nl',telefoon:'0612345678'});});
 it('sluit handmatig in leads opbouw maar niet aanvraagnoemer in',()=>{expect(()=>controleerLeadsOpbouw({totaal:38,aanvragen:22,contact:12,offerte:3,handmatig:1})).not.toThrow();expect(()=>controleerLeadsOpbouw({totaal:38,aanvragen:22,contact:12,offerte:3,handmatig:0})).toThrow();});
 it('scherm sluitcontrole faalt als handmatig niet aansluit',()=>{expect(()=>bouwSchermPayload({leads_opbouw:{totaal:38,aanvragen:22,contact:12,offerte:3,handmatig:0}})).toThrow();expect(bouwSchermPayload({leads_opbouw:{totaal:38,aanvragen:22,contact:12,offerte:3,handmatig:1}}).leads_opbouw?.handmatig).toBe(1);});
 it('voorinvulling houdt naam/contact/KvK, geen akkoord of betaalgegevens',()=>{const r=aanvraagVoorinvulling({...g,email:'test@zpzaken.nl',kvk_nummer:'92654193'});expect(r).toMatchObject({voornaam:'Boy',email:'test@zpzaken.nl',kvkNummer:'92654193'});expect(r).not.toHaveProperty('iban');expect(r).not.toHaveProperty('sepa_akkoord');});
});