import { THREE, NEON, Kit, PROPS, meshesOf, makeGrid, makeRain, makeSkyline, makeGlows, makeCar, makeToken, makeViewport, glowTexture, staticTexture } from './world.js';

const ROWS = [
  ',,,,,,,,,,,,,,..,,,,,,,,,,,,,,,,',
  ',NNNNNNNNNNNN,..,BBBBBBBBBBBBBB,',
  ',NttttttttttN,..,Baaaaaaaa#oooB,',
  ',NttttttttttN,..,Baaaaaaaa#oooB,',
  ',NttttttttttN,..,Baaaaaaaa#oooB,',
  ',NttttttttttN,..,BaaaaaaaaDoooB,',
  ',NttttttttttN,..,Baaaaaaaa#oooB,',
  ',NGGGNNNDNNNN,..,BGGGGBDBBBBBBB,',
  ',,,,,,,,,,,,,,xx,,,,,,,,,,,,,,,,',
  '.............x..x...............',
  '.............x..x...............',
  ',,,,,,,,,,,,,,xx,,,,,,,,,,,,,,,,',
  ',PPPPPPDPPPPP,..,FyyyyyyFFFFFFF,',
  ',PmmmmmmmmmmP,..,FyyyyyyyyyyyyF,',
  ',PmmmmmmmmmmP,..,FyyyyyyyyyyyyF,',
  ',PmmmmmmmmmmG,..,FyyyyyyyyyyyyF,',
  ',PmmmmmmmmmmG,..,FyyyyyyyyyyyyF,',
  ',PmmmmmmmmmmP,..,FyyyyyyyyyyyyF,',
  ',PmmmmmmmmmmP,..,FyyyyyyyyyyyyF,',
  ',PPPPPPPPPPPP,..,FFFFFFFFFFFFFF,',
  ',,,,,,,,,,,,,,..,,,,,,,,,,,,,,,,',
  '................................',
];

const W = ROWS[0].length;
const H = ROWS.length;
const FOCUS = { x: 22, z: 8 };

const WALL = {
  N: { color: '#2c1a33', trim: NEON.magenta },
  B: { color: '#35212a', trim: '#ff4a2a' },
  P: { color: '#1c2e3c', trim: NEON.cyan },
  '#': { color: '#2b2630', trim: NEON.red },
  G: { glass: true, trim: NEON.cyan },
};
const WALL_HEIGHT = 1.25;
const FLOOR = { '.': '#23222b', x: '#23222b', ',': '#35333d', t: '#241a2c', a: '#2b1c3a', o: '#3b2a1f', m: '#22343d', y: '#2b2722' };

const cell = (x, z) => (x < 0 || z < 0 || x >= W || z >= H ? ' ' : ROWS[z][x]);
const solid = (ch) => ch in WALL;
const noise = (i) => {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};
const delayOf = (x, z, base, k = 0.03) => base + Math.hypot(x - FOCUS.x, z - FOCUS.z) * k;
const shade = (hex, i) => `#${new THREE.Color(hex).multiplyScalar(0.84 + noise(i) * 0.32).getHexString()}`;

const DOORS = [
  { id: 'front', x: 23, z: 7, alongX: true },
  { id: 'office', x: 26, z: 5, alongX: false },
  { id: 'club', x: 7, z: 7, alongX: true },
  { id: 'clinic', x: 7, z: 12, alongX: true },
];

const FOG_AREA = { x0: 18, x1: 29, z0: 2, z1: 6, wall: 26 };

const CAST = [
  { id: 'nara', name: 'Nara', color: NEON.cyan, hair: 1, x: 18, z: 11 },
  { id: 'theo', name: 'Theo', color: NEON.orange, hair: 2, x: 19, z: 11 },
  { id: 'ravi', name: 'Ravi', color: NEON.violet, hair: 6, x: 20, z: 11 },
  { id: 'juno', name: 'Juno', color: NEON.green, hair: 8, x: 21, z: 11 },
  { id: 'guard1', name: 'Guard A', color: NEON.red, hair: 4, x: 20, z: 4, hidden: true },
  { id: 'guard2', name: 'Guard B', color: NEON.red, hair: 5, x: 24, z: 3, hidden: true },
];

const LIGHTS = [
  { x: 21.5, y: 1.6, z: 4.2, color: NEON.magenta, intensity: 11, distance: 9 },
  { x: 28.4, y: 1.5, z: 3.8, color: NEON.lamp, intensity: 8, distance: 6 },
  { x: 15.9, y: 2.4, z: 8.5, color: NEON.lamp, intensity: 9, distance: 10 },
  { x: 26.5, y: 2.4, z: 10.9, color: NEON.lamp, intensity: 8, distance: 9 },
  { x: 24.2, y: 1.0, z: 16.4, color: '#ff6a1a', intensity: 14, distance: 9, flicker: true },
  { x: 22.2, y: 2.4, z: 13.3, color: NEON.ice, intensity: 8, distance: 9 },
  { x: 5.6, y: 1.6, z: 4.2, color: NEON.magenta, intensity: 10, distance: 9 },
  { x: 6.2, y: 1.6, z: 15.6, color: NEON.cyan, intensity: 9, distance: 9 },
];

