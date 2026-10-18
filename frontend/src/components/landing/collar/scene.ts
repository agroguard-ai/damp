/**
 * Escena 3D del collar DAMP (Three.js), armada por código: no carga modelos externos.
 *
 * El collar se modela como 7 capas apiladas (de arriba hacia abajo):
 *   0 carcasa · 1 GPS · 2 radio LoRa · 3 cerebro (ESP32-S3) · 4 aviso (buzzer + LED) · 5 batería · 6 correa + sensor
 *
 * Todo el estado visual sale de un único número, `progress` (0 → 1), que maneja
 * el ScrollTrigger de la sección (ver CollarExplode.tsx):
 *   0.00–0.10  intro: collar armado, se empieza a abrir
 *   0.10–0.80  una pieza por tramo de 0.10: se resalta y el resto se atenúa
 *   0.80–1.00  outro: el collar se vuelve a armar
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export const PART_COUNT = 7;
export const INTRO_END = 0.1;
export const PART_SPAN = 0.1;

export interface CollarScene {
  setProgress(p: number): void;
  resize(width: number, height: number): void;
  setRunning(running: boolean): void;
  dispose(): void;
}

export interface FrameInfo {
  /** Pieza resaltada (0–6) o -1 si no hay ninguna. */
  active: number;
  /** Cuánto se ve la etiqueta (0–1). */
  visibility: number;
  /** Posición en pantalla (px, relativa al canvas) del punto de anclaje de la pieza activa. */
  x: number;
  y: number;
}

