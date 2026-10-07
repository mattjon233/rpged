import * as THREE from '../vendor/three.min.js';
import { drawPortrait } from './portrait.js';

export { THREE };

export const NEON = { red: '#ff1f3d', cyan: '#1ef2ff', yellow: '#fcee0a', magenta: '#ff2bd6', green: '#3dff9a', orange: '#ff8a3d', violet: '#a06bff', ice: '#dff6ff', lamp: '#ffd9a8' };

const UP = new THREE.Vector3(0, 1, 0);
const tmp = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), p: new THREE.Vector3(), v: new THREE.Vector3(), n: new THREE.Vector3(), nm: new THREE.Matrix3(), c: new THREE.Color() };

const flat = (geometry) => (geometry.index ? geometry.toNonIndexed() : geometry);
const BOX = flat(new THREE.BoxGeometry(1, 1, 1));
const cylinders = new Map();
const cylinderOf = (top, bottom, sides) => {
  const key = `${top}|${bottom}|${sides}`;
  if (!cylinders.has(key)) cylinders.set(key, flat(new THREE.CylinderGeometry(top, bottom, 1, sides)));
  return cylinders.get(key);
};

export const mulberry = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

class Batch {
  constructor() {
    this.position = [];
    this.normal = [];
    this.color = [];
    this.origin = [];
    this.axis = [];
    this.delay = [];
  }

  add(geometry, matrix, color, gain, pop) {
    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    tmp.nm.getNormalMatrix(matrix);
    tmp.c.set(color).multiplyScalar(gain);
    for (let i = 0; i < positions.count; i += 1) {
      tmp.v.fromBufferAttribute(positions, i).applyMatrix4(matrix);
      tmp.n.fromBufferAttribute(normals, i).applyMatrix3(tmp.nm).normalize();
      this.position.push(tmp.v.x, tmp.v.y, tmp.v.z);
      this.normal.push(tmp.n.x, tmp.n.y, tmp.n.z);
      this.color.push(tmp.c.r, tmp.c.g, tmp.c.b);
      this.origin.push(pop.x, pop.y, pop.z);
      this.axis.push(pop.ax, pop.ay, pop.az);
      this.delay.push(pop.delay);
    }
  }

  get empty() {
    return this.position.length === 0;
  }

  build() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normal, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 3));
    geometry.setAttribute('aOrigin', new THREE.Float32BufferAttribute(this.origin, 3));
    geometry.setAttribute('aAxis', new THREE.Float32BufferAttribute(this.axis, 3));
    geometry.setAttribute('aDelay', new THREE.Float32BufferAttribute(this.delay, 1));
    geometry.computeBoundingSphere();
    return geometry;
  }
}

export class Kit {
  constructor() {
    this.lit = new Batch();
    this.glow = new Batch();
    this.glass = new Batch();
    this.pop = { x: 0, y: 0, z: 0, ax: 1, ay: 1, az: 1, delay: 0 };
    this.spots = [];
  }

  at(x, z, delay = 0, rise = false, y = 0) {
    this.pop = { x, y, z, ax: rise ? 0 : 1, ay: 1, az: rise ? 0 : 1, delay };
    return this;
  }

  put(batch, geometry, w, h, d, x, y, z, color, gain, ry) {
    tmp.m.compose(tmp.p.set(x, y, z), tmp.q.setFromAxisAngle(UP, ry), tmp.s.set(w, h, d));
    batch.add(geometry, tmp.m, color, gain, this.pop);
    return this;
  }

  box(w, h, d, x, y, z, color, ry = 0) {
    return this.put(this.lit, BOX, w, h, d, x, y, z, color, 1, ry);
  }

  lamp(w, h, d, x, y, z, color, gain = 2, ry = 0) {
    return this.put(this.glow, BOX, w, h, d, x, y, z, color, gain, ry);
  }

  pane(w, h, d, x, y, z, color, ry = 0) {
    return this.put(this.glass, BOX, w, h, d, x, y, z, color, 1, ry);
  }

  cyl(radius, h, x, y, z, color, sides = 14, top = radius) {
    return this.put(this.lit, cylinderOf(top, radius, sides), 1, h, 1, x, y, z, color, 1, 0);
  }

  disc(radius, h, x, y, z, color, gain = 2, sides = 14) {
    return this.put(this.glow, cylinderOf(radius, radius, sides), 1, h, 1, x, y, z, color, gain, 0);
  }