const buildGround = (kit) => {
  for (let z = 0; z < H; z += 1) {
    for (let x = 0; x < W; x += 1) {
      const ch = cell(x, z);
      const i = z * W + x;
      const cx = x + 0.5;
      const cz = z + 0.5;
      kit.at(cx, cz, delayOf(cx, cz, 0, 0.035), false, -0.06);
      kit.box(1, 0.12, 1, cx, -0.06, cz, shade(FLOOR[ch] ?? FLOOR[','], i));
      if (ch !== 'x') continue;
      const across = cell(x, z - 1) === ',' || cell(x, z + 1) === ',' || cell(x, z - 1) === 'x' || cell(x, z + 1) === 'x';
      [0.2, 0.5, 0.8].forEach((t) => (across && (x === 13 || x === 16) ? kit.box(0.82, 0.012, 0.15, cx, 0.006, z + t, '#6f7178') : kit.box(0.15, 0.012, 0.82, x + t, 0.006, cz, '#6f7178')));
    }
  }
  for (let x = 0; x < W; x += 1) {
    if (cell(x, 9) !== '.' || x === 14 || x === 15) continue;
    kit.at(x + 0.5, 10, delayOf(x + 0.5, 10, 0.2, 0.035));
    kit.box(0.5, 0.012, 0.07, x + 0.5, 0.006, 10, '#4d4516');
  }
  for (let z = 0; z < H; z += 1) {
    if (cell(14, z) !== '.' || z === 9 || z === 10) continue;
    kit.at(15, z + 0.5, delayOf(15, z + 0.5, 0.2, 0.035));
    kit.box(0.07, 0.012, 0.5, 15, 0.006, z + 0.5, '#4d4516');
  }
};

const EDGES = [
  { dx: 0, dz: -1, ox: 0.5, oz: 0, alongX: true },
  { dx: 0, dz: 1, ox: 0.5, oz: 1, alongX: true },
  { dx: -1, dz: 0, ox: 0, oz: 0.5, alongX: false },
  { dx: 1, dz: 0, ox: 1, oz: 0.5, alongX: false },
];

const buildWalls = (kit) => {
  for (let z = 0; z < H; z += 1) {
    for (let x = 0; x < W; x += 1) {
      const ch = cell(x, z);
      const cx = x + 0.5;
      const cz = z + 0.5;
      const delay = delayOf(cx, cz, 0.55);
      if (ch === 'F') {
        kit.at(cx, cz, delay, true);
        kit.box(0.16, 0.62, 0.16, cx, 0.31, cz, '#2a2d36');
        EDGES.forEach(({ dx, dz }) => {
          const next = cell(x + dx, z + dz);
          if (next !== 'F' && !solid(next)) return;
          kit.box(dx ? 0.5 : 0.08, 0.62, dz ? 0.5 : 0.08, cx + dx * 0.25, 0.33, cz + dz * 0.25, '#30343d');
          kit.lamp(dx ? 0.5 : 0.05, 0.035, dz ? 0.5 : 0.05, cx + dx * 0.25, 0.67, cz + dz * 0.25, NEON.yellow, 1.05);
        });
        continue;
      }
      if (!solid(ch)) continue;
      const wall = WALL[ch];
      kit.at(cx, cz, delay, true);
      if (wall.glass) kit.pane(0.98, WALL_HEIGHT, 0.98, cx, WALL_HEIGHT / 2, cz, '#2fd8f5');
      else kit.box(1, WALL_HEIGHT, 1, cx, WALL_HEIGHT / 2, cz, shade(wall.color, z * W + x));
      EDGES.forEach((edge) => {
        if (solid(cell(x + edge.dx, z + edge.dz))) return;
        kit.lamp(edge.alongX ? 1 : 0.045, 0.035, edge.alongX ? 0.045 : 1, x + edge.ox, WALL_HEIGHT + 0.012, z + edge.oz, wall.trim, 1.4);
      });
    }
  }
};

