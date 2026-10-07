import { THREE, NEON, Kit, PROPS, meshesOf, makeGrid, makeGlows, makeCar, makeViewport, glowTexture, mulberry, disposeTree } from './world.js';

const W = 10;
const D = 8;
const WALL_HEIGHT = 1.25;
const FRAME = '#1a1c21';

const THEMES = {
  bar: {
    floor: '#3b2a1f',
    wall: '#35212a',
    trim: '#ff4a2a',
    lights: [
      [NEON.magenta, 3.4, 2.6, 12],
      [NEON.orange, 7, 5, 9],
    ],
    furnish: (kit, put, rng, flip) => {
      const mx = (x) => (flip ? W - x : x);
      PROPS.counter(put(mx(3.4), 1.95), mx(3.4), 1.95, 3.6, NEON.magenta);
      PROPS.shelf(kit, mx(3.4), 1.17, 3.6);
      [2.3, 3.4, 4.5].forEach((x) => PROPS.stool(put(mx(x), 2.75), mx(x), 2.75));
      const tables = [
        [7.1, 3.1],
        [6.3, 5.5],
        [3, 5.4],
      ].slice(0, 2 + Math.floor(rng() * 2));
      tables.forEach(([x, z]) => {
        PROPS.table(put(mx(x), z), mx(x), z, 1.1, 0.8);
        PROPS.stool(put(mx(x) - 0.85, z), mx(x) - 0.85, z, '#231a2a');
        PROPS.stool(put(mx(x) + 0.85, z), mx(x) + 0.85, z, '#231a2a');
        kit.lamp(0.14, 0.05, 0.14, mx(x), 0.78, z, NEON.orange, 2);
      });
      PROPS.sofa(put(mx(8.5), 4.4), mx(8.5), 4.4, flip ? Math.PI / 2 : -Math.PI / 2);
      PROPS.plant(put(mx(1.5), 6.4), mx(1.5), 6.4);
      PROPS.sign(put(mx(7), 0.5, 0.2), mx(7), 1.8, 0.5, 2.8, NEON.cyan, true, 5);
      kit.box(0.07, 0.3, 0.07, mx(7) - 1.2, 1.4, 0.5, FRAME).box(0.07, 0.3, 0.07, mx(7) + 1.2, 1.4, 0.5, FRAME);
      kit.spot(mx(3.4), 2.9, 6, NEON.magenta, 0.26).spot(mx(7), 4.6, 6, NEON.orange, 0.2);
    },
  },
  club: {
    floor: '#241a2c',
    wall: '#2c1a33',
    trim: NEON.magenta,
    lights: [
      [NEON.magenta, 5, 4, 13],
      [NEON.cyan, 8, 2.2, 8],
    ],
    furnish: (kit, put, rng, flip) => {
      const mx = (x) => (flip ? W - x : x);
      const palette = [NEON.red, NEON.cyan, NEON.yellow, NEON.magenta, NEON.green, NEON.orange];
      for (let z = 3; z <= 5; z += 1) for (let x = 3; x <= 6; x += 1) kit.at(x + 0.5, z + 0.5, 0.9 + (x + z) * 0.03).lamp(0.9, 0.02, 0.9, x + 0.5, 0.012, z + 0.5, palette[Math.floor(rng() * palette.length)], rng() < 0.3 ? 0.12 : 0.55);
      PROPS.booth(put(1.6, 4.5), 1.6, 4.5, NEON.magenta);
      PROPS.speaker(put(1.5, 2.2), 1.5, 2.2, NEON.magenta);
      PROPS.speaker(put(1.5, 6.4), 1.5, 6.4, NEON.cyan);
      PROPS.counter(put(mx(7.3), 1.9), mx(7.3), 1.9, 2.6, NEON.cyan);
      PROPS.shelf(kit, mx(7.3), 1.17, 2.6);
      [6.6, 7.9].forEach((x) => PROPS.stool(put(mx(x), 2.7), mx(x), 2.7));
      PROPS.sofa(put(8.5, 5.2), 8.5, 5.2, -Math.PI / 2);
      kit.spot(4.9, 4.5, 8, NEON.magenta, 0.3).spot(mx(7.3), 2.8, 5, NEON.cyan, 0.22);
    },
  },
  clinic: {
    floor: '#22343d',
    wall: '#1c2e3c',
    trim: NEON.cyan,
    lights: [
      [NEON.cyan, 4, 3.4, 12],
      [NEON.ice, 7.4, 5, 8],
    ],
    furnish: (kit, put, rng, flip) => {
      const mx = (x) => (flip ? W - x : x);
      const beds = 2 + Math.floor(rng() * 2);
      Array.from({ length: beds }, (_, i) => 2.2 + i * 2.2).forEach((x, i) => {
        PROPS.gurney(put(mx(x), 2.6), mx(x), 2.6);
        PROPS.monitor(put(mx(x) + 0.85, 1.5), mx(x) + 0.85, 1.5, i % 2 ? NEON.cyan : NEON.green);
      });
      kit.at(mx(2.2), 2.6, 1.6).disc(0.32, 0.05, mx(2.2), 1.9, 2.6, NEON.ice, 2.2).spot(mx(2.2), 2.6, 3.6, NEON.ice, 0.32);
      [2, 3, 4].forEach((x) => PROPS.cabinet(put(mx(x), 6.6), mx(x), 6.6));
      PROPS.desk(put(mx(7.6), 5.8), mx(7.6), 5.8);
      PROPS.rack(put(mx(8.5), 1.5), mx(8.5), 1.5);
      PROPS.plant(put(mx(8.5), 6.5), mx(8.5), 6.5);
      kit.spot(mx(4.4), 3.6, 8, NEON.cyan, 0.24);
    },
  },
  warehouse: {
    floor: '#2b2a2f',
    wall: '#2b2630',
    trim: NEON.red,
    lights: [
      [NEON.lamp, 5, 4, 12],
      ['#ff6a1a', 7.6, 5.6, 9],
    ],
    furnish: (kit, put, rng, flip) => {
      const mx = (x) => (flip ? W - x : x);
      PROPS.container(put(mx(3), 1.8), mx(3), 1.8, '#7a1220');
      if (rng() < 0.6) PROPS.container(put(mx(3.3), 1.8), mx(3.3), 1.8, '#1a3f6e', true, 1.16);
      PROPS.container(put(mx(8.3), 3.2), mx(8.3), 3.2, '#1d5a3a', false);
      [
        [2, 4.6, 0.2],
        [2.9, 4.8, 0.5],
        [2.2, 5.6, 0.1],
        [6, 6.2, 0.3],
      ].forEach(([x, z, turn]) => PROPS.crate(put(mx(x), z), mx(x), z, 0.74 + rng() * 0.1, turn));
      kit.at(mx(2.3), 4.9, 1.5).box(0.66, 0.66, 0.66, mx(2.3), 1.1, 4.9, '#4b3020', 0.6);
      PROPS.barrel(put(mx(5.4), 1.6), mx(5.4), 1.6);
      PROPS.barrel(put(mx(6), 1.7), mx(6), 1.7, '#31423a');
      PROPS.fireBarrel(put(mx(7.6), 5.9), mx(7.6), 5.9);
      PROPS.rack(put(mx(4.4), 6.5), mx(4.4), 6.5, NEON.orange);
      kit.spot(mx(4.6), 3.8, 8, NEON.lamp, 0.2);
    },
  },
  office: {
    floor: '#262a3a',
    wall: '#1c2e3c',
    trim: NEON.cyan,
    lights: [
      [NEON.cyan, 3.6, 3, 10],
      [NEON.lamp, 7.2, 5, 10],
    ],
    furnish: (kit, put, rng, flip) => {
      const mx = (x) => (flip ? W - x : x);
      [
        [2.6, 2.2, NEON.cyan],
        [5.2, 2.2, NEON.green],
        [7.6, 2.2, NEON.orange],
      ]
        .slice(0, 2 + Math.floor(rng() * 2))
        .forEach(([x, z, tone]) => {
          PROPS.desk(put(mx(x), z), mx(x), z, tone);
          PROPS.stool(put(mx(x), z + 0.9), mx(x), z + 0.9, '#231a2a');
        });
      PROPS.table(put(mx(4.4), 5.2), mx(4.4), 5.2, 2.2, 1);
      [3.4, 4.4, 5.4].forEach((x) => PROPS.stool(put(mx(x), 6.1), mx(x), 6.1, '#231a2a'));
      kit.at(mx(4.4), 5.2, 1.6).lamp(0.7, 0.03, 0.4, mx(4.4), 0.77, 5.2, NEON.cyan, 1.4);
      PROPS.safe(put(mx(8.5), 6.4), mx(8.5), 6.4);
      PROPS.cabinet(put(mx(8.5), 4.6), mx(8.5), 4.6);
      PROPS.plant(put(mx(1.5), 6.4), mx(1.5), 6.4);
      PROPS.rack(put(mx(1.5), 4.2), mx(1.5), 4.2);
      kit.spot(mx(4.4), 4.2, 8, NEON.cyan, 0.22).spot(mx(8), 5.6, 5, NEON.lamp, 0.2);
    },
  },
  garage: {
    floor: '#26262b',
    wall: '#2e2a26',
    trim: NEON.yellow,
    lights: [
      [NEON.lamp, 5, 3.6, 13],
      [NEON.yellow, 2.4, 5.6, 7],
    ],
    car: true,
    furnish: (kit, put, rng, flip) => {
      const mx = (x) => (flip ? W - x : x);
      PROPS.rack(put(mx(1.5), 1.5), mx(1.5), 1.5, NEON.yellow);
      PROPS.cabinet(put(mx(2.6), 1.4), mx(2.6), 1.4);
      PROPS.cabinet(put(mx(3.6), 1.4), mx(3.6), 1.4);
      PROPS.barrel(put(mx(8.5), 1.6), mx(8.5), 1.6);
      PROPS.barrel(put(mx(7.9), 1.5), mx(7.9), 1.5, '#5a2e1c');
      PROPS.crate(put(mx(8.4), 6.3), mx(8.4), 6.3, 0.76, 0.2);
      PROPS.crate(put(mx(7.5), 6.5), mx(7.5), 6.5, 0.7, 0.5);
      PROPS.table(put(mx(1.9), 5.6), mx(1.9), 5.6, 0.9, 1.8);
      kit.lamp(0.3, 0.05, 0.5, mx(1.9), 0.78, 5.3, NEON.yellow, 1.6).box(0.4, 0.2, 0.3, mx(1.9), 0.85, 6, '#9a1222');
      for (let i = -3; i <= 3; i += 1)
        kit
          .at(mx(5.4), 4, 1.2)
          .box(0.5, 0.012, 0.12, mx(5.4) + i * 0.62, 0.007, 5.3, '#8a7a20')
          .box(0.5, 0.012, 0.12, mx(5.4) + i * 0.62, 0.007, 2.7, '#8a7a20');
      kit.spot(mx(5.4), 4, 8, NEON.lamp, 0.22);
    },
  },
};

