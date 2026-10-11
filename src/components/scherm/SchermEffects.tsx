import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
export default function SchermEffects() {
  return <EffectComposer multisampling={0}><Bloom luminanceThreshold={1} intensity={0.65} mipmapBlur /><Vignette offset={0.15} darkness={0.4} /></EffectComposer>;
}