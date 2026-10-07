import * as THREE from '../vendor/three.min.js';
import { Body, ContactMaterial, ConvexPolyhedron, Material, Plane, Quaternion as Spin, SAPBroadphase, Vec3, World } from '../vendor/cannon.min.js';

const PLANE_EPS = 1e-5;
const MATCH_EPS = 1e-8;
const PHI = (1 + Math.sqrt(5)) / 2;
const COS36 = Math.cos(Math.PI / 5);
const TEN_RING = 0.10557;

const v = (x, y, z) => new THREE.Vector3(x, y, z);

const signs = (values) =>
  values.reduce(
    (combos, value) =>
      combos.flatMap((combo) =>
        value === 0
          ? [[...combo, 0]]
          : [
              [...combo, value],
              [...combo, -value],
            ],
      ),
    [[]],
  );

const ring = (count, radius, y, offset) => Array.from({ length: count }, (_, i) => v(radius * Math.cos(offset + (2 * Math.PI * i) / count), y, radius * Math.sin(offset + (2 * Math.PI * i) / count)));

const RAW = {
  d4: [v(1, 1, 1), v(1, -1, -1), v(-1, 1, -1), v(-1, -1, 1)],
  d6: signs([1, 1, 1]).map(([x, y, z]) => v(x, y, z)),
  d8: [v(1, 0, 0), v(-1, 0, 0), v(0, 1, 0), v(0, -1, 0), v(0, 0, 1), v(0, 0, -1)],
  d10: [v(0, (TEN_RING * (1 + COS36)) / (1 - COS36), 0), v(0, (-TEN_RING * (1 + COS36)) / (1 - COS36), 0), ...ring(5, 1, TEN_RING, 0), ...ring(5, 1, -TEN_RING, Math.PI / 5)],
  d12: [...signs([1, 1, 1]), ...signs([0, 1 / PHI, PHI]), ...signs([1 / PHI, PHI, 0]), ...signs([PHI, 0, 1 / PHI])].map(([x, y, z]) => v(x, y, z)),
  d20: [...signs([0, 1, PHI]), ...signs([1, PHI, 0]), ...signs([PHI, 0, 1])].map(([x, y, z]) => v(x, y, z)),
};

const RADIUS = { d4: 0.95, d6: 0.74, d8: 0.82, d10: 0.8, d12: 0.84, d20: 0.86 };

const round = (x) => Math.round(x * 1e4) / 1e4 + 0;

const hull = (points) => {
  const planes = new Map();
  points.forEach((a, i) =>
    points.forEach((b, j) =>
      points.forEach((c, k) => {
        if (!(i < j && j < k)) return;
        const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
        if (normal.lengthSq() < PLANE_EPS) return;
        normal.normalize();
        const offset = normal.dot(a);
        const sides = points.map((p) => normal.dot(p) - offset);
        const outward = sides.every((s) => s <= PLANE_EPS) ? 1 : sides.every((s) => s >= -PLANE_EPS) ? -1 : 0;
        if (!outward) return;
        const facing = normal.multiplyScalar(outward);
        planes.set(`${round(facing.x)},${round(facing.y)},${round(facing.z)}`, { normal: facing, offset: offset * outward });
      }),
    ),
  );
  return [...planes.values()].map(({ normal, offset }) => {
    const members = points.flatMap((p, i) => (Math.abs(normal.dot(p) - offset) < PLANE_EPS ? [i] : []));
    const center = members.reduce((sum, i) => sum.add(points[i]), new THREE.Vector3()).divideScalar(members.length);
    const ref = new THREE.Vector3().subVectors(points[members[0]], center).normalize();
    const side = new THREE.Vector3().crossVectors(normal, ref);
    const angle = (i) => {
      const d = new THREE.Vector3().subVectors(points[i], center);
      return Math.atan2(d.dot(side), d.dot(ref));
    };
    return { normal, center, face: [...members].sort((a, b) => angle(a) - angle(b)) };
  });
};

const ordered = (faces) => [...faces].sort((a, b) => round(b.normal.y) - round(a.normal.y) || Math.atan2(a.normal.z, a.normal.x) - Math.atan2(b.normal.z, b.normal.x));

const valuesOf = (normals) => {
  const opposite = normals.map((n) => normals.findIndex((m) => m.dot(n) < -1 + 1e-6));
  if (opposite.some((j) => j < 0)) return normals.map((_, i) => i + 1);
  return normals.reduce((values, _, i) => {
    if (values[i]) return values;
    const low = values.filter(Boolean).length / 2 + 1;
    return values.map((value, j) => (j === i ? low : j === opposite[i] ? normals.length + 1 - low : value));
  }, Array(normals.length).fill(0));
};

