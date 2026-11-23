// The only scene content in Step 01: sky, sun, a TSL grid ground and two clearly identified test cubes.
import {
  CanvasTexture, Color, DirectionalLight, FogExp2, Group, HemisphereLight,
  Mesh, MeshBasicNodeMaterial, MeshStandardNodeMaterial, PlaneGeometry,
  RingGeometry, Scene, SRGBColorSpace, Vector3,
} from 'three/webgpu';
import { abs, color, float, fract, min, mix, positionWorld, screenUV, smoothstep } from 'three/tsl';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TEST_SCENE } from '../config/app';
import type { QualityTier } from '../config/quality';
import type { PhysicsSandbox } from '../core/physics';

function faceLabel(number: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d')!;
  context.strokeStyle = 'rgba(255,255,255,0.66)';
  context.lineWidth = 2;
  context.strokeRect(34, 34, 188, 188);
  context.fillStyle = 'rgba(255,255,255,0.9)';
  context.font = '500 104px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(number, 128, 132);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
function specimen(size: number, paint: string, number: string): Group {
  const group = new Group();
  const mesh = new Mesh(new RoundedBoxGeometry(size, size, size, 3, 0.065), new MeshStandardNodeMaterial({ color: paint, roughness: 0.31, metalness: 0.15 }));
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  const decal = new Mesh(new PlaneGeometry(size * 0.83, size * 0.83), new MeshBasicNodeMaterial({ map: faceLabel(number), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  decal.position.z = size / 2 + 0.002;
  group.add(decal);
  return group;
}
export class TestScene {
  readonly scene = new Scene();
  readonly cube = specimen(2, '#4a9d84', '01');
  readonly bodyMesh = specimen(TEST_SCENE.bodySize, '#eb965d', '02');
  readonly sun = new DirectionalLight('#fff4da', 3.5);
  readonly cubeLabelPosition = new Vector3();
  readonly bodyLabelPosition = new Vector3();
  private previousAngle = 0;
  private angle = 0;
  constructor() {
    this.scene.backgroundNode = mix(color('#9fd1df'), color('#edf0e1'), smoothstep(0, 0.28, screenUV.y));
    this.scene.fog = new FogExp2('#e5eade', 0.012);
    this.scene.add(new HemisphereLight('#e9f6ff', '#b5b998', 2.1));
    this.sun.position.set(-9, 16, 7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -15;
    this.sun.shadow.camera.right = 15;
    this.sun.shadow.camera.top = 15;
    this.sun.shadow.camera.bottom = -15;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 55;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.bias = -0.00015;
    this.scene.add(this.sun);
    const groundMaterial = new MeshStandardNodeMaterial({ roughness: 0.92, metalness: 0 });
    const minorDistance = abs(fract(positionWorld.xz.add(0.5)).sub(0.5));
    const majorDistance = abs(fract(positionWorld.xz.div(5).add(0.5)).sub(0.5));
    const minorAA = positionWorld.xz.fwidth().max(0.008);
    const majorAA = positionWorld.xz.div(5).fwidth().max(0.002);
    const minorLine = float(1).sub(smoothstep(float(0.006), minorAA.x.max(minorAA.y).add(0.012), min(minorDistance.x, minorDistance.y)));
    const majorLine = float(1).sub(smoothstep(float(0.0015), majorAA.x.max(majorAA.y).add(0.003), min(majorDistance.x, majorDistance.y)));
    const fade = float(1).sub(smoothstep(16, 80, positionWorld.xz.length()));
    const base = mix(color('#e2e7dc'), color('#d0d9cb'), minorLine.mul(fade).mul(0.65));
    groundMaterial.colorNode = mix(base, color('#b9cabb'), majorLine.mul(fade).mul(0.67));
    const ground = new Mesh(new PlaneGeometry(4000, 4000), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const ringMaterial = new MeshBasicNodeMaterial({ color: '#6c9f8d', transparent: true, opacity: 0.3, depthWrite: false });
    const ring = new Mesh(new RingGeometry(2.08, 2.095, 128), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(TEST_SCENE.renderCubePosition.x, 0.007, 0);
    this.scene.add(ring);
    const dropRing = new Mesh(new RingGeometry(1.32, 1.335, 96), new MeshBasicNodeMaterial({ color: '#c48a5f', transparent: true, opacity: 0.5, depthWrite: false }));
    dropRing.rotation.x = -Math.PI / 2;
    dropRing.position.set(TEST_SCENE.dropPosition.x, 0.009, TEST_SCENE.dropPosition.z);
    this.scene.add(dropRing);
    this.cube.position.copy(TEST_SCENE.renderCubePosition);
    this.scene.add(this.cube, this.bodyMesh);
  }
  fixedUpdate(dt: number, reducedMotion: boolean): void {
    this.previousAngle = this.angle;
    if (!reducedMotion) this.angle += dt * 0.33;
  }
  render(alpha: number, physics: PhysicsSandbox): void {
    const angle = this.previousAngle + (this.angle - this.previousAngle) * alpha;
    this.cube.rotation.set(Math.sin(angle * 0.8) * 0.1, angle, Math.sin(angle) * 0.08);
    this.bodyMesh.position.lerpVectors(physics.previousPosition, physics.currentPosition, alpha);
    this.bodyMesh.quaternion.slerpQuaternions(physics.previousRotation, physics.currentRotation, alpha);
    this.cubeLabelPosition.copy(this.cube.position).add(new Vector3(0, 1.75, 0));
    this.bodyLabelPosition.copy(this.bodyMesh.position).add(new Vector3(0, 1.35, 0));
  }
  applyQuality(tier: QualityTier): void {
    this.sun.castShadow = tier.shadows;
    if (this.sun.shadow.mapSize.x !== tier.shadowMapSize) {
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      this.sun.shadow.mapSize.set(tier.shadowMapSize, tier.shadowMapSize);
      this.sun.shadow.needsUpdate = true;
    }
  }
  dispose(): void {
    this.scene.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        const map = (material as MeshBasicNodeMaterial).map;
        map?.dispose();
        material.dispose();
      }
    });
    this.sun.dispose();
    this.scene.background = new Color('#e5eade');
  }
}
