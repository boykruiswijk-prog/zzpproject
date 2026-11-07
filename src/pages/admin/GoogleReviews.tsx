import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter } from '@/components/ui/dialog';
import { Select,SelectTrigger,SelectContent,SelectItem,SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus,Pencil,ExternalLink,History } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { BeheerReview } from '@/lib/googleReviews';

const empty={naam:'',sterren:5,tekst:'',review_datum:'',google_url:'',verborgen:false,reden:''};
export default function AdminGoogleReviews() {
  const [rows,setRows]=useState<BeheerReview[]>([]),[loading,setLoading]=useState(true),[failure,setFailure]=useState('');
  const [open,setOpen]=useState(false),[editing,setEditing]=useState<string|null>(null),[form,setForm]=useState(empty),[saving,setSaving]=useState(false);
  const [history,setHistory]=useState<Array<{actie:string;reden:string;op:string}>>([]),[historyOpen,setHistoryOpen]=useState(false);
  const cache=useQueryClient();
  async function load() {
    setLoading(true);
    const {data,error}=await supabase.from('google_reviews').select('id,naam,sterren,tekst,review_datum,google_url,verborgen').order('review_datum',{ascending:false,nullsFirst:false}).order('aangemaakt_op',{ascending:false});
    setFailure(error?.message ?? ''); setRows(data ?? []);setLoading(false);
  }
  useEffect(()=>{void load();},[]);
  function edit(row?:BeheerReview) { setEditing(row?.id ?? null);setForm(row?{...empty,...row,review_datum:row.review_datum ?? '',verborgen:row.verborgen ?? false,reden:''}:{...empty});setOpen(true); }
  async function save(e:React.FormEvent) {
    e.preventDefault();setSaving(true);
    const {error}=await supabase.rpc('google_reviews_bewaren',{_id:editing,_naam:form.naam,_sterren:form.sterren,_tekst:form.tekst,_datum:form.review_datum,_url:form.google_url,_verborgen:form.verborgen,_reden:form.reden});
    setSaving(false);
    if(error) return toast({title:'Opslaan mislukt',description:error.message,variant:'destructive'});
    setOpen(false);void cache.invalidateQueries({queryKey:['google-reviews-publiek']});await load();
  }
  async function audit(id:string) {
    const {data,error}=await supabase.from('google_reviews_audit').select('actie,reden,op').eq('review_id',id).order('op',{ascending:false});
    if(error) return toast({title:'Historie niet beschikbaar',description:error.message,variant:'destructive'});
    setHistory(data ?? []);setHistoryOpen(true);
  }
  return <AdminLayout><div className="flex flex-wrap items-center justify-between gap-4 mb-6"><h1 className="text-2xl font-bold">Google-reviews</h1><Button onClick={()=>edit()}><Plus className="h-4 w-4 mr-2"/>Review toevoegen</Button></div>
    {failure?<p role="alert" className="text-destructive">{failure}</p>:loading?<p>Laden...</p>:!rows.length?<p className="text-muted-foreground">Geen reviews.</p>:<div className="space-y-3">{rows.map(row=><article key={row.id} className="rounded-lg border bg-card p-4"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold text-base">{row.naam}</h2><p className="text-sm text-muted-foreground">{row.sterren} van 5 sterren · {row.review_datum ?? 'Datum nog controleren'} · {row.verborgen?'Verborgen':'Zichtbaar'}</p></div><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={`Bewerk ${row.naam}`} title="Bewerken" onClick={()=>edit(row)}><Pencil className="h-4 w-4"/></Button><Button variant="ghost" size="icon" aria-label={`Historie ${row.naam}`} title="Historie" onClick={()=>audit(row.id)}><History className="h-4 w-4"/></Button></div></div><p className="whitespace-pre-wrap break-words my-3 text-sm">{row.tekst}</p><a className="text-accent text-sm inline-flex gap-2 items-center" href={row.google_url} target="_blank" rel="noopener noreferrer">Op Google <ExternalLink className="h-3 w-3"/></a></article>)}</div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{editing?'Review bewerken':'Review toevoegen'}</DialogTitle></DialogHeader><form onSubmit={save} className="space-y-4">
    <div><Label htmlFor="review-naam">Naam zoals op Google</Label><Input id="review-naam" required maxLength={200} value={form.naam} onChange={e=>setForm({...form,naam:e.target.value})}/></div>
    <div><Label>Sterren</Label><Select value={String(form.sterren)} onValueChange={v=>setForm({...form,sterren:Number(v)})}><SelectTrigger aria-label="Sterren"><SelectValue/></SelectTrigger><SelectContent>{[1,2,3,4,5].map(n=><SelectItem key={n} value={String(n)}>{n} van 5</SelectItem>)}</SelectContent></Select></div>
    <div><Label htmlFor="review-tekst">Tekst</Label><Textarea id="review-tekst" required maxLength={10000} value={form.tekst} onChange={e=>setForm({...form,tekst:e.target.value})}/></div>
    <div><Label htmlFor="review-datum">Datum op Google</Label><Input id="review-datum" type="date" required value={form.review_datum} onChange={e=>setForm({...form,review_datum:e.target.value})}/></div>
    <div><Label htmlFor="review-url">Link naar review of Google-profiel</Label><Input id="review-url" type="url" required value={form.google_url} onChange={e=>setForm({...form,google_url:e.target.value})}/></div>
    <div className="flex gap-2 items-center"><Checkbox id="review-verborgen" checked={form.verborgen} onCheckedChange={v=>setForm({...form,verborgen:v===true})}/><Label htmlFor="review-verborgen">Verbergen</Label></div>
    <div><Label htmlFor="review-reden">Reden van deze wijziging</Label><Textarea id="review-reden" required minLength={3} maxLength={500} value={form.reden} onChange={e=>setForm({...form,reden:e.target.value})}/></div>
    <DialogFooter><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Annuleren</Button><Button type="submit" disabled={saving}>{saving?'Opslaan...':'Opslaan'}</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}><DialogContent><DialogHeader><DialogTitle>Reviewhistorie</DialogTitle></DialogHeader><div className="max-h-96 overflow-y-auto space-y-3">{history.map((h,i)=><div key={i} className="border-b pb-3"><p className="text-sm font-medium">{h.actie} · {new Date(h.op).toLocaleString('nl-NL')}</p><p className="text-sm break-words">{h.reden}</p></div>)}</div></DialogContent></Dialog>
  </AdminLayout>;
}