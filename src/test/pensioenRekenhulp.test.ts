import { it,expect } from 'vitest';
import { berekenJaarruimte as j,berekenPensioengat as g } from '../lib/pensioenRekenhulp';
it('60.000 geeft 12.248 en 1878 teruggave',()=>{const r=j({winst:60000,inleg:5000});expect(r.jaarruimte).toBe(12248);expect(r.teruggave).toBe(1878);});
it('max inkomen en Math.round',()=>expect(j({winst:200000}).jaarruimte).toBe(35588));
it('grondslag nooit negatief',()=>{for(const winst of [-10,0,10000])expect(j({winst}).grondslag).toBe(0);});
it('pensioenopbouw en reservering worden begrensd',()=>{expect(j({winst:60000,pensioen:99999}).jaarruimte).toBe(0);expect(j({winst:0,inleg:90000,reservering:90000}).aftrekbaar).toBe(42753);expect(j({winst:0,inleg:1}).nietAftrekbaar).toBe(true);});
it('tariefgrenzen',()=>{expect(j({winst:38883}).tarief).toBe(.3575);expect(j({winst:78426}).tarief).toBe(.3756);expect(j({winst:78427}).tarief).toBe(.495);});
it('pensioengat alleenstaand en samenwonend',()=>{expect(g({gewenst:3000,leeftijd:40}).gat).toBeCloseTo(1337.84);const r=g({gewenst:3000,samen:true,leeftijd:40});expect(r.gat).toBeCloseTo(1860.61);expect(r.pot).toBeCloseTo(r.gat*240);expect(r.inlegPerJaar).toBeCloseTo(r.pot/27);});
it('geen negatief gat en minstens een jaar',()=>{expect(g({gewenst:1000,opgebouwd:2000,leeftijd:80}).gat).toBe(0);expect(g({gewenst:3000,leeftijd:80}).jaren).toBe(1);});