  spot(x, z, size, color, gain = 0.3, flicker = false) {
    this.spots.push({ x, z, size, color, gain, flicker, delay: this.pop.delay });
    return this;
  }
}

const POP_HEAD = /* glsl */ `
  attribute vec3 aOrigin;
  attribute vec3 aAxis;
  attribute float aDelay;
  uniform float uReveal;
`;

const POP_BODY = /* glsl */ `
  float popK = clamp((uReveal - aDelay) / 0.6, 0.0, 1.0);
  float popE = 1.0 - pow(1.0 - popK, 3.0);
  popE += sin(popK * 3.14159265) * 0.16 * (1.0 - popK);
  transformed = aOrigin + (transformed - aOrigin) * mix(vec3(1.0), vec3(popE), aAxis);
`;

export const popIn = (material, reveal) => {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uReveal = reveal;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${POP_HEAD}`).replace('#include <begin_vertex>', `#include <begin_vertex>\n${POP_BODY}`);
  };
  material.customProgramCacheKey = () => 'pop-in';
  return material;
};

export const meshesOf = (kit, reveal) => {
  const group = new THREE.Group();
  const lit = new THREE.Mesh(kit.lit.build(), popIn(new THREE.MeshLambertMaterial({ vertexColors: true }), reveal));
  const glow = new THREE.Mesh(kit.glow.build(), popIn(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), reveal));
  group.add(lit, glow);
  if (!kit.glass.empty) {
    const glass = new THREE.Mesh(kit.glass.build(), popIn(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.13, depthWrite: false, toneMapped: false }), reveal));
    glass.renderOrder = 2;
    group.add(glass);
  }
  return group;
};

const canvasTexture = (width, height, draw) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

export const glowTexture = () =>
  canvasTexture(128, 128, (ctx, size) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.22, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.14)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });

export const staticTexture = () => {
  const random = mulberry(41);
  const texture = canvasTexture(64, 64, (ctx, size) => {
    ctx.fillStyle = '#0b060c';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 2) {
      for (let x = 0; x < size; x += 2) {
        const value = random();
        if (value < 0.72) continue;
        ctx.fillStyle = value > 0.97 ? 'rgba(255,60,90,0.9)' : `rgba(190,170,200,${(value - 0.6) * 0.9})`;
        ctx.fillRect(x, y, value > 0.9 ? 6 : 2, 2);
      }
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  return texture;
};

const windowsTexture = () => {
  const random = mulberry(7);
  const texture = canvasTexture(64, 128, (ctx, w, h) => {
    ctx.fillStyle = '#05040a';
    ctx.fillRect(0, 0, w, h);
    for (let y = 5; y < h; y += 10) {
      for (let x = 4; x < w; x += 10) {
        const value = random();
        if (value < 0.78) continue;
        ctx.fillStyle = value > 0.985 ? '#1ef2ff' : value > 0.97 ? '#ff2bd6' : value > 0.9 ? '#ffd9a8' : '#6b332f';
        ctx.fillRect(x, y, 5, 4);
      }
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  return texture;
};

const GRID_VERTEX = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const GRID_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vWorld;
  void main() {
    vec2 cell = abs(fract(vWorld) - 0.5);
    float line = smoothstep(0.47, 0.5, max(cell.x, cell.y));
    vec2 major = abs(fract(vWorld / 5.0) - 0.5);
    float majorLine = smoothstep(0.488, 0.5, max(major.x, major.y));
    float alpha = max(line * uOpacity, majorLine * uOpacity * 1.6);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export const makeGrid = (w, h, color = NEON.red, opacity = 0.16) => {
  const material = new THREE.ShaderMaterial({ vertexShader: GRID_VERTEX, fragmentShader: GRID_FRAGMENT, transparent: true, depthWrite: false, uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } } });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), material);
  mesh.position.set(w / 2, 0.006, h / 2);
  mesh.renderOrder = 2;
  return mesh;
};

const RAIN_VERTEX = /* glsl */ `
  attribute float aSeed;
  attribute float aStart;
  attribute float aOffset;
  uniform float uTime;
  uniform float uHeight;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float base = mod(aStart - uTime * (9.0 + aSeed * 5.0), uHeight);
    p.y = base + aOffset;
    p.x += base * 0.12;
    vAlpha = smoothstep(0.0, 1.5, base) * (0.18 + aSeed * 0.22);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const RAIN_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(uColor, vAlpha);
  }
`;

export const makeRain = (w, h, count, dry = () => false) => {
  const random = mulberry(77);
  const height = 6;
  const margin = 8;
  const spots = Array.from({ length: count }, () => ({ x: random() * (w + margin * 2) - margin, z: random() * (h + margin * 2) - margin, start: random() * height, seed: random() })).filter((spot) => !dry(spot.x, spot.z));
  const positions = new Float32Array(spots.length * 6);
  const seeds = new Float32Array(spots.length * 2);
  const starts = new Float32Array(spots.length * 2);
  const offsets = new Float32Array(spots.length * 2);
  spots.forEach(({ x, z, start, seed }, i) => {
    positions.set([x, 0, z, x - 0.03, 0, z], i * 6);
    seeds.set([seed, seed], i * 2);
    starts.set([start, start], i * 2);
    offsets.set([0, 0.3 + seed * 0.15], i * 2);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aStart', new THREE.BufferAttribute(starts, 1));
  geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1));
  const material = new THREE.ShaderMaterial({
    vertexShader: RAIN_VERTEX,
    fragmentShader: RAIN_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uHeight: { value: height }, uColor: { value: new THREE.Color('#8ff9ff') } },
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  return lines;
};

export const makeSkyline = (w, h) => {
  const random = mulberry(1907 + w * 7 + h);
  const buildings = [];
  const ring = (inner, outer, count, tallest) => {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const distance = inner + random() * (outer - inner);
      buildings.push({ x: w / 2 + Math.cos(angle) * (w / 2 + distance), z: h / 2 + Math.sin(angle) * (h / 2 + distance), sx: 3 + random() * 6, sz: 3 + random() * 6, height: 6 + random() * tallest });
    }
  };
  ring(12, 24, 60, 16);
  ring(24, 55, 80, 42);
  const texture = windowsTexture();
  texture.repeat.set(1, 3);
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ map: texture, color: new THREE.Color(0.6, 0.6, 0.6) }), buildings.length);
  buildings.forEach((b, i) => mesh.setMatrixAt(i, tmp.m.makeScale(b.sx, b.height, b.sz).setPosition(b.x, b.height / 2 - 0.15, b.z)));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
};

