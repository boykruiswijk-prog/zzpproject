import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

/** Kleuren van het muurscherm (three.js heeft echte kleurwaarden nodig). */
export const SCHERM_KLEUR = {
  vloer: "#10131b", bureau: "#1b2030", figuur: "#8a93a8", lijn: "#2a3142",
  rood: "#E53E2F", blauw: "#3fa9f5", groen: "#2fd27f", dim: "#2a2f3c",
};

export const STATION_LABELS: Record<string, string> = {
  intake: "Aanvraag-intake", acceptatie: "Acceptatie en KVK-check", certificaten: "Certificaten",
  facturatie: "Facturatie", exact: "Exact-koppeling", kennisbank: "Kennisbank en content",
  ads: "Ads-monitor", kwaliteit: "Kwaliteitscontrole", assistent: "Zeker-assistent",
  mail: "Mail", service: "Klantservice",
};
export const STATION_IDS = Object.keys(STATION_LABELS);

export type Puls = { id: string; station: string; status: "bezig" | "klaar" | "fout" };
type Props = { stations: Record<string, { vandaag: number; laatste_status: string | null }>; totaalVandaag: number; pulsen: Puls[] };

const kleurVoor = (s: string) => (s === "fout" ? SCHERM_KLEUR.rood : s === "bezig" ? SCHERM_KLEUR.blauw : SCHERM_KLEUR.groen);
const R = 7.2;
const posities = STATION_IDS.map((_, i) => {
  const a = (i / STATION_IDS.length) * Math.PI * 2 - Math.PI / 2;
  return new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R * 0.92);
});

function Camera() {
  const { camera, size } = useThree();
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const az = Math.PI / 4 + THREE.MathUtils.degToRad(25) * Math.sin((t / 150) * Math.PI * 2);
    camera.position.set(Math.cos(az) * 30, 22, Math.sin(az) * 30);
    camera.lookAt(0, 0, 0);
    const cam = camera as THREE.OrthographicCamera;
    const z = Math.min(size.width, size.height * 1.25) / 21;
    if (Math.abs(cam.zoom - z) > 0.01) { cam.zoom = z; cam.updateProjectionMatrix(); }
  });
  return null;
}

