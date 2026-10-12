import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, Lightformer, useGLTF } from '@react-three/drei';
import { ArrowDownToLine, BadgeCheck, BookOpen, BrainCircuit, FileCheck2, Mail, Megaphone, Receipt, RefreshCw, ShieldCheck, Headphones } from 'lucide-react';
import * as THREE from 'three';
import asset from '@/assets/scherm/agent.glb.asset.json';
import { STATION_IDS, STATION_LABELS, toestandLabel, type Puls, type StationStand, type Toestand } from './schermModel';
export { STATION_LABELS, STATION_IDS } from './schermModel';
export type { Puls } from './schermModel';
const Effects = lazy(() => import('./SchermEffects'));
const ICONS = [ArrowDownToLine, ShieldCheck, FileCheck2, Receipt, RefreshCw, BookOpen, Megaphone, BadgeCheck, BrainCircuit, Mail, Headphones];
// Three materials resolve the scoped semantic screen palette once on mounting.
function palette() {
  const el = document.querySelector('.scherm');
  const css = el ? getComputedStyle(el) : null;
  const read = (key: string) => new THREE.Color(`hsl(${css?.getPropertyValue(key).trim().replace(/ /g, ',') || '0,0%,50%'})`);
  return { bg: read('--s-bg'), floor: read('--s-surface'), desk: read('--s-lijn'), figure: read('--s-tekst'), dim: read('--s-dim'), red: read('--s-rood'), blue: read('--s-blauw'), green: read('--s-groen'), orange: read('--s-oranje') };
}
type Colors = ReturnType<typeof palette>;
type Props = { stations: Record<string, StationStand>; totaalVandaag: number; kennisregels: number; pulsen: Puls[]; focus: Puls | null; actief: boolean };
const POS = STATION_IDS.map((_, i) => { const a = i / STATION_IDS.length * Math.PI * 2 - Math.PI / 2; return new THREE.Vector3(Math.cos(a) * 8.5, 0, Math.sin(a) * 7); });
const AGENTS = STATION_IDS.flatMap((_, i) => Array.from({ length: 1 + i % 3 }, (_, j) => ({ station: i, offset: (j - (i % 3) / 2) * 0.72 })));