interface Part {
  group: THREE.Group;
  materials: THREE.Material[];
  outline: THREE.LineSegments;
  assembledY: number;
  explodedY: number;
  anchor: THREE.Vector3;
}

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Pistas de cobre, vías y serigrafía para la cara superior de una placa. */
function pcbTexture(label: string, seed: number) {
  return canvasTexture(512, 350, (ctx) => {
    ctx.scale(0.5, 0.5);
    const rand = seeded(seed);
    ctx.clearRect(0, 0, 1024, 700);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(212,166,74,0.55)' : 'rgba(74,222,128,0.38)';
      ctx.lineWidth = 4 + rand() * 5;
      let x = 40 + rand() * 944;
      let y = 40 + rand() * 620;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        if (k % 2 === 0) x = clamp(x + (rand() - 0.5) * 520, 30, 994);
        else y = clamp(y + (rand() - 0.5) * 380, 30, 670);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(212,166,74,0.85)';
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(212,166,74,0.9)';
    ctx.lineWidth = 8;
    for (const [cx, cy] of [
      [48, 48],
      [976, 48],
      [48, 652],
      [976, 652],
    ]) {
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(236,242,238,0.75)';
    ctx.font = '600 34px ui-monospace, Menlo, monospace';
    ctx.fillText(label, 90, 640);
    ctx.font = '500 26px ui-monospace, Menlo, monospace';
    ctx.fillText('DAMP · REV 3', 760, 640);
  });
}

export function createCollarScene(
  canvas: HTMLCanvasElement,
  options: { onFrame?: (info: FrameInfo) => void; staticProgress?: number } = {}
): CollarScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.position.set(-6, 12, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#4ade80', 2.2);
  rim.position.set(7, 4, -9);
  scene.add(rim);
  const fill = new THREE.DirectionalLight('#ffc107', 0.5);
  fill.position.set(8, -3, 6);
  scene.add(fill);

  const disposables: { dispose(): void }[] = [envTexture, pmrem];
  const track = <T extends { dispose(): void }>(d: T) => {
    disposables.push(d);
    return d;
  };

  const parts: Part[] = [];

  function makePart(
    assembledY: number,
    explodedY: number,
    build: (g: THREE.Group, mat: (m: THREE.Material) => THREE.Material) => THREE.Object3D | void
  ) {
    const group = new THREE.Group();
    const materials: THREE.Material[] = [];
    const mat = (m: THREE.Material) => {
      m.transparent = true;
      m.userData.baseOpacity = m.userData.baseOpacity ?? 1;
      materials.push(m);
      track(m);
      return m;
    };
    // Si la pieza devuelve un objeto, el recuadro y la etiqueta apuntan a ese objeto (ej. el sensor de la correa).
    const focusObject = build(group, mat) || group;

    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(focusObject);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const outlineGeo = track(new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x + 0.18, size.y + 0.18, size.z + 0.18)));
    const outlineMat = track(new THREE.LineBasicMaterial({ color: '#4ade80', transparent: true, opacity: 0 }));
    const outline = new THREE.LineSegments(outlineGeo, outlineMat);
    outline.position.copy(center);
    group.add(outline);

    const anchor = new THREE.Vector3(box.max.x + 0.1, center.y, center.z);
    scene.add(group);
    parts.push({ group, materials, outline, assembledY, explodedY, anchor });
  }

  const geo = <T extends THREE.BufferGeometry>(g: T) => track(g);
  const std = (params: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(params);

  /** Placa base verde con pistas, común a GPS, radio, cerebro y aviso. */
  function addBoard(g: THREE.Group, mat: (m: THREE.Material) => THREE.Material, label: string, seed: number) {
    const board = new THREE.Mesh(
      geo(new RoundedBoxGeometry(5.6, 0.12, 3.8, 3, 0.06)),
      mat(std({ color: '#0d3b25', roughness: 0.5, metalness: 0.15 }))
    );
    g.add(board);
    const traces = new THREE.Mesh(
      geo(new THREE.PlaneGeometry(5.45, 3.65)),
      mat(std({ map: track(pcbTexture(label, seed)), transparent: true, roughness: 0.35, metalness: 0.4 }))
    );
    traces.rotation.x = -Math.PI / 2;
    traces.position.y = 0.062;
    g.add(traces);
  }

  // 0 · Carcasa
  makePart(1.25, 4.3, (g, mat) => {
    const shell = new THREE.Mesh(
      geo(new RoundedBoxGeometry(6.4, 2.4, 4.6, 6, 0.5)),
      mat(
        // Vidrio "barato" (sin transmission) para que ande fluido en notebooks sin placa de video.
        new THREE.MeshPhysicalMaterial({
          color: '#bfe8cf',
          roughness: 0.12,
          metalness: 0,
          clearcoat: 1,
          clearcoatRoughness: 0.06,
          emissive: '#0f3d24',
          emissiveIntensity: 0.35,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      )
    );
    (shell.material as THREE.Material).userData.baseOpacity = 0.3;
    g.add(shell);
    const logo = new THREE.Mesh(
      geo(new THREE.RingGeometry(0.42, 0.54, 6)),
      mat(std({ color: '#4ade80', emissive: '#22c55e', emissiveIntensity: 1.4, side: THREE.DoubleSide }))
    );
    logo.rotation.x = -Math.PI / 2;
    logo.rotation.z = Math.PI / 6;
    logo.position.y = 1.205;
    g.add(logo);
    const screwMat = mat(std({ color: '#c9cfd4', metalness: 1, roughness: 0.3 }));
    for (const [x, z] of [
      [-2.75, -1.85],
      [2.75, -1.85],
      [-2.75, 1.85],
      [2.75, 1.85],
    ]) {
      const screw = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 20)), screwMat);
      screw.position.set(x, 1.2, z);
      g.add(screw);
    }
  });

  // 1 · GPS
  makePart(1.86, 2.75, (g, mat) => {
    addBoard(g, mat, 'GPS · NEO-6M', 11);
    const patch = new THREE.Mesh(geo(new RoundedBoxGeometry(1.9, 0.32, 1.9, 2, 0.06)), mat(std({ color: '#dcc9a0', roughness: 0.85 })));
    patch.position.set(0.6, 0.22, -0.1);
    g.add(patch);
    const silver = new THREE.Mesh(geo(new THREE.BoxGeometry(1.05, 0.03, 1.05)), mat(std({ color: '#d7dcdf', metalness: 1, roughness: 0.25 })));
    silver.position.set(0.6, 0.39, -0.1);
    g.add(silver);
    const feed = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16)), mat(std({ color: '#7d848b', metalness: 1, roughness: 0.4 })));
    feed.position.set(0.82, 0.41, -0.3);
    g.add(feed);
    const chip = new THREE.Mesh(geo(new RoundedBoxGeometry(1.1, 0.16, 1.1, 2, 0.03)), mat(std({ color: '#16191d', roughness: 0.45, metalness: 0.3 })));
    chip.position.set(-1.6, 0.14, 0.2);
    g.add(chip);
    const pinMat = mat(std({ color: '#d4a64a', metalness: 1, roughness: 0.3 }));
    for (let i = 0; i < 4; i++) {
      const pin = new THREE.Mesh(geo(new THREE.BoxGeometry(0.16, 0.22, 0.16)), pinMat);
      pin.position.set(2.45, 0.17, -0.9 + i * 0.6);
      g.add(pin);
    }
  });

  // 2 · Radio LoRa (con antena helicoidal)
  makePart(1.5, 1.45, (g, mat) => {
    addBoard(g, mat, 'LoRa · SX1262', 23);
    const metal = mat(std({ color: '#d4dade', metalness: 1, roughness: 0.26 }));
    const shield = new THREE.Mesh(geo(new RoundedBoxGeometry(2.1, 0.26, 1.8, 2, 0.04)), metal);
    shield.position.set(-1.1, 0.19, 0.1);
    g.add(shield);
    const crystal = new THREE.Mesh(geo(new THREE.CapsuleGeometry(0.12, 0.35, 4, 12)), metal);
    crystal.rotation.z = Math.PI / 2;
    crystal.position.set(0.55, 0.15, -0.9);
    g.add(crystal);
    const gold = mat(std({ color: '#d4a64a', metalness: 1, roughness: 0.28 }));
    const ufl = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 20)), gold);
    ufl.position.set(0.75, 0.13, 0.9);
    g.add(ufl);
    const copper = mat(std({ color: '#c8782e', metalness: 1, roughness: 0.3 }));
    const coax = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.75, 0.2, 0.9),
      new THREE.Vector3(1.4, 0.35, 1.2),
      new THREE.Vector3(1.9, 0.3, 1.45),
    ]);
    g.add(new THREE.Mesh(geo(new THREE.TubeGeometry(coax, 24, 0.045, 8)), gold));
    class Helix extends THREE.Curve<THREE.Vector3> {
      constructor() {
        super();
      }
      getPoint(t: number, target = new THREE.Vector3()) {
        const turns = 9;
        const a = t * Math.PI * 2 * turns;
        return target.set(-1.2 + t * 3.1, 0.38 + Math.cos(a) * 0.2, 1.45 + Math.sin(a) * 0.2);
      }
    }
    const helix = new THREE.Mesh(geo(new THREE.TubeGeometry(new Helix(), 400, 0.04, 8)), copper);
    g.add(helix);
  });

  // 3 · Cerebro (XIAO ESP32-S3)
  makePart(1.12, 0.2, (g, mat) => {
    addBoard(g, mat, 'XIAO ESP32-S3', 37);
    const xiao = new THREE.Mesh(geo(new RoundedBoxGeometry(2.3, 0.12, 1.9, 2, 0.05)), mat(std({ color: '#17212b', roughness: 0.45, metalness: 0.2 })));
    xiao.position.set(0, 0.12, 0);
    g.add(xiao);
    const shield = new THREE.Mesh(geo(new RoundedBoxGeometry(1.3, 0.22, 1.1, 2, 0.03)), mat(std({ color: '#d7dde1', metalness: 1, roughness: 0.22 })));
    shield.position.set(0.15, 0.27, 0.05);
    g.add(shield);
    const usb = new THREE.Mesh(geo(new RoundedBoxGeometry(0.55, 0.2, 0.36, 2, 0.08)), mat(std({ color: '#c3c9ce', metalness: 1, roughness: 0.3 })));
    usb.position.set(-1.1, 0.26, 0);
    g.add(usb);
    const pad = mat(std({ color: '#d4a64a', metalness: 1, roughness: 0.3 }));
    for (let i = 0; i < 7; i++) {
      for (const z of [-0.9, 0.9]) {
        const p = new THREE.Mesh(geo(new THREE.BoxGeometry(0.16, 0.13, 0.1)), pad);
        p.position.set(-0.9 + i * 0.3, 0.13, z);
        g.add(p);
      }
    }
    const chipMat = mat(std({ color: '#121417', roughness: 0.5, metalness: 0.3 }));
    for (const [x, z, w] of [
      [2.0, -1.1, 0.7],
      [2.0, 1.0, 0.5],
      [-2.1, 1.2, 0.45],
    ]) {
      const c = new THREE.Mesh(geo(new THREE.BoxGeometry(w, 0.1, w)), chipMat);
      c.position.set(x, 0.11, z);
      g.add(c);
    }
  });

  // 4 · Aviso: buzzer + LED
  let ledLight: THREE.PointLight | null = null;
  makePart(0.7, -1.05, (g, mat) => {
    addBoard(g, mat, 'BUZZER · LED', 53);
    const buzzer = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.95, 0.95, 0.32, 48)), mat(std({ color: '#141619', roughness: 0.6, metalness: 0.2 })));
    buzzer.position.set(-1.2, 0.22, 0);
    g.add(buzzer);
    const ring = new THREE.Mesh(geo(new THREE.TorusGeometry(0.6, 0.03, 8, 48)), mat(std({ color: '#2a2f35', roughness: 0.5 })));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(-1.2, 0.385, 0);
    g.add(ring);
    const hole = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 24)), mat(std({ color: '#030304', roughness: 1 })));
    hole.position.set(-1.2, 0.39, 0);
    g.add(hole);
    const ledMat = mat(std({ color: '#4ade80', emissive: '#22c55e', emissiveIntensity: 2.6, roughness: 0.2 }));
    const ledBody = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.17, 0.17, 0.3, 24)), ledMat);
    ledBody.position.set(1.3, 0.21, -0.7);
    g.add(ledBody);
    const dome = new THREE.Mesh(geo(new THREE.SphereGeometry(0.17, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), ledMat);
    dome.position.set(1.3, 0.36, -0.7);
    g.add(dome);
    ledLight = new THREE.PointLight('#4ade80', 3, 3.5, 2);
    ledLight.position.set(1.3, 0.7, -0.7);
    g.add(ledLight);
    const resMat = mat(std({ color: '#d9c7a1', roughness: 0.6 }));
    for (const z of [0.5, 1.1]) {
      const r = new THREE.Mesh(geo(new THREE.CapsuleGeometry(0.1, 0.45, 4, 12)), resMat);
      r.rotation.z = Math.PI / 2;
      r.position.set(1.4, 0.16, z);
      g.add(r);
    }
  });

  // 5 · Batería LiPo
  makePart(0.28, -2.3, (g, mat) => {
    const pouch = new THREE.Mesh(geo(new RoundedBoxGeometry(5.2, 0.36, 3.4, 4, 0.14)), mat(std({ color: '#c6ccd1', metalness: 0.9, roughness: 0.33 })));
    pouch.position.y = 0.18;
    g.add(pouch);
    const label = new THREE.Mesh(
      geo(new THREE.PlaneGeometry(3.6, 1.5)),
      mat(
        std({
          map: track(
            canvasTexture(360, 150, (ctx) => {
              ctx.scale(0.5, 0.5);
              ctx.fillStyle = '#141917';
              ctx.fillRect(0, 0, 720, 300);
              ctx.fillStyle = '#ecf2ee';
              ctx.font = '700 76px system-ui, sans-serif';
              ctx.fillText('LiPo 3.7 V', 46, 140);
              ctx.fillStyle = '#ffc107';
              ctx.font = '600 46px ui-monospace, Menlo, monospace';
              ctx.fillText('1000 mAh', 50, 230);
            })
          ),
          roughness: 0.6,
        })
      )
    );
    label.rotation.x = -Math.PI / 2;
    label.position.set(-0.3, 0.365, 0);
    g.add(label);
    const red = mat(std({ color: '#e04545', roughness: 0.5 }));
    const black = mat(std({ color: '#1b1d20', roughness: 0.5 }));
    const wire = (z: number, m: THREE.Material) =>
      new THREE.Mesh(
        geo(
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3([new THREE.Vector3(2.6, 0.2, z), new THREE.Vector3(3.1, 0.3, z), new THREE.Vector3(3.3, 0.7, z * 0.6)]),
            20,
            0.05,
            8
          )
        ),
        m
      );
    g.add(wire(0.25, red), wire(-0.05, black));
  });

  // 6 · Correa + sensor de temperatura
  makePart(0, -3.6, (g, mat) => {
    const R = 12;
    const strapGeo = geo(new THREE.BoxGeometry(14, 0.16, 2.6, 180, 1, 1));
    const pos = strapGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const th = x / R;
      const r = R + y;
      pos.setXYZ(i, r * Math.sin(th), r * Math.cos(th) - R, pos.getZ(i));
    }
    strapGeo.computeVertexNormals();
    const strapTex = track(
      canvasTexture(1024, 190, (ctx) => {
        ctx.scale(0.5, 0.5);
        ctx.fillStyle = '#17191b';
        ctx.fillRect(0, 0, 2048, 380);
        ctx.strokeStyle = 'rgba(255,255,255,0.035)';
        ctx.lineWidth = 3;
        for (let x = -400; x < 2048; x += 14) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + 380, 380);
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(160,170,176,0.55)';
        ctx.lineWidth = 6;
        ctx.setLineDash([26, 18]);
        for (const y of [34, 346]) {
          ctx.beginPath();
          ctx.moveTo(20, y);
          ctx.lineTo(2028, y);
          ctx.stroke();
        }
      })
    );
    const strap = new THREE.Mesh(strapGeo, mat(std({ map: strapTex, roughness: 0.92, metalness: 0.05 })));
    g.add(strap);

    const onStrap = (x: number, lift: number) => {
      const th = x / R;
      return { pos: new THREE.Vector3((R + lift) * Math.sin(th), (R + lift) * Math.cos(th) - R, 0), rot: -th };
    };
    const holeMat = mat(std({ color: '#050607', roughness: 1 }));
    for (let i = 0; i < 4; i++) {
      const { pos: p, rot } = onStrap(4.1 + i * 0.65, 0.085);
      const hole = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 20)), holeMat);
      hole.position.copy(p);
      hole.rotation.z = rot;
      g.add(hole);
    }
    const buckleMat = mat(std({ color: '#c9cfd4', metalness: 1, roughness: 0.25 }));
    const { pos: bp, rot: br } = onStrap(-6.85, 0);
    const buckle = new THREE.Mesh(geo(new THREE.TorusGeometry(1.55, 0.11, 12, 4)), buckleMat);
    buckle.rotation.set(Math.PI / 2, 0, Math.PI / 4);
    const buckleWrap = new THREE.Group();
    buckleWrap.add(buckle);
    buckleWrap.scale.set(0.42, 1, 1);
    buckleWrap.position.copy(bp);
    buckleWrap.rotation.z = br;
    g.add(buckleWrap);

    const steel = mat(new THREE.MeshPhysicalMaterial({ color: '#dfe4e7', metalness: 1, roughness: 0.18, clearcoat: 0.6 }));
    const { pos: cp, rot: cr } = onStrap(-3.3, 0.3);
    const capsule = new THREE.Mesh(geo(new THREE.CapsuleGeometry(0.24, 0.95, 8, 24)), steel);
    capsule.position.copy(cp);
    capsule.rotation.z = cr + Math.PI / 2;
    g.add(capsule);
    const cable = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cp.x + 0.75, cp.y, 0),
      new THREE.Vector3(-1.9, 0.35, 0.4),
      new THREE.Vector3(-0.9, 0.25, 0.8),
    ]);
    g.add(new THREE.Mesh(geo(new THREE.TubeGeometry(cable, 30, 0.07, 8)), mat(std({ color: '#1f2226', roughness: 0.6 }))));
    return capsule;
  });

  // Sombra suave debajo del collar
  const shadowTex = track(
    canvasTexture(256, 256, (ctx) => {
      const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, 'rgba(34,197,94,0.32)');
      grad.addColorStop(0.5, 'rgba(34,197,94,0.08)');
      grad.addColorStop(1, 'rgba(34,197,94,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
    })
  );
  const shadow = new THREE.Mesh(
    geo(new THREE.PlaneGeometry(20, 12)),
    track(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }))
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  // ── Estado ──────────────────────────────────────────────────────────────
  let progress = options.staticProgress ?? 0;
  let shown = progress;
  let running = true;
  let width = 1;
  let height = 1;
  let raf = 0;
  const start = performance.now();
  let last = start;
  const target = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const isStatic = options.staticProgress !== undefined;

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const t = (now - start) / 1000;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    // Lenis ya suaviza el scroll: acá solo un amortiguado corto e independiente de los FPS.
    shown = lerp(shown, progress, 1 - Math.exp(-dt * 18));
    const p = shown;

    const explode = isStatic ? 1 : smooth(0.02, 0.12, p) * (1 - smooth(0.84, 0.97, p));
    const focus = isStatic ? 0 : smooth(0.08, 0.13, p) * (1 - smooth(0.78, 0.85, p));
    const centerIdx = (p - INTRO_END) / PART_SPAN - 0.5;

    let active = -1;
    let bestW = 0;
    let focusY = 0;

    parts.forEach((part, i) => {
      // Las piezas de arriba se separan primero.
      const e = smooth(i * 0.06, 0.6 + i * 0.06, explode);
      const float = Math.sin(t * 1.1 + i * 0.9) * 0.04 * explode;
      const y = lerp(part.assembledY, part.explodedY, e) + float;
      part.group.position.y = y;
      part.group.rotation.y = Math.sin(t * 0.5 + i) * 0.015 * explode;

      const w = clamp(1 - Math.abs(centerIdx - i) * 1.35);
      const opacity = lerp(1, lerp(0.13, 1, w), focus);
      for (const m of part.materials) m.opacity = opacity * (m.userData.baseOpacity as number);
      (part.outline.material as THREE.LineBasicMaterial).opacity = w * focus * 0.9;
      const s = 1 + w * focus * 0.04;
      part.group.scale.setScalar(s);

      if (w * focus > bestW) {
        bestW = w * focus;
        active = i;
        focusY = y;
      }
    });

    if (ledLight) ledLight.intensity = 2 + Math.sin(t * 6) * 1.2;
    shadow.position.y = lerp(-0.7, -5.2, explode);
    (shadow.material as THREE.MeshBasicMaterial).opacity = lerp(1, 0.75, explode);

    // Cámara: órbita suave con el scroll; se aleja al abrirse y sigue a la pieza activa.
    const aspect = width / height;
    const fit = aspect < 1 ? 1.1 / aspect : aspect < 1.3 ? 1.25 : 1;
    const radius = lerp(24, 29, explode) * fit;
    const azimuth = isStatic ? -0.55 : lerp(-0.85, 0.55, p) + Math.sin(t * 0.25) * 0.03;
    const elevation = lerp(0.5, 0.42, explode);
    target.set(0, lerp(1.1, 0.4, explode), 0);
    target.y = lerp(target.y, focusY + 0.4, focus * 0.28);
    camera.position.set(
      target.x + radius * Math.cos(elevation) * Math.sin(azimuth),
      target.y + radius * Math.sin(elevation),
      target.z + radius * Math.cos(elevation) * Math.cos(azimuth)
    );
    camera.lookAt(target);

    renderer.render(scene, camera);

    if (options.onFrame) {
      let x = 0;
      let y = 0;
      if (active >= 0) {
        tmp.copy(parts[active].anchor);
        parts[active].group.localToWorld(tmp);
        tmp.project(camera);
        x = (tmp.x * 0.5 + 0.5) * width;
        y = (-tmp.y * 0.5 + 0.5) * height;
      }
      options.onFrame({ active, visibility: bestW, x, y });
    }
  }
  raf = requestAnimationFrame(frame);

  return {
    setProgress(p: number) {
      progress = clamp(p);
    },
    resize(w: number, h: number) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // En pantallas verticales el texto ocupa la parte de abajo: subimos el collar.
      if (width / height < 1) camera.setViewOffset(width, height, 0, height * 0.17, width, height);
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    },
    setRunning(r: boolean) {
      if (running === r) return;
      running = r;
      if (running) {
        last = performance.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
      } else {
        cancelAnimationFrame(raf);
      }
    },
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      for (const d of disposables) d.dispose();
      renderer.dispose();
    },
  };
}
