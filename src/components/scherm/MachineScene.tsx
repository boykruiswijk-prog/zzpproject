import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { schermDpr, useSchermViewport } from './schermWeergave';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, Lightformer, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import asset from '@/assets/scherm/agent.glb.asset.json';
import { STATION_LABELS, toestandLabel, type Puls, type StationStand, type Toestand } from './schermModel';
export { STATION_LABELS, STATION_IDS } from './schermModel';
export type { Puls } from './schermModel';
const Effects = lazy(() => import('./SchermEffects'));
/** Als het figuurmodel niet laadt, staan er eenvoudige poppetjes; de rest van het scherm blijft zichtbaar. */
class FiguurVangnet extends Component<{ children: ReactNode; terugval: ReactNode }, { fout: boolean }> {
  state = { fout: false };
  static getDerivedStateFromError() { return { fout: true }; }
  render() { return this.state.fout ? this.props.terugval : this.props.children; }
}
function palette() {
  const el = document.querySelector('.scherm');
  const css = el ? getComputedStyle(el) : null;
  const read = (key: string) => new THREE.Color(`hsl(${css?.getPropertyValue(key).trim().replace(/ /g, ',') || '0,0%,50%'})`);
  return { bg: read('--s-bg'), floor: read('--s-surface'), desk: read('--s-lijn'), figure: read('--s-tekst'), dim: read('--s-dim'), red: read('--s-rood'), blue: read('--s-blauw'), green: read('--s-groen'), orange: read('--s-oranje') };
}
type Colors = ReturnType<typeof palette>;
export type WerktuinRobot = { robotnaam: string | null; naam: string; status: string; werkplek: string | null; nu_tekst: string | null; resultaat?: string | null };
type Props = { stations: Record<string, StationStand>; totaalVandaag: number; kennisregels: number; pulsen: Puls[]; focus: Puls | null; actief: boolean; robots?: WerktuinRobot[] };

/** A8-correctie: vaste plek per poppetje op de vloer [x, z]; kolommen 4,8 breed, rijen 5,5 diep. Brein in het midden. */
export const POPPETJE_PLEK: Record<string, [number, number]> = {
  Echo: [-9.8, -12.6], Lasso: [-4.9, -12.6], Turbo: [4.9, -12.6], Loep: [9.8, -12.6],
  Pen: [-9.8, -5.4], Teller: [-4.9, -5.4], Kompas: [4.9, -5.4],
  Slot: [-9.8, 1.8], Patch: [-4.9, 1.8], Coach: [0, 1.8], Radar: [4.9, 1.8], Scout: [9.8, 1.8],
  Pixel: [-9.8, 9.0], Puls: [-4.9, 9.0], Spoor: [4.9, 9.0], Baken: [9.8, 9.0],
};
/** Afdelingslabel boven de eerste robot van elke groep. */
export const AFDELING_TAG: Record<string, { titel: string; robot: string; station?: string }> = {
  intake: { titel: 'Aanvraag-intake', robot: 'Echo', station: 'intake' },
  kennisbank: { titel: 'Kennisbank en content', robot: 'Pen', station: 'kennisbank' },
  ads: { titel: 'Ads-monitor', robot: 'Turbo', station: 'ads' },
  kwaliteit: { titel: 'Kwaliteitscontrole', robot: 'Loep', station: 'kwaliteit' },
  brein: { titel: 'Bij het brein', robot: 'Teller' },
  onderhoud: { titel: 'Onderhoud', robot: 'Slot' },
  markt: { titel: 'Markt en AI', robot: 'Radar' },
};
/** Machine-afdelingen zonder AI-robot: klein label met bestaande status. */
export const MACHINE_AFDELINGEN = ['acceptatie', 'certificaten', 'facturatie', 'exact', 'assistent', 'mail', 'service'] as const;
const KERN = new THREE.Vector3(0, 0, -9.6);
const S = 1.25; // poppetje en bureau groter, herkenbaar op 3-4 meter