const buildDoors = (kit, scene) =>
  DOORS.map((door) => {
    const cx = door.x + 0.5;
    const cz = door.z + 0.5;
    const h = WALL_HEIGHT;
    kit.at(cx, cz, delayOf(cx, cz, 0.55), true);
    [-0.46, 0.46].forEach((side) => (door.alongX ? kit.box(0.08, h, 0.3, cx + side, h / 2, cz, '#1a1c21') : kit.box(0.3, h, 0.08, cx, h / 2, cz + side, '#1a1c21')));
    door.alongX ? kit.box(1, 0.12, 0.3, cx, h - 0.06, cz, '#1a1c21') : kit.box(0.3, 0.12, 1, cx, h - 0.06, cz, '#1a1c21');
    const panel = new THREE.Mesh(new THREE.BoxGeometry(door.alongX ? 0.84 : 0.08, h - 0.12, door.alongX ? 0.08 : 0.84), new THREE.MeshLambertMaterial({ color: '#4a505a' }));
    panel.position.set(cx, (h - 0.12) / 2, cz);
    const light = new THREE.Mesh(new THREE.BoxGeometry(door.alongX ? 0.3 : 0.32, 0.03, door.alongX ? 0.32 : 0.3), new THREE.MeshBasicMaterial({ toneMapped: false }));
    light.position.set(cx, h + 0.02, cz);
    scene.add(panel, light);
    return { ...door, cx, cz, panel, light, open: false, slide: 0 };
  });

const buildArcade = (kit) => {
  const pop = (x, z) => kit.at(x, z, delayOf(x, z, 1.15));
  const tones = [NEON.cyan, NEON.magenta, NEON.yellow, NEON.green, NEON.orange, NEON.violet];
  tones.forEach((tone, i) => PROPS.cabinetGame(pop(18.5 + i, 2.42), 18.5 + i, 2.42, tone, 0));
  [NEON.magenta, NEON.cyan].forEach((tone, i) => PROPS.cabinetGame(pop(18.42, 4.5 + i), 18.42, 4.5 + i, tone, Math.PI / 2));
  PROPS.claw(pop(25.4, 2.5), 25.4, 2.5);
  PROPS.table(pop(22.5, 4.5), 22.5, 4.5, 1.3, 0.8);
  kit.box(0.5, 0.14, 0.34, 22.4, 0.82, 4.5, '#15131a').lamp(0.42, 0.03, 0.26, 22.4, 0.9, 4.5, NEON.yellow, 2.2).lamp(0.16, 0.06, 0.1, 22.9, 0.78, 4.3, NEON.green, 1.6).spot(22.5, 4.5, 2.4, NEON.yellow, 0.22);
  PROPS.stool(pop(21.6, 4.6), 21.6, 4.6);
  PROPS.stool(pop(23.4, 4.3), 23.4, 4.3);
  PROPS.plant(pop(25.5, 6.4), 25.5, 6.4);
  kit.at(19.9, 7.5, delayOf(19.9, 7.5, 1.3));
  kit.box(0.07, 0.3, 0.07, 18.5, 1.4, 7.5, '#1a1c21').box(0.07, 0.3, 0.07, 21.3, 1.4, 7.5, '#1a1c21');
  PROPS.sign(kit, 19.9, 1.8, 7.5, 3.5, NEON.magenta, true, 6);
  kit.spot(19.9, 8.6, 5.5, NEON.magenta, 0.3);
  kit.at(26.6, 7.5, delayOf(26.6, 7.5, 1.3));
  kit.box(0.07, 0.3, 0.07, 25.6, 1.4, 7.5, '#1a1c21').box(0.07, 0.3, 0.07, 27.6, 1.4, 7.5, '#1a1c21');
  PROPS.sign(kit, 26.6, 1.8, 7.5, 2.4, NEON.cyan, true, 4);
  PROPS.desk(pop(28.5, 3.3), 28.5, 3.3, NEON.orange);
  PROPS.safe(pop(29.4, 2.5), 29.4, 2.5);
  PROPS.rack(pop(27.5, 2.45), 27.5, 2.45);
  PROPS.crate(pop(29.3, 6.3), 29.3, 6.3, 0.7, 0.3);
  kit.at(21.5, 4.5, 1.4).spot(21.5, 4.4, 10, NEON.magenta, 0.2).spot(28.5, 4, 5.5, NEON.lamp, 0.2);
};

const buildYard = (kit) => {
  const pop = (x, z) => kit.at(x, z, delayOf(x, z, 1.15));
  PROPS.container(pop(20, 17.5), 20, 17.5, '#7a1220');
  PROPS.container(pop(20.3, 17.5), 20.3, 17.5, '#1a3f6e', true, 1.16);
  PROPS.container(pop(27, 13.6), 27, 13.6, '#1d5a3a');
  PROPS.container(pop(28.9, 16.5), 28.9, 16.5, '#8a6a12', false);
  PROPS.crate(pop(18.7, 13.7), 18.7, 13.7);
  PROPS.crate(pop(19.6, 13.6), 19.6, 13.6, 0.7, 0.4);
  PROPS.crate(pop(18.8, 14.6), 18.8, 14.6, 0.78, 0.2);
  kit.box(0.7, 0.7, 0.7, 18.75, 1.13, 13.75, '#4b3020', 0.5);
  PROPS.barrel(pop(24.6, 13.7), 24.6, 13.7);
  PROPS.barrel(pop(25.2, 13.5), 25.2, 13.5, '#31423a');
  PROPS.fireBarrel(pop(24.2, 16.4), 24.2, 16.4);
  PROPS.streetLamp(pop(21.4, 13.3), 21.4, 13.3, 1, 0, NEON.ice);
  PROPS.dumpster(pop(26.4, 18.2), 26.4, 18.2);
  PROPS.crate(pop(22.4, 18), 22.4, 18, 0.7, 0.1);
};

