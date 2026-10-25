'use client';

// ============================================================
// لایه کیفیت مشترک همه صحنه‌های سه‌بعدی — حس رندر حرفه‌ای
// ۱) Environment + Lightformer — استودیوی داخلی برای بازتاب PBR
//    (فلز/شیشه/رویه براق چیزی برای بازتاباندن پیدا می‌کنند — بدون فایل HDR)
// نکته: SoftShadows (PCSS) عمداً حذف شد — پچ سراسری شیدر آن با چند Canvas
// هم‌زمان (مثلاً کارت‌های زنده لندینگ) تداخل می‌کند و شیدر سایه را خراب می‌کند.
// سایه نرم = PCFSoftShadowMap که خود R3F با prop `shadows` فعال می‌کند.
// یک بار داخل هر Canvas رندر می‌شود (داخل SceneEnvironment بعد از نورها)
// ============================================================

import * as THREE from 'three';
import { Environment, Lightformer } from '@react-three/drei';

export function SceneQuality() {
  return (
    <>
      {/* محیط استودیویی — فقط environment map است، پس‌زمینه صحنه عوض نمی‌شود */}
      <Environment resolution={128} frames={1}>
        {/* پنل سقفی بزرگ و نرم (نور اصلی محیط) */}
        <Lightformer
          intensity={2.2}
          color="#fff2e0"
          position={[0, 4, 0]}
          rotation-x={Math.PI / 2}
          scale={[6, 2, 1]}
        />
        {/* دو پنل جانبی سرد برای بُعد */}
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
        {/* بازتاب گرم ملایم از کف */}
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
 * تون‌مپینگ فیلمیک برای همه Canvas ها — در onCreated صدا زده می‌شود.
 * با preserveDrawingBuffer (تامب‌نیل‌ها) سازگار است.
 */
export function applyToneMapping(gl: THREE.WebGLRenderer) {
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = 1.12;
}
