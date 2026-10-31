import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

/** Export a GLB from the scene root group (binary glTF standard) */
export async function exportGroupToGLB(
  group: THREE.Object3D,
  filename: string
): Promise<void> {
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(group, { binary: true });
  const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.glb') ? filename : `${filename}.glb`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