const buildClub = (kit, tiles) => {
  const pop = (x, z) => kit.at(x, z, delayOf(x, z, 1.15));
  for (let z = 3; z <= 5; z += 1) for (let x = 3; x <= 7; x += 1) tiles.push({ x: x + 0.5, z: z + 0.5 });
  PROPS.counter(pop(9.6, 2.9), 9.6, 2.9, 3.4, NEON.cyan);
  PROPS.shelf(kit, 9.6, 2.16, 3.4);
  [8.6, 9.6, 10.6].forEach((x) => PROPS.stool(pop(x, 3.7), x, 3.7));
  PROPS.booth(pop(2.6, 4.5), 2.6, 4.5, NEON.magenta);
  PROPS.speaker(pop(2.5, 2.5), 2.5, 2.5, NEON.magenta);
  PROPS.speaker(pop(2.5, 6.4), 2.5, 6.4, NEON.cyan);
  PROPS.sofa(pop(10.2, 6.3), 10.2, 6.3, Math.PI);
  kit.at(5.5, 7.5, delayOf(5.5, 7.5, 1.3));
  kit.box(0.07, 0.3, 0.07, 3.8, 1.4, 7.5, '#1a1c21').box(0.07, 0.3, 0.07, 7.2, 1.4, 7.5, '#1a1c21');
  PROPS.sign(kit, 5.5, 1.8, 7.5, 4, NEON.cyan, true, 7);
  kit.spot(5.5, 4.5, 10, NEON.magenta, 0.22).spot(9.6, 3.6, 5, NEON.cyan, 0.2).spot(5.5, 8.6, 5.5, NEON.cyan, 0.26);
};

const buildClinic = (kit) => {
  const pop = (x, z) => kit.at(x, z, delayOf(x, z, 1.15));
  [3.5, 5.8, 8.1].forEach((x, i) => {
    PROPS.gurney(pop(x, 14.6), x, 14.6);
    PROPS.monitor(pop(x + 0.8, 13.6), x + 0.8, 13.6, i === 1 ? NEON.cyan : NEON.green);
  });
  [3, 4, 5].forEach((x) => PROPS.cabinet(pop(x, 18.6), x, 18.6));
  PROPS.desk(pop(10.2, 17.6), 10.2, 17.6);
  PROPS.rack(pop(10.6, 13.5), 10.6, 13.5);
  PROPS.rack(pop(11.4, 13.5), 11.4, 13.5, NEON.magenta);
  kit.at(5.8, 14.6, 1.5).disc(0.32, 0.05, 5.8, 1.9, 14.6, NEON.ice, 2.2).spot(5.8, 14.6, 4, NEON.ice, 0.3).spot(6, 15.8, 10, NEON.cyan, 0.2);
};

const buildStreet = (kit) => {
  const pop = (x, z) => kit.at(x, z, delayOf(x, z, 1.1));
  PROPS.streetLamp(pop(16.5, 8.5), 16.5, 8.5, -1, 0);
  PROPS.streetLamp(pop(13.5, 11.5), 13.5, 11.5, 1, 0);
  PROPS.streetLamp(pop(26.5, 11.6), 26.5, 11.6, 0, -1);
  PROPS.streetLamp(pop(6.5, 8.4), 6.5, 8.4, 0, 1);
  PROPS.streetLamp(pop(29.6, 8.4), 29.6, 8.4, 0, 1);
  PROPS.vending(pop(27.5, 8.34), 27.5, 8.34, NEON.cyan);
  PROPS.vending(pop(28.5, 8.34), 28.5, 8.34, NEON.orange);
  PROPS.bench(pop(10, 8.4), 10, 8.4);
  PROPS.bin(pop(12.6, 8.3), 12.6, 8.3);
  PROPS.bin(pop(24.7, 8.25), 24.7, 8.25);
};

