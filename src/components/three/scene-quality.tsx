'use client';

// ============================================================
// Shared quality layer for all 3D scenes — a professional render feel
// 1) Environment + Lightformer — built-in studio for PBR reflections
//    (metal/glass/glossy countertops have something to reflect — no HDR file)
// Note: SoftShadows (PCSS) was deliberately removed — its global shader patch
// conflicts with multiple concurrent Canvases (e.g. live landing cards) and breaks the shadow shader.
// Soft shadows = PCFSoftShadowMap, which R3F itself enables via the `shadows` prop.
// Rendered once inside each Canvas (inside SceneEnvironment after the lights)
// ============================================================

import * as THREE from 'three';
import { Environment, Lightformer } from '@react-three/drei';

export function SceneQuality() {
  return (
    <>
      {/* Studio environment — it is only an environment map; the scene background is unchanged */}
      <Environment resolution={128} frames={1}>
        {/* Large soft ceiling panel (main environment light) */}
        <Lightformer
          intensity={2.2}
          color="#fff2e0"
          position={[0, 4, 0]}
          rotation-x={Math.PI / 2}
          scale={[6, 2, 1]}
        />
        {/* Two cool side panels for depth */}
        <Lightformer
          intensity={0.6}
          color="#dfe8f0"
          position={[-4, 1.6, 0]}
          rotation-y={Math.PI / 2}
          scale={[3, 2, 1]}
        />
        <Lightformer
          intensity={0.6}
          color="#dfe8f0"
          position={[4, 1.6, 0]}
          rotation-y={-Math.PI / 2}
          scale={[3, 2, 1]}
        />
        {/* Gentle warm reflection from the floor */}
        <Lightformer
          intensity={0.3}
          color="#ffe6c7"
          position={[0, -2, 0]}
          rotation-x={-Math.PI / 2}
          scale={[6, 3, 1]}
        />
      </Environment>
    </>
  );
}

/**
 * Filmic tone mapping for all Canvases — called in onCreated.
 * Compatible with preserveDrawingBuffer (thumbnails).
 */
export function applyToneMapping(gl: THREE.WebGLRenderer) {
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = 1.12;
}