function Werkplekken({ stations, pulsen }: Pick<Props, "stations" | "pulsen">) {
  const bureaus = useRef<THREE.InstancedMesh>(null);
  const lijven = useRef<THREE.InstancedMesh>(null);
  const hoofden = useRef<THREE.InstancedMesh>(null);
  const schermen = useRef<(THREE.Mesh | null)[]>([]);
  const gloed = useRef<number[]>(STATION_IDS.map(() => 0));
  const gloedKleur = useRef<THREE.Color[]>(STATION_IDS.map(() => new THREE.Color(SCHERM_KLEUR.groen)));
  const pulsMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const pulsStaat = useRef<{ actief: boolean; start: number; i: number }[]>(Array.from({ length: 24 }, () => ({ actief: false, start: 0, i: 0 })));
  const gezien = useRef(new Set<string>());
  const wachtrij = useRef<Puls[]>([]);

  useEffect(() => {
    for (const p of pulsen) if (!gezien.current.has(p.id)) { gezien.current.add(p.id); wachtrij.current.push(p); }
  }, [pulsen]);

  useEffect(() => {
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const s = new THREE.Vector3(1, 1, 1);
    posities.forEach((p, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(p.z, p.x) - Math.PI / 2);
      bureaus.current?.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, 0.45, p.z), q, s));
      const achter = p.clone().multiplyScalar(1.12);
      lijven.current?.setMatrixAt(i, m.compose(new THREE.Vector3(achter.x, 0.7, achter.z), q, s));
      hoofden.current?.setMatrixAt(i, m.compose(new THREE.Vector3(achter.x, 1.55, achter.z), q, s));
    });
    [bureaus, lijven, hoofden].forEach((r) => { if (r.current) r.current.instanceMatrix.needsUpdate = true; });
  }, []);

  const lijnGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pts: number[] = [];
    posities.forEach((p) => pts.push(p.x, 0.05, p.z, 0, 0.05, 0));
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    // nieuwe gebeurtenissen gespreid starten
    if (wachtrij.current.length) {
      const vrij = pulsStaat.current.findIndex((x) => !x.actief);
      if (vrij >= 0) {
        const p = wachtrij.current.shift()!;
        const i = STATION_IDS.indexOf(p.station);
        if (i >= 0) {
          pulsStaat.current[vrij] = { actief: true, start: t, i };
          gloed.current[i] = 1; gloedKleur.current[i].set(kleurVoor(p.status));
          const mesh = pulsMeshes.current[vrij];
          if (mesh) (mesh.material as THREE.MeshBasicMaterial).color.set(kleurVoor(p.status));
        }
      }
    }
    pulsStaat.current.forEach((st, k) => {
      const mesh = pulsMeshes.current[k];
      if (!mesh) return;
      if (!st.actief) { mesh.visible = false; return; }
      const f = (t - st.start) / 1.8;
      if (f >= 1) { st.actief = false; mesh.visible = false; return; }
      mesh.visible = true;
      mesh.position.lerpVectors(posities[st.i], new THREE.Vector3(0, 0, 0), f).setY(0.3 + Math.sin(f * Math.PI) * 1.2);
    });
    STATION_IDS.forEach((id, i) => {
      const sc = schermen.current[i];
      if (!sc) return;
      gloed.current[i] = Math.max(0, gloed.current[i] - dt * 0.35);
      const actief = (stations[id]?.vandaag ?? 0) > 0;
      const basis = new THREE.Color(actief ? kleurVoor(stations[id]?.laatste_status ?? "klaar") : SCHERM_KLEUR.dim);
      const mat = sc.material as THREE.MeshStandardMaterial;
      mat.emissive.copy(basis).lerp(gloedKleur.current[i], gloed.current[i]);
      mat.emissiveIntensity = (actief ? 0.9 : 0.25) + gloed.current[i] * 2.2 + (actief ? Math.sin(t * 2 + i) * 0.08 : 0);
    });
  });

  return (
    <group>
      <lineSegments geometry={lijnGeo}>
        <lineBasicMaterial color={SCHERM_KLEUR.lijn} transparent opacity={0.8} />
      </lineSegments>
      <instancedMesh ref={bureaus} args={[undefined, undefined, STATION_IDS.length]}>
        <boxGeometry args={[2.2, 0.9, 1.1]} />
        <meshStandardMaterial color={SCHERM_KLEUR.bureau} roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={lijven} args={[undefined, undefined, STATION_IDS.length]}>
        <cylinderGeometry args={[0.28, 0.4, 1.0, 8]} />
        <meshStandardMaterial color={SCHERM_KLEUR.figuur} roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={hoofden} args={[undefined, undefined, STATION_IDS.length]}>
        <icosahedronGeometry args={[0.28, 0]} />
        <meshStandardMaterial color={SCHERM_KLEUR.figuur} roughness={0.5} />
      </instancedMesh>
      {posities.map((p, i) => {
        const id = STATION_IDS[i];
        const n = stations[id]?.vandaag ?? 0;
        return (
          <group key={id}>
            <mesh ref={(el) => (schermen.current[i] = el)} position={[p.x, 1.35, p.z]} rotation={[0, -Math.atan2(p.z, p.x) - Math.PI / 2, 0]}>
              <boxGeometry args={[1.5, 0.85, 0.08]} />
              <meshStandardMaterial color="#05070b" emissive={SCHERM_KLEUR.dim} emissiveIntensity={0.3} />
            </mesh>
            <Html position={[p.x, 2.7, p.z]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
              <div className={`scherm-label ${n > 0 ? "" : "scherm-label-dim"}`}>
                <span>{STATION_LABELS[id]}</span>
                <b>{n}</b>
              </div>
            </Html>
          </group>
        );
      })}
      {pulsStaat.current.map((_, k) => (
        <mesh key={k} ref={(el) => (pulsMeshes.current[k] = el)} visible={false}>
          <sphereGeometry args={[0.22, 10, 10]} />
          <meshBasicMaterial color={SCHERM_KLEUR.groen} />
        </mesh>
      ))}
    </group>
  );
}

function Brein({ totaal }: { totaal: number }) {
  const kern = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const s = 1 + Math.sin(t * 1.6) * 0.06;
    kern.current?.scale.setScalar(s);
    if (kern.current) kern.current.rotation.y = t * 0.2;
    if (ring.current) ring.current.rotation.z = t * 0.15;
  });
  return (
    <group position={[0, 1.4, 0]}>
      <mesh ref={kern}>
        <icosahedronGeometry args={[1.25, 1]} />
        <meshStandardMaterial color="#2a0d0a" emissive={SCHERM_KLEUR.rood} emissiveIntensity={1.1} flatShading />
      </mesh>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.1, 0.04, 6, 64]} />
        <meshBasicMaterial color={SCHERM_KLEUR.rood} transparent opacity={0.6} />
      </mesh>
      <Html position={[0, 2.4, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div className="scherm-brein">
          <b>{totaal}</b>
          <span>gebeurtenissen vandaag</span>
        </div>
      </Html>
    </group>
  );
}

export default function MachineScene(props: Props) {
  return (
    <Canvas orthographic dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance" }} camera={{ position: [20, 22, 20], zoom: 40, near: 0.1, far: 200 }}>
      <color attach="background" args={["#0B0D12"]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[10, 20, 5]} intensity={0.9} />
      <pointLight position={[0, 4, 0]} color={SCHERM_KLEUR.rood} intensity={18} distance={14} />
      <Camera />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[10.5, 64]} />
        <meshStandardMaterial color={SCHERM_KLEUR.vloer} roughness={0.95} />
      </mesh>
      <gridHelper args={[21, 21, "#1a1f2b", "#151a24"]} position={[0, 0.001, 0]} />
      <Werkplekken stations={props.stations} pulsen={props.pulsen} />
      <Brein totaal={props.totaalVandaag} />
    </Canvas>
  );
}