const EDGES = [
  { dx: 0, dz: -1, ox: 0.5, oz: 0, alongX: true },
  { dx: 0, dz: 1, ox: 0.5, oz: 1, alongX: true },
  { dx: -1, dz: 0, ox: 0, oz: 0.5, alongX: false },
  { dx: 1, dz: 0, ox: 1, oz: 0.5, alongX: false },
];

const buildShell = (kit, theme, rng) => {
  const door = 3 + Math.floor(rng() * 4);
  const glassFrom = door > 5 ? 1 : 7;
  const wallAt = (x, z) => x >= 0 && z >= 0 && x < W && z < D && (x === 0 || z === 0 || x === W - 1 || z === D - 1) && !(z === D - 1 && x === door);
  const tint = (hex) => `#${new THREE.Color(hex).multiplyScalar(0.85 + rng() * 0.3).getHexString()}`;
  for (let z = 0; z < D; z += 1) {
    for (let x = 0; x < W; x += 1) {
      const cx = x + 0.5;
      const cz = z + 0.5;
      const delay = (x + z) * 0.035;
      kit.at(cx, cz, delay, false, -0.06).box(1, 0.12, 1, cx, -0.06, cz, tint(theme.floor));
      if (z === D - 1 && x === door) {
        kit.at(cx, cz, 0.45 + delay, true);
        [-0.46, 0.46].forEach((side) => kit.box(0.08, WALL_HEIGHT, 0.3, cx + side, WALL_HEIGHT / 2, cz, FRAME));
        kit
          .box(1, 0.12, 0.3, cx, WALL_HEIGHT - 0.06, cz, FRAME)
          .box(0.84, WALL_HEIGHT - 0.12, 0.08, cx + 0.6, (WALL_HEIGHT - 0.12) / 2, cz, '#4a505a')
          .lamp(0.3, 0.03, 0.32, cx, WALL_HEIGHT + 0.02, cz, NEON.green, 2.2);
        continue;
      }
      if (!wallAt(x, z)) continue;
      const glazed = z === D - 1 && (x === glassFrom || x === glassFrom + 1);
      kit.at(cx, cz, 0.45 + delay, true);
      if (glazed) kit.pane(0.98, WALL_HEIGHT, 0.98, cx, WALL_HEIGHT / 2, cz, '#2fd8f5');
      else kit.box(1, WALL_HEIGHT, 1, cx, WALL_HEIGHT / 2, cz, tint(theme.wall));
      EDGES.forEach((edge) => {
        if (wallAt(x + edge.dx, z + edge.dz)) return;
        kit.lamp(edge.alongX ? 1 : 0.045, 0.035, edge.alongX ? 0.045 : 1, x + edge.ox, WALL_HEIGHT + 0.012, z + edge.oz, glazed ? NEON.cyan : theme.trim, 1.4);
      });
    }
  }
};