export const makeGlows = (spots) => {
  const material = new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), material, Math.max(1, spots.length));
  const colors = spots.map((spot) => new THREE.Color(spot.color).multiplyScalar(spot.gain * 0.9));
  spots.forEach((spot, i) => mesh.setMatrixAt(i, tmp.m.makeScale(spot.size, 1, spot.size).setPosition(spot.x, 0.012 + i * 0.00002, spot.z)));
  mesh.count = spots.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  const update = (time, reveal) => {
    spots.forEach((spot, i) => {
      const on = Math.min(1, Math.max(0, (reveal - spot.delay - 0.2) / 0.7));
      const flicker = spot.flicker ? 0.8 + Math.sin(time * 13 + i) * 0.1 + Math.sin(time * 29 + i * 3) * 0.1 : 1;
      mesh.setColorAt(i, tmp.c.copy(colors[i]).multiplyScalar(on * flicker));
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  update(0, 0);
  return { mesh, update };
};

const WOOD = '#4b3020';
const DARK = '#18151c';
const METAL = '#262a31';
const STEEL = '#59616b';
const RUBBER = '#0b0b0d';

export const PROPS = {
  crate: (k, x, z, size = 0.78, ry = 0) => k.box(size, size, size, x, size / 2, z, WOOD, ry).box(size * 1.04, 0.06, size * 1.04, x, size - 0.08, z, '#5d3c28', ry),
  container: (k, x, z, color, alongX = true, y = 0) => {
    const [w, d] = alongX ? [2.9, 1] : [1, 2.9];
    k.box(w, 1.15, d, x, y + 0.58, z, color);
    for (let i = -4; i <= 4; i += 1) alongX ? k.box(0.07, 1.17, d + 0.03, x + i * 0.32, y + 0.58, z, '#0d0b10') : k.box(w + 0.03, 1.17, 0.07, x, y + 0.58, z + i * 0.32, '#0d0b10');
    return k;
  },
  barrel: (k, x, z, color = '#2a3038') => k.cyl(0.27, 0.8, x, 0.4, z, color).cyl(0.285, 0.04, x, 0.6, z, STEEL).cyl(0.285, 0.04, x, 0.22, z, STEEL),
  fireBarrel: (k, x, z) => PROPS.barrel(k, x, z, '#3a2118').disc(0.22, 0.05, x, 0.82, z, '#ff6a1a', 2.6).disc(0.12, 0.2, x, 0.9, z, '#ffd23d', 3).spot(x, z, 5.5, '#ff6a1a', 0.42, true),
  table: (k, x, z, w = 1.4, d = 0.8) => {
    k.box(w, 0.06, d, x, 0.72, z, '#2a2730');
    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => k.box(0.06, 0.7, 0.06, x + sx * (w / 2 - 0.08), 0.35, z + sz * (d / 2 - 0.08), METAL)));
    return k;
  },
  stool: (k, x, z, color = '#5a0d1d') => k.cyl(0.05, 0.55, x, 0.28, z, METAL, 6).cyl(0.17, 0.08, x, 0.6, z, color, 10),
  counter: (k, x, z, length, color, alongX = true) => {
    const [w, d] = alongX ? [length, 0.55] : [0.55, length];
    k.box(w, 0.95, d, x, 0.475, z, DARK).box(w + 0.1, 0.07, d + 0.12, x, 0.99, z, '#2e2a34');
    alongX ? k.lamp(length - 0.1, 0.045, 0.03, x, 0.86, z + d / 2 + 0.02, color, 2.2) : k.lamp(0.03, 0.045, length - 0.1, x + w / 2 + 0.02, 0.86, z, color, 2.2);
    return k;
  },
  shelf: (k, x, z, length) => {
    k.box(length, 1.5, 0.22, x, 0.75, z, '#14121a');
    const colors = [NEON.cyan, NEON.magenta, NEON.yellow, NEON.green, NEON.orange];
    for (let row = 0; row < 2; row += 1) for (let i = 0; i < Math.floor(length / 0.22); i += 1) k.lamp(0.07, 0.2, 0.07, x - length / 2 + 0.16 + i * 0.22, 0.7 + row * 0.42, z + 0.13, colors[(i * 3 + row) % colors.length], 1.5);
    return k;
  },
  sofa: (k, x, z, ry = 0) => {
    const cos = Math.cos(ry);
    const sin = Math.sin(ry);
    return k.box(1.8, 0.42, 0.75, x, 0.21, z, '#5a0d1d', ry).box(1.8, 0.5, 0.2, x - sin * 0.3, 0.6, z - cos * 0.3, '#47091a', ry);
  },
  booth: (k, x, z, color) =>
    k
      .box(0.7, 0.95, 1.7, x, 0.475, z, DARK)
      .lamp(0.03, 0.4, 1.4, x + 0.37, 0.55, z, color, 2)
      .lamp(0.5, 0.03, 0.3, x, 0.97, z - 0.4, NEON.yellow, 1.6)
      .lamp(0.5, 0.03, 0.3, x, 0.97, z + 0.4, NEON.magenta, 1.6),
  speaker: (k, x, z, color) =>
    k
      .box(0.6, 1.25, 0.6, x, 0.625, z, '#0f0d13')
      .lamp(0.03, 0.34, 0.34, x + 0.31, 0.85, z, color, 1.8)
      .lamp(0.03, 0.2, 0.2, x + 0.31, 0.38, z, color, 1.2),
  gurney: (k, x, z) => {
    k.box(0.85, 0.12, 1.9, x, 0.62, z, '#9aa3ab').box(0.75, 0.1, 0.4, x, 0.72, z - 0.68, '#d7dce0');
    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => k.box(0.05, 0.56, 0.05, x + sx * 0.36, 0.28, z + sz * 0.85, STEEL)));
    return k;
  },
  monitor: (k, x, z, color) =>
    k
      .box(0.06, 1.25, 0.06, x, 0.625, z, STEEL)
      .box(0.52, 0.38, 0.08, x, 1.32, z, '#0c0e12')
      .lamp(0.44, 0.3, 0.02, x, 1.32, z + 0.05, color, 1.6),
  cabinet: (k, x, z, ry = 0) => k.box(0.9, 1.4, 0.45, x, 0.7, z, METAL, ry).lamp(0.08, 0.04, 0.02, x + Math.cos(ry) * 0.3, 1.2, z + 0.24, NEON.green, 2),
  rack: (k, x, z, color = NEON.green) => {
    k.box(0.7, 1.7, 0.7, x, 0.85, z, '#101116');
    [0.45, 0.8, 1.15, 1.45].forEach((y, i) => k.lamp(0.5, 0.035, 0.02, x, y, z + 0.36, i % 2 ? NEON.cyan : color, 2));
    return k;
  },
  desk: (k, x, z, color = NEON.cyan) =>
    k
      .box(1.5, 0.08, 0.7, x, 0.74, z, '#2a2730')
      .box(0.08, 0.72, 0.6, x - 0.66, 0.36, z, METAL)
      .box(0.08, 0.72, 0.6, x + 0.66, 0.36, z, METAL)
      .box(0.5, 0.36, 0.05, x, 1.02, z - 0.1, '#0c0e12')
      .lamp(0.44, 0.28, 0.02, x, 1.02, z - 0.07, color, 1.5),
  safe: (k, x, z) =>
    k
      .box(0.85, 1.1, 0.8, x, 0.55, z, '#3a3f47')
      .box(0.6, 0.8, 0.04, x, 0.58, z + 0.41, '#22262c')
      .lamp(0.07, 0.07, 0.02, x + 0.18, 0.75, z + 0.44, NEON.green, 2.4)
      .cyl(0.11, 0.05, x - 0.05, 0.55, z + 0.45, STEEL, 10),
  cabinetGame: (k, x, z, color, ry = 0) => {
    const cos = Math.cos(ry);
    const sin = Math.sin(ry);
    k.box(0.78, 1.55, 0.7, x, 0.775, z, '#131019', ry).box(0.8, 0.22, 0.74, x, 1.66, z, '#0c0a10', ry);
    k.lamp(0.6, 0.44, 0.02, x + sin * 0.36, 1.12, z + cos * 0.36, color, 1.7, ry)
      .lamp(0.7, 0.14, 0.02, x + sin * 0.38, 1.66, z + cos * 0.38, color, 2.2, ry)
      .lamp(0.5, 0.03, 0.16, x + sin * 0.3, 0.72, z + cos * 0.3, NEON.ice, 0.8, ry);
    return k.spot(x + sin * 0.9, z + cos * 0.9, 2.3, color, 0.16);
  },
  claw: (k, x, z) =>
    k.box(0.9, 0.7, 0.9, x, 0.35, z, '#1a0f1e').pane(0.86, 0.9, 0.86, x, 1.15, z, NEON.magenta).box(0.94, 0.1, 0.94, x, 1.65, z, '#1a0f1e').lamp(0.9, 0.04, 0.9, x, 0.72, z, NEON.magenta, 1.4).spot(x, z, 2.6, NEON.magenta, 0.2),
  vending: (k, x, z, color, ry = 0) => {
    const cos = Math.cos(ry);
    const sin = Math.sin(ry);
    return k
      .box(0.9, 1.7, 0.7, x, 0.85, z, '#111319', ry)
      .lamp(0.74, 1.3, 0.02, x + sin * 0.36, 0.95, z + cos * 0.36, color, 1, ry)
      .spot(x + sin * 1.1, z + cos * 1.1, 3.2, color, 0.24);
  },
  bench: (k, x, z) =>
    k
      .box(1.5, 0.08, 0.42, x, 0.44, z, '#2c2a31')
      .box(0.08, 0.44, 0.4, x - 0.6, 0.22, z, METAL)
      .box(0.08, 0.44, 0.4, x + 0.6, 0.22, z, METAL),
  bin: (k, x, z) => k.cyl(0.22, 0.7, x, 0.35, z, '#1d2a25', 10),
  dumpster: (k, x, z, alongX = true) => (alongX ? k.box(1.6, 0.9, 0.85, x, 0.45, z, '#1d3a2d').box(1.66, 0.08, 0.9, x, 0.93, z, '#12251c') : k.box(0.85, 0.9, 1.6, x, 0.45, z, '#1d3a2d').box(0.9, 0.08, 1.66, x, 0.93, z, '#12251c')),
  plant: (k, x, z) => k.cyl(0.2, 0.36, x, 0.18, z, '#2a2730', 8, 0.25).box(0.4, 0.55, 0.4, x, 0.66, z, '#1f4d27', 0.6).box(0.28, 0.4, 0.28, x, 1.02, z, '#2a6a33', 0.2),
  streetLamp: (k, x, z, dx, dz, color = NEON.lamp) =>
    k
      .box(0.09, 2.7, 0.09, x, 1.35, z, '#1a1c21')
      .box(dx ? 0.75 : 0.07, 0.07, dz ? 0.75 : 0.07, x + dx * 0.36, 2.68, z + dz * 0.36, '#1a1c21')
      .lamp(dx ? 0.36 : 0.16, 0.06, dz ? 0.36 : 0.16, x + dx * 0.62, 2.63, z + dz * 0.62, color, 2.4)
      .spot(x + dx * 0.9, z + dz * 0.9, 6.4, color, 0.34),
  sign: (k, x, y, z, length, color, alongX = true, glyphs = 5) => {
    alongX ? k.lamp(length, 0.5, 0.05, x, y, z, color, 1.45) : k.lamp(0.05, 0.5, length, x, y, z, color, 1.45);
    const step = (length - 0.3) / glyphs;
    for (let i = 0; i < glyphs; i += 1) {
      const at = -length / 2 + 0.15 + step * (i + 0.5);
      const w = step * (0.45 + ((i * 7) % 4) * 0.1);
      alongX ? k.box(w, 0.26, 0.07, x + at, y, z, '#0a0508') : k.box(0.07, 0.26, w, x, y, z + at, '#0a0508');
    }
    return k;
  },
};