function CameraRig({ focus, active }: { focus: Puls | null; active: boolean }) {
  const { camera, size } = useThree();
  const shot = useRef({ station: -1, start: -100, last: -100 });
  const look = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const aim = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    if (!focus || !active || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const now = performance.now() / 1000;
    if (now - shot.current.last < 30) return;
    shot.current = { station: STATION_IDS.indexOf(focus.station), start: now, last: now };
  }, [focus, active]);
  useFrame(({ clock }, delta) => {
    const a = Math.PI / 2 + Math.sin(clock.elapsedTime / 45) * 0.16;
    target.set(Math.cos(a) * 22, 20, Math.sin(a) * 22);
    aim.set(0, 0.9, 0);
    const age = performance.now() / 1000 - shot.current.start;
    const weight = active && shot.current.station >= 0 && age < 6 ? Math.sin(Math.PI * Math.max(0, age) / 6) * 0.42 : 0;
    if (weight) { const p = POS[shot.current.station]; aim.lerp(p, weight); target.x += p.x * weight; target.z += p.z * weight; }
    const dt = Math.min(delta, 0.05);
    camera.position.lerp(target, 1 - Math.exp(-3 * dt)); look.lerp(aim, 1 - Math.exp(-3 * dt)); camera.lookAt(look);
    const cam = camera as THREE.OrthographicCamera;
    cam.zoom = Math.min(size.width / 24, size.height / 20) * (1 + weight * 0.3); cam.updateProjectionMatrix();
  });
  return null;
}
type Stand = Toestand[];
function AgentFigures({ colors, event, stand }: { colors: Colors; event: Puls | null; stand: React.MutableRefObject<Stand> }) {
  const { scene } = useGLTF(asset.url);
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene); const height = box.max.y - box.min.y; const scale = 1.25 / height;
    const center = box.getCenter(new THREE.Vector3()); const result: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; head: boolean }[] = [];
    scene.traverse(o => { if (o instanceof THREE.Mesh) { const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); geo.translate(-center.x, -box.min.y, -center.z); geo.scale(scale, scale, scale); result.push({ geometry: geo, material: o.material, head: o.name.includes('head') }); } });
    return result;
  }, [scene]);
  useEffect(() => () => parts.forEach(p => p.geometry.dispose()), [parts]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const hands = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const reactive = useRef({ station: -1, until: 0 });
  useEffect(() => { if (event) reactive.current = { station: STATION_IDS.indexOf(event.station), until: performance.now() + 3000 }; }, [event]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    AGENTS.forEach((agent, i) => {
      const p = POS[agent.station]; const st = stand.current[agent.station];
      const reacting = reactive.current.station === agent.station && performance.now() < reactive.current.until;
      const werk = st === 'aan_het_werk'; const rust = st === 'rust';
      // Aan het werk: iets naar voren, naar het scherm. Rust: achterover geleund.
      const lean = werk ? -0.12 : rust ? 0.28 : 0;
      parts.forEach((part, j) => {
        dummy.position.set(p.x + agent.offset, 0.35 + (reacting ? 0.2 : 0), p.z + 0.65 + (rust ? 0.12 : 0));
        dummy.rotation.set(lean + (part.head && werk ? Math.sin(t * 3 + i) * 0.03 : 0), 0, part.head ? Math.sin(t * (werk ? 2.2 : 0.6) + i) * 0.04 : 0);
        dummy.updateMatrix(); refs.current[j]?.setMatrixAt(i, dummy.matrix);
      });
      for (let hand = 0; hand < 2; hand++) {
        const typ = werk ? Math.abs(Math.sin(t * 14 + i * 1.7 + hand * 1.3)) * 0.05 : 0;
        dummy.position.set(p.x + agent.offset + (hand ? 0.18 : -0.18), (rust ? 0.86 : 1.0) + typ, p.z + (rust ? 0.45 : 0.1));
        dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); hands.current?.setMatrixAt(i * 2 + hand, dummy.matrix);
      }
    });
    refs.current.forEach(m => { if (m) m.instanceMatrix.needsUpdate = true; }); if (hands.current) hands.current.instanceMatrix.needsUpdate = true;
  });
  return <>{parts.map((part, i) => <instancedMesh key={i} ref={m => { refs.current[i] = m; }} args={[part.geometry, part.material, AGENTS.length]} frustumCulled={false} />)}
    <instancedMesh ref={hands} args={[undefined, undefined, AGENTS.length * 2]} frustumCulled={false}><boxGeometry args={[0.12,0.08,0.18]} /><meshStandardMaterial color={colors.figure} /></instancedMesh></>;
}
function Furniture({ colors, stand }: { colors: Colors; stand: React.MutableRefObject<Stand> }) {
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]); const monitors = useRef<THREE.InstancedMesh>(null); const regels = useRef<THREE.InstancedMesh>(null);
  const ringen = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []); const tempColor = useMemo(() => new THREE.Color(), []);
  useEffect(() => {
    AGENTS.forEach((a, i) => { const p = POS[a.station];
      [[0.6,0], [1.22,-0.22], [0.53,0.62]].forEach(([y,z], k) => { dummy.position.set(p.x + a.offset,y,p.z + z); dummy.updateMatrix(); refs.current[k]?.setMatrixAt(i,dummy.matrix); });
      dummy.position.set(p.x+a.offset,1.24,p.z-0.25);dummy.updateMatrix();monitors.current?.setMatrixAt(i,dummy.matrix);
    });
    refs.current.forEach(r => { if (r) r.instanceMatrix.needsUpdate = true; });if(monitors.current) monitors.current.instanceMatrix.needsUpdate=true;
  }, [dummy]);
  useFrame(({ clock }) => { const t = clock.elapsedTime; const mesh = monitors.current;
    AGENTS.forEach((a,i) => { const st = stand.current[a.station]; const basis = a.station % 2 ? colors.blue : colors.green;
      const [c, k] = st === 'aan_het_werk' ? [basis, 1.6 + Math.sin(t * 8 + i) * 0.35]
        : st === 'stand_by' ? [basis, 0.7]
        : st === 'storing' ? [colors.red, 1.2]
        : [colors.dim, 0.3 + Math.sin(t * 0.6 + i) * 0.12]; // rust: screensaver
      mesh?.setColorAt(i, tempColor.copy(c).multiplyScalar(k));
      // Bewegende regels alleen op schermen die aan het werk zijn.
      const p = POS[a.station];
      for (let r = 0; r < 3; r++) {
        const aan = st === 'aan_het_werk';
        dummy.position.set(p.x + a.offset - 0.04 + ((r * 0.07 + t * 0.9) % 0.08), 1.32 - (((t * 0.35 + r / 3) % 1) * 0.22), p.z - 0.245);
        dummy.scale.set(aan ? 1 : 0, aan ? 1 : 0, 1); dummy.updateMatrix(); regels.current?.setMatrixAt(i * 3 + r, dummy.matrix);
      }
    });
    if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true; if (regels.current) regels.current.instanceMatrix.needsUpdate = true;
    ringen.current.forEach((m, i) => { if (!m) return; const st = stand.current[i];
      if (st === 'aan_het_werk') m.color.copy(colors.green).multiplyScalar(1.6 + Math.sin(t * 3) * 0.5);
      else if (st === 'storing') m.color.copy(colors.red).multiplyScalar(1.5);
      else if (st === 'stand_by') m.color.copy(colors.blue).multiplyScalar(0.6);
      else m.color.copy(colors.dim).multiplyScalar(0.6);
    });
  });
  return <>
    {[[0.65,0.12,0.6], [0.58,0.4,0.06], [0.5,0.52,0.42]].map((s,k)=><instancedMesh key={k} ref={m=>{refs.current[k]=m;}} args={[undefined,undefined,AGENTS.length]}><boxGeometry args={s as [number,number,number]} /><meshStandardMaterial color={colors.desk} metalness={0.45} roughness={0.35} /></instancedMesh>)}
    <instancedMesh ref={monitors} args={[undefined,undefined,AGENTS.length]}><planeGeometry args={[0.48,0.3]} /><meshBasicMaterial toneMapped={false} /></instancedMesh>
    <instancedMesh ref={regels} args={[undefined,undefined,AGENTS.length*3]} frustumCulled={false}><planeGeometry args={[0.28,0.022]} /><meshBasicMaterial color={colors.figure.clone().multiplyScalar(2)} toneMapped={false} /></instancedMesh>
    {POS.map((p,i)=><group key={i} position={p}><mesh position-y={0.08}><cylinderGeometry args={[1.52,1.4,0.16,6]} /><meshStandardMaterial color={colors.floor} metalness={0.7} roughness={0.3} /></mesh><mesh position-y={0.18} rotation-x={-Math.PI/2}><ringGeometry args={[1.4,1.44,6]} /><meshBasicMaterial ref={m=>{ringen.current[i]=m;}} color={colors.dim} toneMapped={false} /></mesh></group>)}
  </>;
}
const KERN = new THREE.Vector3();
function Network({ colors, stand, event }: { colors: Colors; stand: React.MutableRefObject<Stand>; event: Puls | null }) {
  // Spaken (werkplek -> brein) en een zwakke ring; geen constante stroom meer.
  const spaken = useMemo(() => POS.map((p) => { const g = new THREE.BufferGeometry().setFromPoints([p.clone().setY(0.24), KERN.clone().setY(0.24)]); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: colors.blue, transparent: true, opacity: 0.05 })); return l; }), [colors]);
  const ring = useMemo(() => POS.map((p, i) => { const g = new THREE.BufferGeometry().setFromPoints([p.clone().setY(0.24), POS[(i + 1) % POS.length].clone().setY(0.24)]); const m = new THREE.LineDashedMaterial({ color: colors.blue, transparent: true, opacity: 0.08, dashSize: 0.12, gapSize: 0.18 }); const l = new THREE.Line(g, m); l.computeLineDistances(); return l; }), [colors]);
  const particles = useRef<THREE.InstancedMesh>(null); const beam = useRef<THREE.InstancedMesh>(null); const dummy = useMemo(() => new THREE.Object3D(), []);
  const burst = useRef({ station: -1, until: 0 });
  useEffect(() => { if (event) burst.current = { station: STATION_IDS.indexOf(event.station), until: performance.now() + 3000 }; }, [event]);
  useEffect(() => () => [...spaken, ...ring].forEach(l => { l.geometry.dispose(); (l.material as THREE.Material).dispose(); }), [spaken, ring]);
  useFrame(({ clock }) => { const t = clock.elapsedTime; let werkend = 0;
    POS.forEach((p, i) => { const st = stand.current[i]; const nieuw = burst.current.station === i && performance.now() < burst.current.until;
      const stroom = st === 'aan_het_werk' || nieuw; if (st === 'aan_het_werk') werkend++;
      (spaken[i].material as THREE.LineBasicMaterial).opacity = stroom ? 0.55 : st === 'stand_by' || st === 'storing' ? 0.1 : 0.04;
      for (let j = 0; j < 6; j++) { const f = (t * 0.35 + j / 6) % 1; dummy.position.lerpVectors(p, KERN, f); dummy.position.y = 0.3 + Math.sin(f * Math.PI) * 0.5; dummy.scale.setScalar(stroom ? (nieuw ? 1.6 : 1.2) : 0); dummy.updateMatrix(); particles.current?.setMatrixAt(i * 6 + j, dummy.matrix); }
    });
    if (particles.current) particles.current.instanceMatrix.needsUpdate = true;
    // Het brein: meer werkplekken aan het werk = meer en snellere deeltjes.
    const zichtbaar = Math.round(10 + Math.min(werkend, 6) * 13);
    for (let i = 0; i < 90; i++) { const f = (t * (0.08 + werkend * 0.03) + i / 90) % 1; const a = i * 2.4 + t; dummy.position.set(Math.cos(a) * (0.15 + f * 0.4), 1.5 + f * 5, Math.sin(a) * (0.15 + f * 0.4)); dummy.scale.setScalar(i < zichtbaar ? (1 - f) * 0.8 : 0); dummy.updateMatrix(); beam.current?.setMatrixAt(i, dummy.matrix); }
    if (beam.current) beam.current.instanceMatrix.needsUpdate = true;
  });
  return <>{spaken.map((l, i) => <primitive key={`s${i}`} object={l} />)}{ring.map((l, i) => <primitive key={`r${i}`} object={l} />)}<instancedMesh ref={particles} args={[undefined, undefined, POS.length * 6]} frustumCulled={false}><sphereGeometry args={[0.07, 6, 4]} /><meshBasicMaterial color={colors.green.clone().multiplyScalar(2)} toneMapped={false} /></instancedMesh><instancedMesh ref={beam} args={[undefined, undefined, 90]} frustumCulled={false}><sphereGeometry args={[0.055, 6, 4]} /><meshBasicMaterial color={colors.red.clone().multiplyScalar(3)} toneMapped={false} /></instancedMesh></>;
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
  return <mesh rotation-x={-Math.PI/2} position-y={-0.18}><circleGeometry args={[13,64]} /><meshStandardMaterial map={texture} metalness={0.4} roughness={0.65} /></mesh>;
}
function Runtime({ onLow }: { onLow: ()=>void }) {
  const {setDpr,gl}=useThree();const sample=useRef({time:0,frames:0,done:false});
  useEffect(()=>{const debug=gl.getContext().getExtension('WEBGL_debug_renderer_info');const ctx=gl.getContext();const renderer=debug?String(ctx.getParameter(debug.UNMASKED_RENDERER_WEBGL)):'';if(/SwiftShader|llvmpipe/i.test(renderer)){onLow();setDpr(1);}},[gl,onLow,setDpr]);
  useFrame((_,delta)=>{const s=sample.current;if(s.done)return;s.time+=delta;s.frames++;if(s.time>6){if(s.frames/s.time<28){onLow();setDpr(1);}s.done=true;}});return null;
}
export default function MachineScene(props: Props) {
  const colors=useMemo(palette,[]);const [quality,setQuality]=useState(true);const [event,setEvent]=useState<Puls|null>(null);const history=useRef(new Set<string>());const initial=useRef(true);
  const low=useMemo(()=>()=>setQuality(false),[]);
  useEffect(()=>{const fresh=props.pulsen.filter(p=>!history.current.has(p.id));history.current=new Set(props.pulsen.map(p=>p.id));if(initial.current){initial.current=false;return;}const latest=[...fresh].sort((a,b)=>Date.parse(b.tijd)-Date.parse(a.tijd))[0];if(latest){setEvent(latest);const t=setTimeout(()=>setEvent(null),3000);return()=>clearTimeout(t);}},[props.pulsen]);
  const stand=useRef<Stand>(STATION_IDS.map(()=> 'rust'));stand.current=STATION_IDS.map(id=>props.stations[id]?.toestand??'rust');
  const reduced=useMemo(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches,[]);
  return <Canvas orthographic dpr={quality ? [1,1.5] : 1} frameloop={props.actief&&!reduced?'always':'demand'} camera={{position:[0,20,22],zoom:35,near:0.1,far:120}} gl={{antialias:false,powerPreference:'high-performance'}}>
    <color attach="background" args={[colors.bg]} /><ambientLight intensity={0.8} /><directionalLight position={[0,15,8]} intensity={2.4} />
    <Environment resolution={64}><Lightformer intensity={2} position={[0,8,0]} rotation-x={Math.PI/2} scale={[15,15,1]} /><Lightformer intensity={1.5} color={colors.blue} position={[-12,3,0]} rotation-y={Math.PI/2} scale={[8,4,1]} /></Environment>
    <Runtime onLow={low} /><CameraRig focus={props.focus} active={props.actief} /><Floor colors={colors} />
    <Furniture colors={colors} stand={stand} /><Suspense fallback={null}><AgentFigures colors={colors} event={event} stand={stand} /></Suspense>
    <Network colors={colors} stand={stand} event={event} />
    <group position={[0,1.6,0]}><Kern colors={colors} stand={stand} event={event} /><mesh rotation-x={Math.PI/2} position-y={-0.5}><torusGeometry args={[1.7,0.04,6,60]} /><meshBasicMaterial color={colors.red.clone().multiplyScalar(2)} toneMapped={false} /></mesh>
      <Html position={[0,2.4,0]} center zIndexRange={[12,0]}><div className="scherm-core"><span>Het brein</span><b>{props.totaalVandaag}</b><small>gebeurtenissen vandaag</small><em>{props.kennisregels} kennisregels</em></div></Html>
    </group>
    {POS.map((p,i)=>{const id=STATION_IDS[i];const Icon=ICONS[i];const st=props.stations[id];const n=st?.vandaag??0;const toestand=st?.toestand??'rust';
      const klasse={aan_het_werk:'st-werk',stand_by:'st-standby',rust:'st-rust',storing:'st-storing'}[toestand];
      return <Html key={id} position={[p.x, i === 5 || i === 6 ? 1.9 : 3.8, p.z]} center zIndexRange={[10,0]}><div className={`scherm-station ${klasse}`} data-station={id} data-toestand={toestand}><Icon /><div><strong>{STATION_LABELS[id]}</strong><small className="st-regel"><span className="st-bol" /><span>{toestandLabel(st)}</span></small></div><b>{n}</b>{event?.station===id&&<p className="agent-balloon">{event.tekst}</p>}</div></Html>;
    })}
    {quality&&!reduced&&props.actief&&<Suspense fallback={null}><Effects /></Suspense>}
  </Canvas>;
}