/** Resultaatregel: privacygefilterd door schermAnonimiseer, hier alleen ingekort op 40 tekens. */
export function resultaatKort(t: string | null | undefined, max = 40): string {
  const s = (t ?? '').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}\u2026` : s;
}
const hm = (iso: string) => new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
export function toestandKort(s: StationStand | undefined): string {
  const t = s?.laatst_actief_op && Number.isFinite(Date.parse(s.laatst_actief_op)) ? s.laatst_actief_op : null;
  switch (s?.toestand) {
    case 'aan_het_werk': return 'bezig';
    case 'stand_by': return t ? `stand-by ${hm(t)}` : 'stand-by';
    case 'storing': return 'aandacht';
    default: return t ? `rust ${hm(t)}` : 'rust';
  }
}
const robotToestand = (s: string): Toestand => s === 'bezig' ? 'aan_het_werk' : s === 'fout' ? 'storing' : s === 'klaar' ? 'stand_by' : 'rust';
type Plek = { x: number; z: number };
type Stand = Toestand[];

function CameraRig() {
  const { camera, size } = useThree();
  useFrame(() => {
    camera.position.set(0, 20, 22); camera.lookAt(0, 0.9, 0);
    const cam = camera as THREE.OrthographicCamera;
    const z = Math.min(size.width / 24.5, size.height / 22);
    if (cam.zoom !== z) { cam.zoom = z; cam.updateProjectionMatrix(); }
  });
  return null;
}
function useHouding(plekken: Plek[], stand: React.MutableRefObject<Stand>, event: React.MutableRefObject<number>) {
  return (t: number, i: number) => {
    const st = stand.current[i]; const werk = st === 'aan_het_werk'; const rust = st === 'rust';
    const reageer = event.current > performance.now();
    return { p: plekken[i], werk, rust, fout: st === 'storing', hop: (werk ? Math.abs(Math.sin(t * 3 + i)) * 0.12 : 0) + (reageer && werk ? 0.15 : 0), lean: werk ? -0.12 : rust ? 0.22 : 0, kop: Math.sin(t * (werk ? 2.2 : 0.6) + i) * 0.05 };
  };
}
function AgentFigures({ colors, plekken, stand, event }: { colors: Colors; plekken: Plek[]; stand: React.MutableRefObject<Stand>; event: React.MutableRefObject<number> }) {
  const { scene } = useGLTF(asset.url);
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene); const scale = 1.25 * S / (box.max.y - box.min.y);
    const center = box.getCenter(new THREE.Vector3()); const result: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; head: boolean }[] = [];
    scene.traverse(o => { if (o instanceof THREE.Mesh) { const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); geo.translate(-center.x, -box.min.y, -center.z); geo.scale(scale, scale, scale); result.push({ geometry: geo, material: o.material, head: o.name.includes('head') }); } });
    return result;
  }, [scene]);
  useEffect(() => () => parts.forEach(p => p.geometry.dispose()), [parts]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]); const dummy = useMemo(() => new THREE.Object3D(), []);
  const houding = useHouding(plekken, stand, event);
  useFrame(({ clock }) => {
    plekken.forEach((_, i) => { const h = houding(clock.elapsedTime, i);
      parts.forEach((part, j) => { dummy.position.set(h.p.x, 0.35 * S + h.hop, h.p.z + 0.65 * S); dummy.rotation.set(h.lean, 0, part.head ? h.kop : 0); dummy.updateMatrix(); refs.current[j]?.setMatrixAt(i, dummy.matrix); });
    });
    refs.current.forEach(m => { if (m) m.instanceMatrix.needsUpdate = true; });
  });
  return <>{parts.map((part, i) => <instancedMesh key={`${i}-${plekken.length}`} ref={m => { refs.current[i] = m; }} args={[part.geometry, part.material, plekken.length]} frustumCulled={false} />)}</>;
}
/** Terugval zonder figuurmodel: lijf en hoofd, kleur volgt de status. */
function SimpeleFiguren({ colors, plekken, stand, event }: { colors: Colors; plekken: Plek[]; stand: React.MutableRefObject<Stand>; event: React.MutableRefObject<number> }) {
  const lijf = useRef<THREE.InstancedMesh>(null); const hoofd = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []); const kleur = useMemo(() => new THREE.Color(), []);
  const houding = useHouding(plekken, stand, event);
  useFrame(({ clock }) => {
    plekken.forEach((_, i) => { const h = houding(clock.elapsedTime, i);
      const c = h.fout ? colors.red : h.werk ? colors.blue : h.rust ? colors.dim : colors.green;
      dummy.position.set(h.p.x, 0.75 * S + h.hop, h.p.z + 0.7 * S); dummy.rotation.set(h.lean, 0, 0); dummy.updateMatrix(); lijf.current?.setMatrixAt(i, dummy.matrix); lijf.current?.setColorAt(i, kleur.copy(c).multiplyScalar(h.werk ? 1.5 + Math.sin(clock.elapsedTime * 4 + i) * 0.4 : 1));
      dummy.position.set(h.p.x, 1.45 * S + h.hop, h.p.z + 0.7 * S); dummy.rotation.set(0, 0, h.kop); dummy.updateMatrix(); hoofd.current?.setMatrixAt(i, dummy.matrix);
    });
    [lijf.current, hoofd.current].forEach(m => { if (m) m.instanceMatrix.needsUpdate = true; }); if (lijf.current?.instanceColor) lijf.current.instanceColor.needsUpdate = true;
  });
  return <>
    <instancedMesh key={`l${plekken.length}`} ref={lijf} args={[undefined, undefined, plekken.length]} frustumCulled={false}><capsuleGeometry args={[0.3 * S, 0.55 * S, 4, 10]} /><meshStandardMaterial color={colors.figure} toneMapped={false} /></instancedMesh>
    <instancedMesh key={`h${plekken.length}`} ref={hoofd} args={[undefined, undefined, plekken.length]} frustumCulled={false}><sphereGeometry args={[0.28 * S, 14, 10]} /><meshStandardMaterial color={colors.figure} /></instancedMesh>
  </>;
}
function Furniture({ colors, plekken, stand }: { colors: Colors; plekken: Plek[]; stand: React.MutableRefObject<Stand> }) {
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]); const monitors = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []); const tempColor = useMemo(() => new THREE.Color(), []);
  useEffect(() => {
    plekken.forEach((p, i) => {
      [[0.6, 0], [1.22, -0.22], [0.53, 0.62]].forEach(([y, z], k) => { dummy.position.set(p.x, y * S, p.z + z * S); dummy.scale.setScalar(S); dummy.updateMatrix(); refs.current[k]?.setMatrixAt(i, dummy.matrix); });
      dummy.position.set(p.x, 1.24 * S, p.z - 0.25 * S); dummy.scale.setScalar(S); dummy.updateMatrix(); monitors.current?.setMatrixAt(i, dummy.matrix);
    });
    refs.current.forEach(r => { if (r) r.instanceMatrix.needsUpdate = true; }); if (monitors.current) monitors.current.instanceMatrix.needsUpdate = true;
  }, [dummy, plekken]);
  useFrame(({ clock }) => { const t = clock.elapsedTime;
    plekken.forEach((_, i) => { const st = stand.current[i];
      const [c, k] = st === 'aan_het_werk' ? [colors.blue, 1.8 + Math.sin(t * 8 + i) * 0.4] : st === 'stand_by' ? [colors.green, 0.8] : st === 'storing' ? [colors.red, 1.4] : [colors.dim, 0.3 + Math.sin(t * 0.6 + i) * 0.1];
      monitors.current?.setColorAt(i, tempColor.copy(c).multiplyScalar(k));
    });
    if (monitors.current?.instanceColor) monitors.current.instanceColor.needsUpdate = true;
  });
  return <>
    {[[0.65, 0.12, 0.6], [0.58, 0.4, 0.06], [0.5, 0.52, 0.42]].map((s, k) => <instancedMesh key={`${k}-${plekken.length}`} ref={m => { refs.current[k] = m; }} args={[undefined, undefined, plekken.length]}><boxGeometry args={s as [number, number, number]} /><meshStandardMaterial color={colors.desk} metalness={0.45} roughness={0.35} /></instancedMesh>)}
    <instancedMesh key={`m${plekken.length}`} ref={monitors} args={[undefined, undefined, plekken.length]}><planeGeometry args={[0.48, 0.3]} /><meshBasicMaterial toneMapped={false} /></instancedMesh>
  </>;
}
function Network({ colors, plekken, stand }: { colors: Colors; plekken: Plek[]; stand: React.MutableRefObject<Stand> }) {
  const spaken = useMemo(() => plekken.map(p => new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p.x, 0.24, p.z), KERN.clone().setY(0.24)]), new THREE.LineBasicMaterial({ color: colors.blue, transparent: true, opacity: 0.05 }))), [colors, plekken]);
  const particles = useRef<THREE.InstancedMesh>(null); const beam = useRef<THREE.InstancedMesh>(null); const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => () => spaken.forEach(l => { l.geometry.dispose(); (l.material as THREE.Material).dispose(); }), [spaken]);
  useFrame(({ clock }) => { const t = clock.elapsedTime; let werkend = 0;
    plekken.forEach((p, i) => { const st = stand.current[i]; const stroom = st === 'aan_het_werk'; if (stroom) werkend++;
      (spaken[i].material as THREE.LineBasicMaterial).opacity = stroom ? 0.5 : 0.06;
      for (let j = 0; j < 5; j++) { const f = (t * 0.35 + j / 5) % 1; dummy.position.set(p.x + (KERN.x - p.x) * f, 0.3 + Math.sin(f * Math.PI) * 0.5, p.z + (KERN.z - p.z) * f); dummy.scale.setScalar(stroom ? 1.3 : 0); dummy.updateMatrix(); particles.current?.setMatrixAt(i * 5 + j, dummy.matrix); }
    });
    if (particles.current) particles.current.instanceMatrix.needsUpdate = true;
    const zichtbaar = Math.round(10 + Math.min(werkend, 6) * 13);
    for (let i = 0; i < 90; i++) { const f = (t * (0.08 + werkend * 0.03) + i / 90) % 1; const a = i * 2.4 + t; dummy.position.set(KERN.x + Math.cos(a) * (0.15 + f * 0.4), 1.5 + f * 4, KERN.z + Math.sin(a) * (0.15 + f * 0.4)); dummy.scale.setScalar(i < zichtbaar ? (1 - f) * 0.8 : 0); dummy.updateMatrix(); beam.current?.setMatrixAt(i, dummy.matrix); }
    if (beam.current) beam.current.instanceMatrix.needsUpdate = true;
  });
  return <>{spaken.map((l, i) => <primitive key={`s${i}`} object={l} />)}<instancedMesh key={`p${plekken.length}`} ref={particles} args={[undefined, undefined, plekken.length * 5]} frustumCulled={false}><sphereGeometry args={[0.07, 6, 4]} /><meshBasicMaterial color={colors.green.clone().multiplyScalar(2)} toneMapped={false} /></instancedMesh><instancedMesh ref={beam} args={[undefined, undefined, 90]} frustumCulled={false}><sphereGeometry args={[0.055, 6, 4]} /><meshBasicMaterial color={colors.red.clone().multiplyScalar(3)} toneMapped={false} /></instancedMesh></>;
}
function Kern({ colors, stand, event }: { colors: Colors; stand: React.MutableRefObject<Stand>; event: Puls | null }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null); const obj = useRef<THREE.Mesh>(null); const tik = useRef(0);
  useEffect(() => { if (event) tik.current = performance.now(); }, [event]);
  useFrame(({ clock }) => { const werkend = stand.current.filter(s => s === 'aan_het_werk').length; const t = clock.elapsedTime;
    const extra = Math.max(0, 1 - (performance.now() - tik.current) / 1500);
    const sterkte = 0.12 + werkend * 0.08;
    if (mat.current) mat.current.emissiveIntensity = 1.2 + werkend * 0.5 + Math.sin(t * (1.5 + werkend * 0.6)) * sterkte * 4 + extra * 2;
    if (obj.current) obj.current.scale.setScalar(1 + Math.sin(t * (1.5 + werkend * 0.6)) * sterkte * 0.3 + extra * 0.12);
  });
  return <mesh ref={obj} rotation-y={Math.PI/4}><octahedronGeometry args={[1.05,0]} /><meshStandardMaterial ref={mat} color={colors.red} emissive={colors.red} emissiveIntensity={1.2} metalness={0.8} roughness={0.15} /></mesh>;
}
function Floor({ colors }: { colors: Colors }) {
  const texture=useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');if(c){c.fillStyle=colors.bg.getStyle();c.fillRect(0,0,128,128);c.strokeStyle=colors.desk.getStyle();c.lineWidth=1;c.strokeRect(1,1,126,126);for(let i=0;i<40;i++){c.globalAlpha=0.2;c.fillRect((i*43)%128,(i*79)%128,1,1);}}const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(18,18);return tex;},[colors]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  return <mesh rotation-x={-Math.PI/2} position-y={-0.18}><circleGeometry args={[24,64]} /><meshStandardMaterial map={texture} metalness={0.4} roughness={0.65} /></mesh>;
}
function Runtime({ onLow }: { onLow: ()=>void }) {
  const {setDpr,gl}=useThree();const sample=useRef({time:0,frames:0,done:false});
  useEffect(()=>{const debug=gl.getContext().getExtension('WEBGL_debug_renderer_info');const ctx=gl.getContext();const renderer=debug?String(ctx.getParameter(debug.UNMASKED_RENDERER_WEBGL)):'';if(/SwiftShader|llvmpipe/i.test(renderer)){onLow();setDpr(1);}},[gl,onLow,setDpr]);
  useFrame((_,delta)=>{const s=sample.current;if(s.done)return;s.time+=delta;s.frames++;if(s.time>6){if(s.frames/s.time<28){onLow();setDpr(1);}s.done=true;}});return null;
}
const klasse = (t: Toestand) => ({ aan_het_werk: 'st-werk', stand_by: 'st-standby', rust: 'st-rust', storing: 'st-storing' }[t]);
export default function MachineScene(props: Props) {
  const viewport = useSchermViewport();
  const colors = useMemo(palette, []); const [quality, setQuality] = useState(true);
  const low = useMemo(() => () => setQuality(false), []);
  const history = useRef(new Set<string>()); const initial = useRef(true); const event = useRef(0);
  useEffect(() => { const fresh = props.pulsen.filter(p => !history.current.has(p.id)); history.current = new Set(props.pulsen.map(p => p.id)); if (initial.current) { initial.current = false; return; } if (fresh.length) event.current = performance.now() + 3000; }, [props.pulsen]);
  const robots = useMemo(() => (props.robots ?? []).filter(r => r.robotnaam && POPPETJE_PLEK[r.robotnaam]), [props.robots]);
  const sleutel = robots.map(r => r.robotnaam).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const plekken = useMemo<Plek[]>(() => robots.map(r => { const [x, z] = POPPETJE_PLEK[r.robotnaam!]; return { x, z }; }), [sleutel]);
  const stand = useRef<Stand>([]); stand.current = robots.map(r => robotToestand(r.status));
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const figuren = { colors, plekken, stand, event };
  return <div className="machine-weergave poppetjes-weergave">
    <Canvas orthographic dpr={schermDpr(viewport.breedte, quality)} resize={{ offsetSize: true }} frameloop={props.actief && !reduced ? 'always' : 'demand'} camera={{ position: [0, 20, 22], zoom: 50, near: 0.1, far: 120 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
      <color attach="background" args={[colors.bg]} /><ambientLight intensity={1} /><directionalLight position={[0, 15, 8]} intensity={2.6} />
      <Environment resolution={64}><Lightformer intensity={2} position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[15, 15, 1]} /><Lightformer intensity={1.5} color={colors.blue} position={[-12, 3, 0]} rotation-y={Math.PI / 2} scale={[8, 4, 1]} /></Environment>
      <Runtime onLow={low} /><CameraRig /><Floor colors={colors} />
      <Furniture colors={colors} plekken={plekken} stand={stand} />
      <FiguurVangnet terugval={<SimpeleFiguren {...figuren} />}><Suspense fallback={<SimpeleFiguren {...figuren} />}><AgentFigures {...figuren} /></Suspense></FiguurVangnet>
      <Network colors={colors} plekken={plekken} stand={stand} />
      <group position={[KERN.x, 1.6, KERN.z]}><Kern colors={colors} stand={stand} event={null} /><mesh rotation-x={Math.PI / 2} position-y={-0.5}><torusGeometry args={[1.7, 0.04, 6, 60]} /><meshBasicMaterial color={colors.red.clone().multiplyScalar(2)} toneMapped={false} /></mesh></group>
      <Html position={[KERN.x, 0, KERN.z + 1.6]} center zIndexRange={[20, 10]} className="poppetje-html">
        <div className="brein-tag" data-hoek="brein"><strong>Het brein</strong><span>{props.totaalVandaag} vandaag · {props.kennisregels} kennisregels</span></div>
      </Html>
      {robots.map((r, i) => { const p = plekken[i]; return <Html key={r.robotnaam} position={[p.x, 0, p.z + 1.75 * S]} center zIndexRange={[20, 10]} className="poppetje-html">
        <div className={`poppetje-label rb-${r.status}`} data-robot={r.robotnaam} data-status={r.status}>
          {(() => { const tag = Object.entries(AFDELING_TAG).find(([k, a]) => k !== 'brein' && a.robot === r.robotnaam); if (!tag) return null; const [k, a] = tag; const st = a.station ? props.stations[a.station] : undefined; const n = robots.filter(x => x.werkplek === k).length;
            return <div className={`afdeling-tag ${st ? klasse(st.toestand) : ''}`} data-afdeling={k}>{st && <span className="st-bol" />}<strong>{a.titel}</strong><b>{st ? st.vandaag : n}</b></div>; })()}
          <div className="poppetje-kop"><span className="st-bol" /><strong>{r.robotnaam}</strong></div>
          <small>{r.naam}</small>
          <em data-testid="poppetje-resultaat">{resultaatKort(r.status === 'bezig' && r.nu_tekst ? r.nu_tekst : r.resultaat) || 'nog geen resultaat'}</em>
        </div>
      </Html>; })}
      {quality && !reduced && props.actief && <Suspense fallback={null}><Effects /></Suspense>}
    </Canvas>
    <div className="machine-afdelingen" data-testid="scene-labels">
      {MACHINE_AFDELINGEN.map(id => { const st = props.stations[id]; const t = st?.toestand ?? 'rust';
        return <div key={id} className={`machine-chip ${klasse(t)}`} data-station={id} data-toestand={t} title={toestandLabel(st)}><span className="st-bol" /><strong>{STATION_LABELS[id]}</strong><b>{st?.vandaag ?? 0}</b></div>; })}
    </div>
  </div>;
}