const CAR_BODY = new THREE.BoxGeometry(1, 1, 1);
const WHEEL = new THREE.CylinderGeometry(0.19, 0.19, 0.14, 12).rotateX(Math.PI / 2);
const wheelMaterial = new THREE.MeshLambertMaterial({ color: RUBBER });
const glassMaterial = new THREE.MeshLambertMaterial({ color: '#0a1a22' });
const headMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(NEON.ice).multiplyScalar(2.6), toneMapped: false });
const tailMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(NEON.red).multiplyScalar(2.6), toneMapped: false });

export const makeCar = (color, glow, { van = false, lights = true } = {}) => {
  const group = new THREE.Group();
  const length = van ? 2.5 : 1.95;
  const part = (geometry, material, w, h, d, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  const paint = new THREE.MeshLambertMaterial({ color });
  part(CAR_BODY, paint, length, van ? 0.62 : 0.4, 0.92, 0, van ? 0.56 : 0.44, 0);
  part(CAR_BODY, van ? paint : glassMaterial, van ? length * 0.72 : length * 0.5, van ? 0.42 : 0.34, 0.82, van ? -0.3 : -0.08, van ? 1.06 : 0.8, 0);
  if (van) part(CAR_BODY, glassMaterial, 0.08, 0.34, 0.8, length * 0.36 - 0.26, 1.02, 0);
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => part(WHEEL, wheelMaterial, 1, 1, 1, sx * (length / 2 - 0.36), 0.19, sz * 0.44)));
  [-1, 1].forEach((sz) => {
    part(CAR_BODY, lights ? headMaterial : glassMaterial, 0.04, 0.1, 0.2, length / 2 + 0.01, 0.46, sz * 0.3);
    part(CAR_BODY, tailMaterial, 0.04, 0.09, 0.22, -length / 2 - 0.01, 0.48, sz * 0.3);
  });
  if (lights) {
    const beam = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 2.6).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(NEON.ice).multiplyScalar(0.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    beam.position.set(length / 2 + 1.7, 0.02, 0);
    beam.renderOrder = 1;
    group.add(beam);
  }
  const under = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 1.5).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(NEON.red).multiplyScalar(0.22), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  under.position.set(-length / 2 - 0.5, 0.02, 0);
  under.renderOrder = 1;
  group.add(under);
  return group;
};