const frameOf = (normal, toward) => {
  const a = toward.clone().projectOnPlane(normal).normalize();
  return new THREE.Matrix4().makeBasis(a, new THREE.Vector3().crossVectors(normal, a), normal);
};

const symmetriesOf = (vertices, faces, normals, centers) => {
  const unframe = frameOf(normals[0], new THREE.Vector3().subVectors(vertices[faces[0][0]], centers[0])).invert();
  const matchIn = (set, p) => set.findIndex((q) => q.distanceToSquared(p) < MATCH_EPS);
  return faces.flatMap((face, j) =>
    face.flatMap((corner) => {
      const rotation = frameOf(normals[j], new THREE.Vector3().subVectors(vertices[corner], centers[j])).multiply(unframe);
      if (vertices.some((p) => matchIn(vertices, p.clone().applyMatrix4(rotation)) < 0)) return [];
      return [{ quaternion: new THREE.Quaternion().setFromRotationMatrix(rotation), perm: normals.map((n) => matchIn(normals, n.clone().applyMatrix4(rotation))) }];
    }),
  );
};

const build = (kind) => {
  const raw = RAW[kind];
  const scale = RADIUS[kind] / Math.max(...raw.map((p) => p.length()));
  const vertices = raw.map((p) => p.clone().multiplyScalar(scale));
  const hulled = ordered(hull(vertices));
  const faces = hulled.map((h) => h.face);
  const normals = hulled.map((h) => h.normal);
  const centers = hulled.map((h) => h.center);
  return { kind, vertices, faces, normals, centers, values: valuesOf(normals), symmetries: symmetriesOf(vertices, faces, normals, centers), reads: kind === 'd4' ? 'bottom' : 'top' };
};

const memo = (make) => {
  const store = new Map();
  return (key) => store.get(key) ?? store.set(key, make(key)).get(key);
};

const solidOf = memo(build);

const readingFace = (solid, orientation) => {
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(orientation.clone().invert());
  const sign = solid.reads === 'top' ? 1 : -1;
  return solid.normals.reduce((best, n, i) => (sign * n.dot(up) > sign * solid.normals[best].dot(up) ? i : best), 0);
};

const flatness = (solid, orientation) => {
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(orientation.clone().invert());
  return Math.abs(solid.normals[readingFace(solid, orientation)].dot(up));
};

const labelTurn = (solid, value, landed) => {
  const wanted = solid.values.indexOf(value);
  return solid.symmetries.find((s) => s.perm[wanted] === landed)?.quaternion.clone() ?? new THREE.Quaternion();
};

const vertexValues = (solid) => solid.vertices.map((_, corner) => solid.values[solid.faces.findIndex((face) => !face.includes(corner))] ?? 0);

const LIFT = 0.004;
const LABEL_SCALE = { d4: 1.05, d6: 1.6, d8: 1.5, d10: 1.8, d12: 1.5, d20: 1.6 };

const inradius = (solid, i) => {
  const face = solid.faces[i];
  const center = solid.centers[i];
  return Math.min(
    ...face.map((corner, j) => {
      const a = solid.vertices[corner];
      const edge = new THREE.Vector3().subVectors(solid.vertices[face[(j + 1) % face.length]], a).normalize();
      const offset = new THREE.Vector3().subVectors(center, a);
      return offset.sub(edge.multiplyScalar(offset.dot(edge))).length();
    }),
  );
};

const spot = (solid, i, at, toward, value, size) => {
  const normal = solid.normals[i];
  const up = new THREE.Vector3().subVectors(toward, solid.centers[i]).projectOnPlane(normal).normalize();
  return { value, position: at.clone().addScaledVector(normal, LIFT), quaternion: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, normal), up, normal)), size };
};

const faceToward = (solid, i) => {
  const corners = solid.faces[i].map((corner) => solid.vertices[corner]);
  if (solid.kind === 'd10') return corners.reduce((apex, p) => (Math.abs(p.y) > Math.abs(apex.y) ? p : apex));
  if (solid.kind === 'd6') return new THREE.Vector3().addVectors(corners[0], corners[1]).multiplyScalar(0.5);
  return corners[0];
};