export const createRoom = (canvas, { still = false, lowPower = false } = {}) => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#060308');
  scene.fog = new THREE.FogExp2('#0b040d', 0.016);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 160);
  const view = { distance: 21.5 };
  const viewport = makeViewport(canvas, scene, camera, { lowPower, bloom: [0.5, 0.55, 0.55], onResize: ({ width, height }) => (view.distance = 21.5 * Math.max(1, 1.18 / (width / height))) });
  const reveal = { value: still ? 99 : -0.7 };
  const glow = glowTexture();

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#17121b' }));
  ground.position.set(W / 2, -0.13, D / 2);
  const grid = makeGrid(40, 40, NEON.red, 0.16);
  grid.position.set(W / 2, -0.125, D / 2);
  scene.add(ground, grid, new THREE.HemisphereLight('#4a2c66', '#1c0510', 0.8));
  const moon = new THREE.DirectionalLight('#8ea4ff', 0.45);
  moon.position.set(W / 2 + 8, 22, D / 2 + 10);
  moon.target.position.set(W / 2, 0, D / 2);
  scene.add(moon, moon.target);
  const lamps = [0, 1].map(() => {
    const light = new THREE.PointLight('#ffffff', 0, 10, 1.6);
    scene.add(light);
    return light;
  });

  const outline = new THREE.Group();
  const outlineMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(NEON.cyan).multiplyScalar(1.8), toneMapped: false, transparent: true });
  [
    [W / 2, 0, W, 0.06],
    [W / 2, D, W, 0.06],
    [0, D / 2, 0.06, D],
    [W, D / 2, 0.06, D],
  ].forEach(([x, z, w, d]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), outlineMaterial);
    bar.position.set(x, 0.03, z);
    outline.add(bar);
  });
  scene.add(outline);

  const state = { world: null, glows: null, car: null, spec: THEMES.bar, time: 0, last: 0, raf: 0, running: false, azimuth: 0.62, drag: 0, dragging: false, lastX: 0 };
  const look = new THREE.Vector3(W / 2, 0.2, D / 2 + 0.5);

  const place = () => {
    const azimuth = state.azimuth + state.drag + (still ? 0 : Math.sin(state.time * 0.22) * 0.24);
    const elevation = 0.9;
    camera.position.set(look.x + Math.sin(azimuth) * Math.cos(elevation) * view.distance, look.y + Math.sin(elevation) * view.distance, look.z + Math.cos(azimuth) * Math.cos(elevation) * view.distance);
    camera.lookAt(look);
  };

  const update = (dt) => {
    state.time += dt;
    if (!still) reveal.value += dt;
    place();
    const drawn = THREE.MathUtils.clamp((reveal.value + 0.7) / 0.6, 0, 1);
    const eased = 1 - (1 - drawn) ** 3;
    outline.scale.set(Math.max(0.001, eased), 1, Math.max(0.001, eased));
    outlineMaterial.opacity = THREE.MathUtils.clamp(1.6 - reveal.value, 0, 1);
    outline.visible = outlineMaterial.opacity > 0.01;
    const lit = THREE.MathUtils.clamp((reveal.value - 1.1) / 0.9, 0, 1);
    state.spec.lights.forEach(([, , , power], i) => (lamps[i].intensity = power * lit));
    state.glows?.update(state.time, reveal.value);
    if (state.car) state.car.scale.setScalar(THREE.MathUtils.damp(state.car.scale.x, reveal.value > 1.2 ? 1 : 0, 8, dt));
    if (!state.dragging) state.drag = THREE.MathUtils.damp(state.drag, 0, 0.6, dt);
  };

  const frame = (now) => {
    if (!state.running) return;
    const ms = state.last ? now - state.last : 16;
    state.last = now;
    update(Math.min(0.05, ms / 1000));
    viewport.render();
    viewport.tune(ms);
    state.raf = requestAnimationFrame(frame);
  };

  const settle = () => {
    for (let i = 0; i < 30; i += 1) update(0.05);
    viewport.render();
  };

  const build = (themeId, seed) => {
    const spec = THEMES[themeId] ?? THEMES.bar;
    const rng = mulberry(seed * 7919 + themeId.length * 131 + themeId.charCodeAt(0));
    [state.world, state.glows?.mesh, state.car].forEach((old) => {
      if (!old) return;
      scene.remove(old);
      disposeTree(old);
    });
    const kit = new Kit();
    const flip = rng() < 0.5;
    buildShell(kit, spec, rng);
    spec.furnish(kit, (x, z, lift = 0) => kit.at(x, z, 1.05 + Math.hypot(x - W / 2, z - D / 2) * 0.07, false, lift), rng, flip);
    state.world = meshesOf(kit, reveal);
    state.glows = makeGlows(kit.spots);
    state.car = null;
    if (spec.car) {
      state.car = makeCar(['#c6a300', '#8f1d2c', '#24468f'][Math.floor(rng() * 3)], glow, { lights: false });
      state.car.position.set(flip ? W - 5.4 : 5.4, 0, 4);
      state.car.rotation.y = rng() < 0.5 ? 0 : Math.PI;
      state.car.scale.setScalar(0);
      scene.add(state.car);
    }
    scene.add(state.world, state.glows.mesh);
    spec.lights.forEach(([color, x, z], i) => {
      lamps[i].color.set(color);
      lamps[i].position.set(flip ? W - x : x, 1.6, z);
    });
    state.spec = spec;
    reveal.value = still ? 99 : -0.7;
    if (still) settle();
  };

  const onDown = (event) => {
    state.dragging = true;
    state.lastX = event.clientX;
  };
  const onMove = (event) => {
    if (!state.dragging) return;
    state.drag = THREE.MathUtils.clamp(state.drag - (event.clientX - state.lastX) * 0.006, -1.4, 1.4);
    state.lastX = event.clientX;
  };
  const onUp = () => (state.dragging = false);
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  new ResizeObserver(() => {
    viewport.resize();
    if (still) settle();
  }).observe(canvas);
  viewport.resize();

  return {
    build,
    start: () => {
      if (state.running || still) return;
      state.running = true;
      state.last = 0;
      state.raf = requestAnimationFrame(frame);
    },
    stop: () => {
      state.running = false;
      cancelAnimationFrame(state.raf);
    },
  };
};