const TOKEN_BASE = new THREE.CylinderGeometry(0.42, 0.44, 0.05, 32);
const TOKEN_RING = new THREE.TorusGeometry(0.42, 0.03, 8, 48).rotateX(Math.PI / 2);
const TOKEN_CARD = new THREE.PlaneGeometry(0.64, 0.8);
const TOKEN_FRAME = new THREE.PlaneGeometry(0.71, 0.87);
const TOKEN_BEAM = new THREE.CylinderGeometry(0.34, 0.42, 2.4, 24, 1, true);
const tokenBaseMaterial = new THREE.MeshLambertMaterial({ color: '#0d0a0f' });

export const makeToken = ({ id, name, color, hair, x, z, hidden = false }) => {
  const group = new THREE.Group();
  const tone = new THREE.Color(color);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: tone.clone().multiplyScalar(1.7), toneMapped: false, fog: false });
  const frameMaterial = new THREE.MeshBasicMaterial({ color: tone.clone().multiplyScalar(1.6), toneMapped: false, side: THREE.DoubleSide, fog: false });
  const face = canvasTexture(128, 160, (ctx, w, h) => drawPortrait(ctx, w, h, { name, color, hair }));
  const cardMaterial = new THREE.MeshBasicMaterial({ map: face, side: THREE.DoubleSide, fog: false });
  const base = new THREE.Mesh(TOKEN_BASE, tokenBaseMaterial);
  base.position.y = 0.025;
  const ring = new THREE.Mesh(TOKEN_RING, ringMaterial);
  ring.position.y = 0.055;
  const standee = new THREE.Group();
  standee.position.y = 0.52;
  const frame = new THREE.Mesh(TOKEN_FRAME, frameMaterial);
  frame.position.z = -0.004;
  standee.add(frame, new THREE.Mesh(TOKEN_CARD, cardMaterial));
  const turn = new THREE.Mesh(TOKEN_RING, new THREE.MeshBasicMaterial({ color: new THREE.Color(NEON.yellow).multiplyScalar(2.6), toneMapped: false, fog: false }));
  turn.position.y = 0.07;
  turn.visible = false;
  const beam = new THREE.Mesh(
    TOKEN_BEAM,
    new THREE.MeshBasicMaterial({ color: tone.clone().multiplyScalar(0.9), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  );
  beam.position.y = 1.2;
  beam.visible = false;
  group.add(base, ring, standee, turn, beam);
  group.position.set(x + 0.5, 0, z + 0.5);
  group.scale.setScalar(0);
  return { id, name, color, tone, group, ring, ringMaterial, frameMaterial, cardMaterial, standee, turn, beam, home: { x, z, hidden }, path: [], speed: 3.2, down: false, shown: !hidden, grow: 0, flash: 0, seed: x * 3 + z };
};

export const makeViewport = (canvas, scene, camera, { lowPower = false, bloom = [0.5, 0.55, 0.55], onResize = () => {} } = {}) => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const composer = new THREE.EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: lowPower ? 0 : 4 }));
  const glow = new THREE.UnrealBloomPass(new THREE.Vector2(4, 4), ...bloom);
  composer.addPass(new THREE.RenderPass(scene, camera));
  composer.addPass(glow);
  composer.addPass(new THREE.OutputPass());
  const size = { width: 1, height: 1, ratio: Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.75) };
  const pace = { slow: 16, frames: 0 };
  const resize = () => {
    const box = canvas.getBoundingClientRect();
    size.width = Math.max(1, Math.round(box.width));
    size.height = Math.max(1, Math.round(box.height));
    camera.aspect = size.width / size.height;
    onResize(size);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(size.ratio);
    renderer.setSize(size.width, size.height, false);
    composer.setPixelRatio(size.ratio);
    composer.setSize(size.width, size.height);
  };
  const tune = (ms) => {
    pace.frames += 1;
    if (pace.frames < 45) return;
    pace.slow = pace.slow * 0.94 + ms * 0.06;
    if (pace.frames % 90 !== 0 || pace.slow < 27) return;
    if (size.ratio > 1) {
      size.ratio = Math.max(1, size.ratio - 0.25);
      resize();
    } else if (glow.enabled && pace.slow > 40) {
      glow.enabled = false;
    } else if (size.ratio > 0.75) {
      size.ratio = 0.75;
      resize();
    }
    pace.slow = 16;
  };
  return { renderer, size, resize, tune, render: () => composer.render() };
};

export const disposeTree = (root) => {
  root.traverse((object) => {
    object.geometry?.dispose?.();
    [].concat(object.material ?? []).forEach((material) => {
      material.map?.dispose?.();
      material.dispose?.();
    });
  });
};
