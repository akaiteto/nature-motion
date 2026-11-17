// three.js の舞台（1920×1080）。three.js r187 を vendor/ に同梱（MIT）
import * as THREE from '../vendor/three.module.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { W, H } from './stage.js';
export { THREE };

export function threeStage({ bg = '#fff0f7', fov = 35, shadows = true, fog = null } = {}) {
  const canvas = document.getElementById('stage');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  if (fog) scene.fog = new THREE.Fog(bg, fog[0], fog[1]);
  // 部屋の照明をそのまま映り込みに使う（PBR の素材がつやっと見える）
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(fov, W / H, 0.1, 500);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffd6e8, 0.8));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-6, 12, 9);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 10, bottom: -10, near: 1, far: 60 });
  sun.shadow.radius = 6;
  scene.add(sun);

  return { renderer, scene, camera, sun, render: () => renderer.render(scene, camera) };
}

// 影だけを受ける透明な床
export function shadowFloor(scene, y = 0, opacity = 0.18) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity }));
  m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true;
  scene.add(m);
  return m;
}

// カメラを球面座標で置く（水平の角度 yaw、上下の角度 pitch、距離 dist、見る点 target）
export function orbit(camera, { yaw = 0, pitch = 0, dist = 20, target = [0, 0, 0], roll = 0 }) {
  const [tx, ty, tz] = target;
  camera.position.set(tx + dist * Math.sin(yaw) * Math.cos(pitch), ty + dist * Math.sin(pitch), tz + dist * Math.cos(yaw) * Math.cos(pitch));
  camera.up.set(Math.sin(roll), Math.cos(roll), 0);
  camera.lookAt(tx, ty, tz);
}