const makeFog = (scene) => {
  const cells = [];
  for (let z = FOG_AREA.z0; z <= FOG_AREA.z1; z += 1) for (let x = FOG_AREA.x0; x <= FOG_AREA.x1; x += 1) if (x !== FOG_AREA.wall) cells.push({ x, z, k: 0, off: Infinity });
  const texture = staticTexture();
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ map: texture, color: '#6f6578' }), cells.length);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const matrix = new THREE.Matrix4();
  const height = 1.86;
  const update = (time, dt, reveal) => {
    texture.offset.y = (time * 0.35) % 1;
    cells.forEach((fog, i) => {
      const want = time >= fog.off ? 0 : reveal > delayOf(fog.x, fog.z, 0.9) ? 1 : 0;
      fog.k = THREE.MathUtils.damp(fog.k, want, want ? 7 : 9, dt);
      const k = fog.k < 0.004 ? 0 : fog.k;
      matrix.makeScale(k ? 1.001 : 0, height * k, k ? 1.001 : 0).setPosition(fog.x + 0.5, (height * k) / 2, fog.z + 0.5);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  return { cells, update };
};

const makeDance = (scene, tiles) => {
  const palette = [NEON.red, NEON.cyan, NEON.yellow, NEON.magenta, NEON.green, NEON.orange];
  const mesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    tiles.length,
  );
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  tiles.forEach((tile, i) => mesh.setMatrixAt(i, matrix.makeTranslation(tile.x, 0.008, tile.z)));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  scene.add(mesh);
  let last = -1;
  const update = (time, reveal) => {
    if (time - last < 0.45) return;
    last = time;
    tiles.forEach((_, i) => mesh.setColorAt(i, color.set(palette[Math.floor(Math.random() * palette.length)]).multiplyScalar(reveal < 1.6 ? 0 : Math.random() < 0.3 ? 0.1 : 1.5)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  update(0, 0);
  return { update };
};

const VIEWS = {
  wide: { target: [22.6, 0, 7.4], distance: 29.5, azimuth: -0.4, elevation: 0.7, shift: 5.4 },
  mid: { target: [22, 0, 7.6], distance: 28, azimuth: -0.4, elevation: 0.72, shift: 1.2 },
  tall: { target: [22.4, 0, 7.2], distance: 31, azimuth: -0.36, elevation: 0.78, shift: 0 },
};

export const createHero = (canvas, { still = false, lowPower = false, shot = null } = {}) => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#060308');
  scene.fog = new THREE.FogExp2('#0b040d', 0.014);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 260);

  const reveal = { value: still ? 99 : 0 };
  const kit = new Kit();
  const tiles = [];
  buildGround(kit);
  buildWalls(kit);
  const doors = buildDoors(kit, scene);
  buildArcade(kit);
  buildYard(kit);
  buildClub(kit, tiles);
  buildClinic(kit);
  buildStreet(kit);
  scene.add(meshesOf(kit, reveal));

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W + 240, H + 240).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#1d1722' }));
  ground.position.set(W / 2, -0.13, H / 2);
  const grid = makeGrid(W, H, NEON.red, 0.2);
  const skyline = makeSkyline(W, H);
  const indoors = (x, z) => (x > 1 && x < 13 && ((z > 1 && z < 8) || (z > 12 && z < 20))) || (x > 17 && x < 31 && z > 1 && z < 8);
  const rain = makeRain(W, H, lowPower ? 420 : 950, indoors);
  const glows = makeGlows(kit.spots);
  scene.add(ground, grid, skyline, rain, glows.mesh);

  scene.add(new THREE.HemisphereLight('#4a2c66', '#1c0510', 0.72));
  const moon = new THREE.DirectionalLight('#8ea4ff', 0.4);
  moon.position.set(W / 2 + 12, 30, H / 2 + 9);
  moon.target.position.set(W / 2, 0, H / 2);
  scene.add(moon, moon.target);
  const lamps = LIGHTS.slice(0, lowPower ? 5 : LIGHTS.length).map((spec) => {
    const light = new THREE.PointLight(spec.color, 0, spec.distance, 1.6);
    light.position.set(spec.x, spec.y, spec.z);
    scene.add(light);
    return { light, spec };
  });

  const fog = makeFog(scene);
  const dance = makeDance(scene, tiles);
  const glow = glowTexture();

  const tokens = new Map(CAST.map((spec) => [spec.id, makeToken(spec)]));
  tokens.forEach((token) => {
    token.standee.rotation.order = 'YXZ';
    scene.add(token.group);
  });

  const parked = [
    { car: makeCar('#c6a300', glow, { lights: false }), x: 14.5, z: 16.4, turn: Math.PI / 2 },
    { car: makeCar('#24468f', glow, { lights: false }), x: 15.5, z: 4.2, turn: -Math.PI / 2 },
    { car: makeCar('#3b3f47', glow, { van: true, lights: false }), x: 22.7, z: 15.6, turn: Math.PI / 2 },
  ];
  parked.forEach(({ car, x, z, turn }) => {
    car.position.set(x, 0, z);
    car.rotation.y = turn;
    car.scale.setScalar(0);
    scene.add(car);
  });
  const traffic = { car: makeCar('#8f1d2c', glow), x: 99, dir: 1, speed: 0 };
  traffic.car.visible = false;
  scene.add(traffic.car);

  const lineMaterial = new THREE.MeshBasicMaterial({ color: NEON.cyan, toneMapped: false, transparent: true, opacity: 0 });
  const sight = { mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 0.025, 0.05), lineMaterial), from: null, to: null, on: 0 };
  sight.mesh.visible = false;
  const tracer = { mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 0.04, 0.04), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff3b0').multiplyScalar(4), toneMapped: false, transparent: true, opacity: 0 })), life: 0 };
  tracer.mesh.visible = false;
  const flash = new THREE.PointLight('#ffd27a', 0, 9, 1.6);
  const pings = Array.from({ length: 3 }, () => {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: NEON.yellow, toneMapped: false, transparent: true, opacity: 0, depthWrite: false }));
    mesh.visible = false;
    mesh.renderOrder = 3;
    scene.add(mesh);
    return { mesh, life: 1, delay: 0 };
  });
  scene.add(sight.mesh, tracer.mesh, flash);

  const view = { ...VIEWS.wide, target: new THREE.Vector3(...VIEWS.wide.target) };
  const orbit = { azimuth: 0, elevation: 0, pointerX: 0, pointerY: 0, easeX: 0, easeY: 0, dragging: false, lastX: 0, lastY: 0, idle: 9 };
  const right = new THREE.Vector3();
  const eye = new THREE.Vector3();
  const look = new THREE.Vector3();

  const frameView = ({ width, height }) => {
    const aspect = width / height;
    const preset = shot ?? (aspect > 1.45 ? VIEWS.wide : aspect > 0.95 ? VIEWS.mid : VIEWS.tall);
    Object.assign(view, preset, { target: view.target.set(...preset.target) });
    view.distance = preset.distance * (aspect < 0.95 ? Math.max(1, 0.86 / aspect) : 1);
    scene.fog.density = 0.36 / view.distance;
  };
  const viewport = makeViewport(canvas, scene, camera, { lowPower, onResize: frameView });
  const { size, resize, render } = viewport;

  const place = (time) => {
    const sway = still ? 0 : Math.sin(time * 0.11) * 0.13;
    const azimuth = view.azimuth + sway + orbit.azimuth + orbit.easeX * 0.07;
    const elevation = THREE.MathUtils.clamp(view.elevation + Math.sin(time * 0.07) * 0.015 + orbit.elevation - orbit.easeY * 0.03, 0.42, 1.05);
    right.set(Math.cos(azimuth), 0, -Math.sin(azimuth));
    look.copy(view.target).addScaledVector(right, -view.shift);
    eye
      .set(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation))
      .multiplyScalar(view.distance)
      .add(look);
    camera.position.copy(eye);
    camera.lookAt(look);
  };

  const listeners = new Set();
  const clock = { time: 0, last: 0, slow: 0, frames: 0, raf: 0, running: false };

  const moveToken = (token, dt) => {
    const group = token.group;
    if (!token.path.length) return;
    const [tx, tz] = token.path[0];
    const dx = tx + 0.5 - group.position.x;
    const dz = tz + 0.5 - group.position.z;
    const distance = Math.hypot(dx, dz);
    const step = token.speed * dt;
    if (distance <= step) {
      group.position.x = tx + 0.5;
      group.position.z = tz + 0.5;
      token.path.shift();
      return;
    }
    group.position.x += (dx / distance) * step;
    group.position.z += (dz / distance) * step;
  };

  const update = (dt) => {
    const time = clock.time;
    if (!still) reveal.value += dt;
    place(time);
    rain.material.uniforms.uTime.value = time;
    glows.update(time, reveal.value);
    fog.update(time, dt, reveal.value);
    dance.update(time, reveal.value);
    const lit = Math.min(1, Math.max(0, (reveal.value - 1.3) / 1.2));
    lamps.forEach(({ light, spec }, i) => {
      const flicker = spec.flicker ? 0.75 + Math.sin(time * 14 + i) * 0.15 + Math.sin(time * 37 + i * 2) * 0.1 : 1;
      light.intensity = spec.intensity * 1.25 * lit * flicker;
    });
    parked.forEach(({ car }, i) => car.scale.setScalar(THREE.MathUtils.damp(car.scale.x, reveal.value > 1.5 + i * 0.12 ? 1 : 0, 8, dt)));

    tokens.forEach((token) => {
      const group = token.group;
      token.grow = THREE.MathUtils.damp(token.grow, token.shown && reveal.value > 2 ? 1 : 0, 9, dt);
      group.visible = token.grow > 0.01;
      group.scale.setScalar(token.grow);
      moveToken(token, dt);
      token.standee.rotation.y = Math.atan2(camera.position.x - group.position.x, camera.position.z - group.position.z);
      token.standee.rotation.x = THREE.MathUtils.damp(token.standee.rotation.x, token.down ? -1.35 : 0, 6, dt);
      token.standee.position.y = THREE.MathUtils.damp(token.standee.position.y, token.down ? 0.1 : 0.52 + Math.sin(time * 2 + token.seed) * 0.015, 6, dt);
      token.flash = Math.max(0, token.flash - dt * 1.6);
      token.ringMaterial.color.copy(token.tone).multiplyScalar(token.down ? 0.5 : 1.7 + token.flash * 5);
      token.cardMaterial.color.setScalar(token.down ? 0.35 : 1);
      token.frameMaterial.color.copy(token.tone).multiplyScalar(token.down ? 0.4 : 1.25 + token.flash * 3);
      token.turn.visible = token.beam.visible = !!token.active && !token.down;
      if (token.active) token.turn.scale.setScalar(1.2 * (1 + (Math.sin(time * 4) + 1) * 0.08));
    });

    doors.forEach((door) => {
      door.slide = THREE.MathUtils.damp(door.slide, door.open ? 0.82 : 0, 10, dt);
      door.panel.position[door.alongX ? 'x' : 'z'] = (door.alongX ? door.cx : door.cz) + door.slide;
      door.panel.scale.y = Math.min(1, Math.max(0.001, (reveal.value - 1.1) / 0.5));
      door.light.material.color.set(door.open ? NEON.green : NEON.red).multiplyScalar(reveal.value > 1.6 ? 2.4 : 0);
    });

    if (traffic.speed) {
      traffic.x += traffic.dir * traffic.speed * dt;
      traffic.car.position.set(traffic.x, 0, traffic.dir > 0 ? 9.5 : 10.5);
      if (traffic.x < -14 || traffic.x > W + 14) {
        traffic.speed = 0;
        traffic.car.visible = false;
      }
    }

    sight.on = THREE.MathUtils.damp(sight.on, sight.from ? 1 : 0, 10, dt);
    sight.mesh.visible = sight.on > 0.02;
    if (sight.from && sight.to) {
      const a = sight.from.group.position;
      const b = sight.to.group.position;
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      sight.mesh.position.set((a.x + b.x) / 2, 0.58, (a.z + b.z) / 2);
      sight.mesh.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
      sight.mesh.scale.set(Math.max(0.01, length - 0.9), 1, 1);
    }
    lineMaterial.opacity = sight.on * (0.75 + Math.sin(time * 9) * 0.25);

    tracer.life = Math.max(0, tracer.life - dt * 5.5);
    tracer.mesh.visible = tracer.life > 0.01;
    tracer.mesh.material.opacity = tracer.life;
    flash.intensity = tracer.life * 60;

    pings.forEach((ping) => {
      if (ping.life >= 1) {
        ping.mesh.visible = false;
        return;
      }
      ping.delay -= dt;
      if (ping.delay > 0) return;
      ping.life = Math.min(1, ping.life + dt * 1.1);
      ping.mesh.visible = true;
      ping.mesh.scale.setScalar(1 + ping.life * 3.4);
      ping.mesh.material.opacity = (1 - ping.life) * 0.9;
    });

    orbit.easeX = THREE.MathUtils.damp(orbit.easeX, orbit.pointerX, 3, dt);
    orbit.easeY = THREE.MathUtils.damp(orbit.easeY, orbit.pointerY, 3, dt);
    if (!orbit.dragging) {
      orbit.idle += dt;
      if (orbit.idle > 2.5) {
        orbit.azimuth = THREE.MathUtils.damp(orbit.azimuth, 0, 0.9, dt);
        orbit.elevation = THREE.MathUtils.damp(orbit.elevation, 0, 0.9, dt);
      }
    }
  };

  const frame = (now) => {
    if (!clock.running) return;
    const ms = clock.last ? now - clock.last : 16;
    clock.last = now;
    const dt = Math.min(0.05, ms / 1000);
    clock.time += dt;
    update(dt);
    render();
    listeners.forEach((listener) => listener(clock.time, dt));
    viewport.tune(ms);
    clock.raf = requestAnimationFrame(frame);
  };

  const start = () => {
    if (clock.running) return;
    clock.running = true;
    clock.last = 0;
    clock.raf = requestAnimationFrame(frame);
  };

  const stop = () => {
    clock.running = false;
    cancelAnimationFrame(clock.raf);
  };

  const settle = () => {
    for (let i = 0; i < 40; i += 1) {
      clock.time += 0.05;
      update(0.05);
    }
    render();
    listeners.forEach((listener) => listener(clock.time, 0));
  };

  const projected = new THREE.Vector3();
  const api = {
    walk: (id, path, speed = 3.2) => {
      const token = tokens.get(id);
      token.path = path.map((step) => [...step]);
      token.speed = speed;
    },
    jump: (id, x, z) => {
      const token = tokens.get(id);
      token.path = [];
      token.group.position.set(x + 0.5, 0, z + 0.5);
    },
    show: (id, shown = true) => {
      tokens.get(id).shown = shown;
    },
    pulse: (id) => {
      tokens.get(id).flash = 1;
    },
    turn: (id) => tokens.forEach((token) => (token.active = token.id === id)),
    drop: (id, down = true) => {
      tokens.get(id).down = down;
    },
    door: (id, open = true) => {
      doors.find((door) => door.id === id).open = open;
    },
    uncover: (x, z, radius, limit = FOG_AREA.wall) => {
      fog.cells.forEach((fogCell) => {
        const distance = Math.hypot(fogCell.x - x, fogCell.z - z);
        if (distance > radius || fogCell.x > limit) return;
        fogCell.off = Math.min(fogCell.off, clock.time + distance * 0.11);
      });
    },
    sight: (from, to, color = NEON.cyan) => {
      sight.from = from ? tokens.get(from) : null;
      sight.to = to ? tokens.get(to) : null;
      lineMaterial.color.set(color).multiplyScalar(2);
    },
    shot: (from, to) => {
      const a = tokens.get(from).group.position;
      const b = tokens.get(to).group.position;
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      tracer.mesh.position.set((a.x + b.x) / 2, 0.62, (a.z + b.z) / 2);
      tracer.mesh.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
      tracer.mesh.scale.set(length, 1, 1);
      tracer.life = 1;
      flash.position.set(a.x, 0.9, a.z);
      tokens.get(to).flash = 1.4;
    },
    ping: (x, z, color = NEON.yellow) =>
      pings.forEach((ping, i) => {
        ping.mesh.position.set(x + 0.5, 0.03, z + 0.5);
        ping.mesh.material.color.set(color).multiplyScalar(2);
        ping.life = 0;
        ping.delay = i * 0.22;
      }),
    traffic: (dir = 1, speed = 8.5) => {
      traffic.dir = dir;
      traffic.speed = speed;
      traffic.x = dir > 0 ? -13 : W + 13;
      traffic.car.rotation.y = dir > 0 ? 0 : Math.PI;
      traffic.car.visible = true;
    },
    reset: () => {
      tokens.forEach((token) => {
        token.path = [];
        token.down = false;
        token.active = false;
        token.flash = 0;
        token.shown = !token.home.hidden;
        token.group.position.set(token.home.x + 0.5, 0, token.home.z + 0.5);
        token.standee.rotation.x = 0;
      });
      doors.forEach((door) => (door.open = false));
      fog.cells.forEach((fogCell) => (fogCell.off = Infinity));
      sight.from = sight.to = null;
    },
    project: (id, lift = 1.12) => {
      const token = tokens.get(id);
      projected.copy(token.group.position);
      projected.y = lift;
      projected.project(camera);
      return { x: (projected.x * 0.5 + 0.5) * size.width, y: (-projected.y * 0.5 + 0.5) * size.height, visible: token.grow > 0.5 && projected.z < 1 };
    },
    ids: () => [...tokens.keys()],
  };

  const onPointerMove = (event) => {
    orbit.pointerX = (event.clientX / window.innerWidth) * 2 - 1;
    orbit.pointerY = (event.clientY / window.innerHeight) * 2 - 1;
    if (!orbit.dragging) return;
    orbit.azimuth = THREE.MathUtils.clamp(orbit.azimuth - (event.clientX - orbit.lastX) * 0.005, -0.75, 0.75);
    orbit.elevation = THREE.MathUtils.clamp(orbit.elevation + (event.clientY - orbit.lastY) * 0.003, -0.2, 0.28);
    orbit.lastX = event.clientX;
    orbit.lastY = event.clientY;
  };
  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    orbit.dragging = true;
    orbit.idle = 0;
    orbit.lastX = event.clientX;
    orbit.lastY = event.clientY;
    canvas.classList.add('is-dragging');
  };
  const onPointerUp = () => {
    orbit.dragging = false;
    orbit.idle = 0;
    canvas.classList.remove('is-dragging');
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  const onLost = (event) => {
    event.preventDefault();
    stop();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', () => (still ? settle() : start()));

  const observer = new ResizeObserver(() => {
    resize();
    if (still) settle();
  });
  observer.observe(canvas);
  resize();

  const dispose = () => {
    stop();
    observer.disconnect();
    canvas.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    viewport.renderer.dispose();
  };

  return { api, start, stop, settle, resize, dispose, onFrame: (listener) => listeners.add(listener), time: () => clock.time, reveal: () => reveal.value };
};
