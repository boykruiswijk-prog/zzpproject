// @vitest-environment happy-dom
import { beforeEach,it,expect,vi } from 'vitest';
import { cleanup,render,screen,fireEvent,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { HandmatigeLeadToevoegen } from '@/components/admin/HandmatigeLeadToevoegen';
import { LeadKlantKoppeling } from '@/components/admin/LeadKlantKoppeling';
const m=vi.hoisted(()=>({rpc:vi.fn(),invoke:vi.fn(),search:vi.fn()}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({isTeamMember:true,isSupervisorOrAdmin:true,user:{email:'boy.kruiswijk@zpzaken.nl'}})}));
vi.mock('@/hooks/useToonTestrecords',()=>({useToonTestrecords:()=>({toonTest:true,magSchakelen:true})}));
vi.mock('@/components/admin/UniverseleZoeker',()=>({zoekUniverseel:m.search}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc:m.rpc,functions:{invoke:m.invoke},from:()=>{const q:any={select:()=>q,eq:()=>q,then:(r:any)=>Promise.resolve({data:[],error:null}).then(r)};return q}}}));
function mount(c:React.ReactNode){render(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>{c}</QueryClientProvider></MemoryRouter>);}
beforeEach(()=>{cleanup();m.rpc.mockReset();m.invoke.mockReset();m.search.mockReset();});
it('dubbelcheck vereist expliciete toch-nieuw en stuurt geen klantmail',async()=>{
 m.rpc.mockImplementation(async(f:string)=>f==='handmatige_lead_dubbelcheck'?{data:[{id:'oud',titel:'Bestaande persoon',link:'/admin/leads/oud',bron:'leads'}],error:null}:{data:{id:'nieuw'},error:null});
 mount(<HandmatigeLeadToevoegen/>);fireEvent.click(screen.getByRole('button',{name:'Lead toevoegen'}));
 for(const [label,value] of [['Voornaam','Test'],['Achternaam','A19'],['E-mail','a19@zpzaken.nl']])fireEvent.change(screen.getByLabelText(label),{target:{value}});
 fireEvent.click(screen.getByRole('button',{name:'Opslaan'}));await screen.findByText('Bestaande persoon · leads');
 expect(m.rpc.mock.calls.map(c=>c[0])).toEqual(['handmatige_lead_dubbelcheck']);
 fireEvent.click(screen.getByRole('button',{name:'Toch nieuwe lead toevoegen'}));await waitFor(()=>expect(m.rpc).toHaveBeenCalledWith('handmatige_lead_toevoegen',expect.objectContaining({_toch_nieuw:true,_is_test:false})));
 expect(m.invoke).not.toHaveBeenCalled();
});
it('koppelen zoekt universeel en vereist kiezen plus bevestigen',async()=>{
 m.search.mockResolvedValue({klanten:[{id:'klant-1',onderneming_id:'klant-1',titel:'TEST klant',kvk:'92654193'}]});m.rpc.mockResolvedValue({data:{onderneming_id:'klant-1'},error:null});
 mount(<LeadKlantKoppeling lead={{id:'lead-1',voornaam:'Test',email:'a19@zpzaken.nl',is_test:true}}/>);
 fireEvent.click(screen.getByRole('button',{name:'Koppel aan klant'}));fireEvent.change(screen.getByLabelText('Zoek een klantkaart'),{target:{value:'TEST klant'}});
 fireEvent.click(await screen.findByRole('button',{name:'TEST klant · KvK 92654193'}));expect(m.rpc).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Koppeling bevestigen'}));await waitFor(()=>expect(m.rpc).toHaveBeenCalledWith('lead_klant_koppelen',expect.objectContaining({_bron_tabel:'leads',_bron_id:'lead-1',_onderneming_id:'klant-1'})));expect(m.invoke).not.toHaveBeenCalled();
});