const labelSpots = (solid) => {
  const scale = LABEL_SCALE[solid.kind];
  if (solid.kind !== 'd4') return solid.faces.map((_, i) => spot(solid, i, solid.centers[i], faceToward(solid, i), solid.values[i], inradius(solid, i) * scale));
  const corners = vertexValues(solid);
  return solid.faces.flatMap((face, i) =>
    face.map((corner) => {
      const vertex = solid.vertices[corner];
      return spot(solid, i, solid.centers[i].clone().lerp(vertex, 0.5), vertex, corners[corner], inradius(solid, i) * scale);
    }),
  );
};

const TRAY = { width: 8, depth: 4.8 };
const FPS = 60;
const GRAVITY = -38;
const MAX_FRAMES = FPS * 6;
const STILL_FRAMES = 12;
const FLAT = 0.985;
const ATTEMPTS = 6;

const resting = (track, frame) => {
  const now = frame * 7;
  const then = (frame - STILL_FRAMES) * 7;
  const moved = Math.hypot(track[now] - track[then], track[now + 1] - track[then + 1], track[now + 2] - track[then + 2]);
  const turned = Math.abs(track[now + 3] * track[then + 3] + track[now + 4] * track[then + 4] + track[now + 5] * track[then + 5] + track[now + 6] * track[then + 6]);
  return moved < 0.01 && turned > 0.9999;
};

const between = (low, high) => low + Math.random() * (high - low);

const randomSpin = () => {
  const [u1, u2, u3] = [Math.random(), Math.random(), Math.random()];
  return new Spin(Math.sqrt(1 - u1) * Math.sin(2 * Math.PI * u2), Math.sqrt(1 - u1) * Math.cos(2 * Math.PI * u2), Math.sqrt(u1) * Math.sin(2 * Math.PI * u3), Math.sqrt(u1) * Math.cos(2 * Math.PI * u3));
};

const wall = (world, material, position, axis, angle) => {
  const body = new Body({ mass: 0, material, shape: new Plane() });
  body.position.copy(position);
  body.quaternion.setFromAxisAngle(axis, angle);
  world.addBody(body);
};

const launch = (kinds) => {
  const world = new World({ gravity: new Vec3(0, GRAVITY, 0), allowSleep: true });
  world.broadphase = new SAPBroadphase(world);
  const felt = new Material('table');
  const resin = new Material('dice');
  world.addContactMaterial(new ContactMaterial(felt, resin, { friction: 0.32, restitution: 0.42 }));
  world.addContactMaterial(new ContactMaterial(resin, resin, { friction: 0.18, restitution: 0.32 }));
  const x = new Vec3(1, 0, 0);
  const y = new Vec3(0, 1, 0);
  wall(world, felt, new Vec3(0, 0, 0), x, -Math.PI / 2);
  wall(world, felt, new Vec3(-TRAY.width / 2, 0, 0), y, Math.PI / 2);
  wall(world, felt, new Vec3(TRAY.width / 2, 0, 0), y, -Math.PI / 2);
  wall(world, felt, new Vec3(0, 0, -TRAY.depth / 2), y, 0);
  wall(world, felt, new Vec3(0, 0, TRAY.depth / 2), y, Math.PI);
  const from = Math.random() < 0.5 ? -1 : 1;
  const bodies = kinds.map((kind, i) => {
    const solid = solidOf(kind);
    const body = new Body({
      mass: 1,
      material: resin,
      shape: new ConvexPolyhedron({ vertices: solid.vertices.map((p) => new Vec3(p.x, p.y, p.z)), faces: solid.faces }),
      linearDamping: 0.08,
      angularDamping: 0.1,
      sleepSpeedLimit: 0.2,
      sleepTimeLimit: 0.25,
    });
    body.position.set(from * (TRAY.width / 2 - 1 - (i % 3) * 0.8), 1.7 + (i % 4) * 0.6 + Math.random() * 0.6, between(-TRAY.depth / 2 + 1.1, TRAY.depth / 2 - 1.1));
    body.quaternion.copy(randomSpin());
    body.velocity.set(-from * between(6, 10), between(-2, 1), between(-2, 2));
    body.angularVelocity.set(between(-20, 20), between(-20, 20), between(-20, 20));
    world.addBody(body);
    return body;
  });
  const samples = bodies.map(() => []);
  let settledAt = MAX_FRAMES - 1;
  for (let frame = 0; frame < MAX_FRAMES; frame += 1) {
    world.step(1 / FPS);
    bodies.forEach((body, i) => samples[i].push(body.position.x, body.position.y, body.position.z, body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w));
    if (frame >= STILL_FRAMES && samples.every((track) => resting(track, frame))) {
      settledAt = frame;
      break;
    }
  }
  const orientations = bodies.map((body) => new THREE.Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w));
  return {
    frames: settledAt + 1,
    settledAt,
    tracks: samples.map((track) => Float32Array.from(track)),
    landed: kinds.map((kind, i) => readingFace(solidOf(kind), orientations[i])),
    flat: Math.min(...kinds.map((kind, i) => flatness(solidOf(kind), orientations[i]))),
  };
};

const fly = (kinds) =>
  Array.from({ length: ATTEMPTS - 1 }).reduce((best) => {
    if (best.flat >= FLAT) return best;
    const next = launch(kinds);
    return next.flat > best.flat ? next : best;
  }, launch(kinds));

const GLYPH = 128;
const FONT = '"Chakra Petch", "Rajdhani", sans-serif';
const PIPS = {
  1: [[0, 0]],
  2: [
    [-1, -1],
    [1, 1],
  ],
  3: [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],
  4: [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ],
  5: [
    [-1, -1],
    [1, -1],
    [0, 0],
    [-1, 1],
    [1, 1],
  ],
  6: [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ],
};

const glyphTexture = memo((key) => {
  const canvas = document.createElement('canvas');
  canvas.width = GLYPH;
  canvas.height = GLYPH;
  const ctx = canvas.getContext('2d');
  const glow = (paint) => {
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 18;
    paint();
    ctx.shadowBlur = 0;
    paint();
  };
  if (key.startsWith('pips:')) {
    glow(() =>
      (PIPS[Number(key.slice(5))] ?? []).forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(GLYPH / 2 + x * 36, GLYPH / 2 + y * 36, 13, 0, Math.PI * 2);
        ctx.fill();
      }),
    );
  } else {
    ctx.font = `700 ${key.length > 1 ? 76 : 96}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    glow(() => {
      ctx.fillText(key, GLYPH / 2, GLYPH / 2 + 4);
      if (key === '6' || key === '9') ctx.fillRect(GLYPH / 2 - 24, GLYPH / 2 + 42, 48, 8);
    });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
});

const bodyGeometry = memo((kind) => {
  const solid = solidOf(kind);
  const corners = solid.faces.flatMap((face) => face.slice(1, -1).flatMap((corner, j) => [face[0], corner, face[j + 2]]));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      corners.flatMap((i) => solid.vertices[i].toArray()),
      3,
    ),
  );
  geometry.computeVertexNormals();
  return geometry;
});

const edgeGeometry = memo((kind) => {
  const solid = solidOf(kind);
  const bar = new THREE.BoxGeometry(1, 0.038, 0.038).toNonIndexed();
  const seen = new Set();
  const positions = [];
  const point = new THREE.Vector3();
  const axis = new THREE.Vector3(1, 0, 0);
  solid.faces.forEach((face) =>
    face.forEach((a, j) => {
      const b = face[(j + 1) % face.length];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(key)) return;
      seen.add(key);
      const from = solid.vertices[a];
      const to = solid.vertices[b];
      const direction = new THREE.Vector3().subVectors(to, from);
      const length = direction.length();
      const matrix = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(axis, direction.normalize()), new THREE.Vector3(length + 0.03, 1, 1));
      for (let i = 0; i < bar.attributes.position.count; i += 1) positions.push(...point.fromBufferAttribute(bar.attributes.position, i).applyMatrix4(matrix).toArray());
    }),
  );
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
});

const spotsOf = memo((kind) => labelSpots(solidOf(kind)));
const BODY_TINT = new THREE.Color('#070a12');
const bodyMaterial = memo(
  (color) => new THREE.MeshStandardMaterial({ color: BODY_TINT.clone().lerp(new THREE.Color(color), 0.08), metalness: 0.2, roughness: 0.42, emissive: new THREE.Color(color), emissiveIntensity: 0.07, flatShading: true }),
);
const edgeMaterial = memo((color) => new THREE.MeshBasicMaterial({ color }));
const labelMaterial = memo((key) => {
  const [color, glyph] = key.split('|');
  return new THREE.MeshBasicMaterial({ map: glyphTexture(glyph), color, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
});
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);
const faceText = (face, value) => (face === 'tens' ? `${value % 10}0` : face === 'units' ? `${value % 10}` : `${value}`);

const dieMesh = (die) => {
  const mesh = new THREE.Mesh(bodyGeometry(die.kind), bodyMaterial(die.color));
  mesh.add(new THREE.Mesh(edgeGeometry(die.kind), edgeMaterial(die.color)));
  spotsOf(die.kind).forEach((place) => {
    const label = new THREE.Mesh(UNIT_PLANE, labelMaterial(`${die.color}|${die.kind === 'd6' ? `pips:${place.value}` : faceText(die.face, place.value)}`));
    label.position.copy(place.position);
    label.quaternion.copy(place.quaternion);
    label.scale.setScalar(place.size);
    mesh.add(label);
  });
  return mesh;
};

const shadowTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
  gradient.addColorStop(0, 'rgba(0,0,0,0.85)');
  gradient.addColorStop(0.6, 'rgba(0,0,0,0.35)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 96, 96);
  return new THREE.CanvasTexture(canvas);
};

const backOut = (x) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;
const ELEVATION = (62 * Math.PI) / 180;
const FILL = 0.78;

export const createTray = (canvas) => {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);
  scene.add(new THREE.AmbientLight('#ffffff', 0.55));
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.position.set(3, 10, 5);
  const cyan = new THREE.PointLight('#1ef2ff', 45);
  cyan.position.set(-6, 4, -2);
  const magenta = new THREE.PointLight('#ff2bd6', 45);
  magenta.position.set(6, 3, 3);
  scene.add(key, cyan, magenta);
  const shade = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false });
  const state = { dice: [], raf: 0, fonts: document.fonts.load(`700 84px ${FONT}`).catch(() => {}) };

  const resize = () => {
    const box = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(box.width));
    const height = Math.max(1, Math.round(box.height));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width, height, false);
    const half = Math.tan((camera.fov * Math.PI) / 360);
    const aspect = width / height;
    const distance = Math.max((TRAY.depth * 0.5) / (half * FILL), (TRAY.width * 0.5) / (half * aspect * FILL));
    camera.aspect = aspect;
    camera.position.set(0, distance * Math.sin(ELEVATION), distance * Math.cos(ELEVATION));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  const clear = () => {
    cancelAnimationFrame(state.raf);
    state.dice.forEach(({ group, blob }) => scene.remove(group, blob));
    state.dice = [];
  };

  const pose = (flight, at, grow) => {
    const frame = Math.floor(at);
    const next = Math.min(frame + 1, flight.frames - 1);
    const blend = at - frame;
    const from = new THREE.Vector3();
    const to = new THREE.Vector3();
    const turn = new THREE.Quaternion();
    const turnNext = new THREE.Quaternion();
    state.dice.forEach(({ group, blob }, i) => {
      const track = flight.tracks[i];
      group.position.copy(from.fromArray(track, frame * 7).lerp(to.fromArray(track, next * 7), blend));
      group.quaternion.copy(turn.fromArray(track, frame * 7 + 3).slerp(turnNext.fromArray(track, next * 7 + 3), blend));
      group.scale.setScalar(grow);
      blob.position.set(group.position.x, 0.004, group.position.z);
      blob.scale.setScalar((1.9 + group.position.y * 0.5) * grow);
      blob.material.opacity = Math.max(0.15, 0.9 - group.position.y * 0.22);
    });
  };

  const toss = async (dice, instant = false) => {
    await state.fonts;
    clear();
    const flight = fly(dice.map((die) => die.kind));
    canvas.style.filter = `drop-shadow(0 0 10px ${dice[0].color}66)`;
    state.dice = dice.map((die, i) => {
      const group = new THREE.Group();
      const inner = dieMesh(die);
      inner.quaternion.copy(labelTurn(solidOf(die.kind), die.value, flight.landed[i]));
      group.add(inner);
      const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), shade.clone());
      scene.add(blob, group);
      return { group, blob };
    });
    if (instant) {
      pose(flight, flight.frames - 1, 1);
      renderer.render(scene, camera);
      return;
    }
    await new Promise((resolve) => {
      const started = performance.now();
      const frame = (now) => {
        const elapsed = (now - started) / 1000;
        const at = Math.min(elapsed * FPS, flight.frames - 1);
        pose(flight, at, backOut(Math.min(1, elapsed / 0.2)));
        renderer.render(scene, camera);
        if (at >= flight.settledAt) {
          resolve();
          return;
        }
        state.raf = requestAnimationFrame(frame);
      };
      state.raf = requestAnimationFrame(frame);
    });
  };

  return { toss, resize };
};
