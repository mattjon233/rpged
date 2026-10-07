import { portraitSVG } from './portrait.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const line = (id, n) => window.RPGED.line(id, n);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width: 900px)').matches;
const lowPower = small || (navigator.hardwareConcurrency ?? 8) <= 4 || (navigator.deviceMemory ?? 8) <= 4;
const canWebGL = 'WebGL2RenderingContext' in window;

const TONES = { check: '#1ef2ff', damage: '#ff2bd6', crit: '#fcee0a', fumble: '#ff1f3d' };
const CAST = {
  nara: { name: 'Nara', color: '#1ef2ff', hair: 1 },
  theo: { name: 'Theo', color: '#ff8a3d', hair: 2, lift: 1.5 },
  ravi: { name: 'Ravi', color: '#a06bff', hair: 6 },
  juno: { name: 'Juno', color: '#3dff9a', hair: 8, lift: 1.5 },
  guard1: { name: 'Guard A', color: '#ff1f3d', hair: 4, guard: true },
  guard2: { name: 'Guard B', color: '#ff1f3d', hair: 5, guard: true },
};
const nameOf = (id) => (CAST[id].guard ? line('guard') : CAST[id].name);
const faceOf = (id) => portraitSVG(CAST[id]);

const whenVisible = (element, enter, leave = () => {}, margin = '0px') => {
  if (!element) return;
  if (!('IntersectionObserver' in window)) {
    enter();
    return;
  }
  new IntersectionObserver((entries) => entries.forEach((entry) => (entry.isIntersecting ? enter() : leave())), { rootMargin: margin }).observe(element);
};

const once = (element, run, margin = '200px') => {
  if (!element) return;
  if (!('IntersectionObserver' in window)) {
    run();
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      run();
    },
    { rootMargin: margin },
  );
  observer.observe(element);
};

const shown = (element, run, threshold = 0.6) => {
  if (!element || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      run();
    },
    { threshold },
  );
  observer.observe(element);
};

const motion = { paused: false, watchers: new Set() };

const ticker = (element, step, ms) => {
  let timer = 0;
  whenVisible(
    element,
    () => {
      if (!timer) timer = setInterval(() => motion.paused || step(), ms);
    },
    () => {
      clearInterval(timer);
      timer = 0;
    },
  );
};

const paintFaces = () => $$('.face[data-face]').forEach((face) => (face.innerHTML = portraitSVG({ name: face.dataset.face, color: face.dataset.color, hair: Number(face.dataset.hair) })));

const setupNav = () => {
  const nav = $('#nav');
  const update = () => nav.classList.toggle('is-solid', window.scrollY > 24);
  update();
  window.addEventListener('scroll', update, { passive: true });
};

const setupMenu = () => {
  const menu = $('#menu');
  if (!menu) return;
  const close = () => menu.removeAttribute('open');
  menu.addEventListener('click', (event) => event.target.closest('a') && close());
  document.addEventListener('click', (event) => menu.contains(event.target) || close());
  document.addEventListener('keydown', (event) => event.key === 'Escape' && close());
};

const setupMotion = () => {
  const button = $('#motion-toggle');
  if (!button || reduced) return;
  button.hidden = false;
  button.addEventListener('click', () => {
    motion.paused = !motion.paused;
    button.setAttribute('aria-pressed', String(motion.paused));
    document.documentElement.classList.toggle('is-paused', motion.paused);
    motion.watchers.forEach((watch) => watch());
  });
};

const setupReveal = () => {
  const items = $$('[data-reveal]');
  if (reduced || !('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('is-in'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }),
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  items.forEach((item) => observer.observe(item));
};

const dieMarkup = (sides, value, tone) =>
  `<span class="die" style="--tone:${tone}"><svg viewBox="0 0 40 40" aria-hidden="true">${sides === 6 ? '<rect x="5" y="5" width="30" height="30" rx="4"/>' : '<polygon points="20,2 36,12 36,28 20,38 4,28 4,12"/>'}</svg><span>${value}</span></span>`;

const makeHud = () => {
  const cap = $('#hud-cap');
  const capWho = $('#hud-cap-who');
  const capText = $('#hud-cap-text');
  const roll = $('#hud-roll');
  const rollLabel = $('#hud-roll-label');
  const rollDice = $('#hud-roll-dice');
  const rollTotal = $('#hud-roll-total');
  const rollMath = $('#hud-roll-math');
  const init = $('#hud-init');
  const combat = $('#hud-combat');
  const music = $('#hud-music');
  const musicName = $('#hud-music-name');
  const vote = $('#hud-vote');
  const voters = $('#hud-voters');
  const voteResult = $('#hud-vote-result');
  const playing = { id: 'tension' };
  const typing = { text: '', shown: 0, rate: 34 };
  const rolling = { on: false, time: 0, spec: null, flicker: 0 };
  const VOTERS = ['nara', 'theo', 'ravi', 'juno'];
  const ORDER = [
    ['theo', 24],
    ['nara', 21],
    ['guard1', 17],
    ['juno', 15],
    ['ravi', 12],
    ['guard2', 9],
  ];

  musicName.removeAttribute('data-pt');
  document.addEventListener('rpged:lang', () => (musicName.textContent = line(playing.id)));

  const replay = (element) => {
    element.hidden = true;
    void element.offsetWidth;
    element.hidden = false;
  };

  const say = (who, id, instant = false) => {
    const narrator = who === 'gm';
    cap.style.setProperty('--tone', narrator ? '#fcee0a' : CAST[who].color);
    capWho.innerHTML = `${narrator ? '<svg class="ico" aria-hidden="true"><use href="#i-feather"/></svg>' : ''}<span>${narrator ? line('gm') : nameOf(who)}</span>`;
    typing.text = line(id);
    typing.shown = instant ? typing.text.length : 0;
    capText.textContent = instant ? typing.text : '';
    cap.classList.toggle('is-done', instant);
    replay(cap);
  };

  const rollMathOf = (spec) => {
    const total = spec.dice.reduce((sum, value) => sum + value, 0) + (spec.bonus ?? 0);
    if (spec.kind === 'damage') return { total, math: `${spec.dice.join(' + ')} = <b>${total} ${line('damage')}</b>` };
    const verdict = spec.crit ? `${line('crit')} · ${line(spec.verdict)}` : line(spec.verdict);
    return { total, math: `${spec.dice.join(' + ')} + ${spec.bonus} = ${total} · ${line('vs')} ${spec.target} · <b>${verdict}</b>` };
  };

  const showRoll = (spec) => {
    rolling.on = true;
    rolling.time = 0;
    rolling.spec = spec;
    const tone = spec.kind === 'damage' ? TONES.damage : TONES.check;
    roll.style.setProperty('--tone', tone);
    rollLabel.textContent = line(spec.label);
    rollDice.innerHTML = '';
    rollTotal.textContent = '';
    rollMath.innerHTML = '&nbsp;';
    replay(roll);
  };

  const tickRoll = (dt) => {
    if (!rolling.on) return;
    const spec = rolling.spec;
    rolling.time += dt;
    rolling.flicker += dt;
    const sides = spec.kind === 'damage' ? 6 : 10;
    const base = spec.kind === 'damage' ? TONES.damage : TONES.check;
    const landed = spec.dice.map((_, i) => rolling.time >= 1.1 + (spec.kind === 'damage' ? i * 0.18 : i * 1.2));
    const born = spec.dice.map((_, i) => spec.kind === 'damage' || i === 0 || rolling.time >= 1.3);
    if (rolling.flicker > 0.07 || landed.every(Boolean)) {
      rolling.flicker = 0;
      rollDice.innerHTML = spec.dice
        .map((value, i) => {
          if (!born[i]) return '';
          const tone = spec.crit && (landed[0] || i > 0) ? TONES.crit : base;
          return landed[i] ? dieMarkup(sides, value, tone) : dieMarkup(sides, 1 + Math.floor(Math.random() * sides), tone).replace('class="die"', 'class="die is-rolling"');
        })
        .join('');
    }
    if (!landed.every(Boolean)) return;
    const { total, math } = rollMathOf(spec);
    if (spec.crit) roll.style.setProperty('--tone', TONES.crit);
    rollTotal.textContent = total;
    rollMath.innerHTML = math;
    rolling.on = false;
  };

  const showInit = () => {
    init.innerHTML = ORDER.map(([id, value], i) => `<li style="--pc:${CAST[id].color};--i:${i}" data-id="${id}" class="${i === 0 ? 'is-turn' : ''}"><i class="face">${faceOf(id)}</i><span>${nameOf(id)}</span><b>${value}</b></li>`).join('');
    init.hidden = false;
  };

  const showVote = () => {
    voters.innerHTML = VOTERS.map((id) => `<span class="voter" style="--pc:${CAST[id].color}">${CAST[id].name} <span>${line('thinking')}</span></span>`).join('');
    voteResult.textContent = '';
    replay(vote);
  };

  return {
    say,
    hideCap: () => (cap.hidden = true),
    roll: showRoll,
    hideRoll: () => {
      roll.hidden = true;
      rolling.on = false;
    },
    init: showInit,
    hideInit: () => (init.hidden = true),
    out: (id) => $(`[data-id="${id}"]`, init)?.classList.add('is-out'),
    combat: (on) => {
      if (on) replay(combat);
      else combat.hidden = true;
    },
    music: (id, fight) => {
      playing.id = id;
      musicName.textContent = line(id);
      music.classList.toggle('is-fight', fight);
    },
    vote: showVote,
    cast: (index, go) => {
      const voter = voters.children[index];
      if (!voter) return;
      voter.classList.add(go ? 'is-go' : 'is-stop');
      voter.lastElementChild.textContent = line(go ? 'go' : 'stop');
    },
    verdict: () => (voteResult.textContent = line('verdict')),
    clear: () => {
      [cap, roll, init, combat, vote].forEach((element) => (element.hidden = true));
      rolling.on = false;
      playing.id = 'tension';
      musicName.textContent = line('tension');
      music.classList.remove('is-fight');
    },
    tick: (dt) => {
      tickRoll(dt);
      if (cap.hidden || typing.shown >= typing.text.length) return;
      typing.shown = Math.min(typing.text.length, typing.shown + dt * typing.rate);
      capText.textContent = typing.text.slice(0, Math.floor(typing.shown));
      if (typing.shown >= typing.text.length) cap.classList.add('is-done');
    },
  };
};

const makeTags = (scene) => {
  const layer = $('#stage-tags');
  const tags = new Map(
    Object.keys(CAST).map((id) => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.style.setProperty('--pc', CAST[id].color);
      tag.innerHTML = `<i></i><span>${nameOf(id)}</span>`;
      layer.append(tag);
      return [id, tag];
    }),
  );
  document.addEventListener('rpged:lang', () => tags.forEach((tag, id) => (tag.lastElementChild.textContent = nameOf(id))));
  return {
    update: () =>
      tags.forEach((tag, id) => {
        const spot = scene.api.project(id, CAST[id].lift);
        tag.classList.toggle('is-on', spot.visible);
        tag.style.transform = `translate3d(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
      }),
    mark: (id, name, on) => tags.get(id)?.classList.toggle(name, on),
    clear: () => tags.forEach((tag) => tag.classList.remove('is-down', 'is-talking')),
  };
};

const LOOP = 49.4;

const cuesOf = (hud, scene, tags, stage) => {
  const act = scene?.api;
  const talk = (id) => {
    tags?.clear();
    if (id) tags?.mark(id, 'is-talking', true);
    if (id) act?.pulse(id);
  };
  return [
    [0.2, () => act?.traffic(1)],
    [0.9, () => hud.say('gm', 'n1')],
    [6.4, () => (hud.say('nara', 'p1'), talk('nara'))],
    [
      7.1,
      () =>
        act?.walk(
          'nara',
          [
            [18, 8],
            [22, 8],
          ],
          3.4,
        ),
    ],
    [10.3, () => (talk(null), hud.roll({ label: 'r1', kind: 'check', dice: [7], bonus: 9, target: 13, verdict: 'passed' }))],
    [14.2, () => (hud.say('gm', 'n2'), act?.uncover(21, 7, 7.2), act?.show('guard1'), act?.show('guard2'), act?.ping(20, 4))],
    [15.2, () => hud.hideRoll()],
    [20.2, () => (hud.say('theo', 'p2'), talk('theo'))],
    [
      20.8,
      () =>
        act?.walk(
          'theo',
          [
            [21, 9],
            [23, 8],
          ],
          4,
        ),
    ],
    [22.0, () => act?.door('front', true)],
    [
      22.5,
      () => (
        act?.walk('theo', [[23, 6]], 4),
        hud.combat(true),
        hud.music('fight', true),
        hud.init(),
        act?.turn('theo'),
        act?.walk(
          'ravi',
          [
            [20, 9],
            [20, 8],
          ],
          4,
        ),
        act?.walk(
          'juno',
          [
            [22, 10],
            [24, 8],
          ],
          4,
        )
      ),
    ],
    [24.4, () => (talk(null), hud.hideCap(), act?.sight('theo', 'guard1'))],
    [24.9, () => hud.roll({ label: 'r2', kind: 'check', dice: [10, 6], crit: true, bonus: 12, target: 15, verdict: 'hit' })],
    [28.6, () => act?.shot('theo', 'guard1')],
    [28.8, () => (act?.drop('guard1'), act?.sight(null), tags?.mark('guard1', 'is-down', true), hud.out('guard1'), hud.roll({ label: 'r3', kind: 'damage', dice: [5, 4, 6] }))],
    [32.4, () => (hud.hideRoll(), hud.say('gm', 'n3'), act?.turn(null))],
    [33.0, () => act?.traffic(-1)],
    [38.2, () => (hud.say('juno', 'p3'), talk('juno'))],
    [41.4, () => (talk(null), hud.hideCap(), hud.combat(false), hud.hideInit(), hud.music('tension', false), hud.vote())],
    [42.2, () => hud.cast(0, true)],
    [42.9, () => hud.cast(1, true)],
    [43.6, () => hud.cast(2, true)],
    [44.3, () => hud.cast(3, false)],
    [45.0, () => hud.verdict()],
    [48.2, () => stage.classList.add('is-fading')],
  ];
};

const setupHero = async () => {
  const stage = $('#stage');
  const canvas = $('#stage-canvas');
  const hud = makeHud();
  const saveData = navigator.connection?.saveData === true;
  let scene = null;
  if (canWebGL && !saveData) {
    try {
      const { createHero } = await import('./hero.js');
      scene = createHero(canvas, { still: reduced, lowPower });
    } catch {
      scene = null;
    }
  }
  const tags = scene ? makeTags(scene) : null;
  stage.classList.toggle('is-flat', !scene);

  if (reduced) {
    if (scene) {
      scene.api.jump('nara', 22, 8);
      scene.api.uncover(21, 7, 7.2);
      scene.api.show('guard1');
      scene.api.show('guard2');
      scene.onFrame(() => tags.update());
      scene.settle();
      stage.classList.add('is-live');
    }
    hud.say('gm', 'n2', true);
    document.addEventListener('rpged:lang', () => hud.say('gm', 'n2', true));
    return;
  }

  const cues = cuesOf(hud, scene, tags, stage);
  const state = { time: scene ? -3.6 : -0.6, next: 0 };
  const restart = () => {
    state.time = -0.8;
    state.next = 0;
    hud.clear();
    tags?.clear();
    scene?.api.reset();
    stage.classList.remove('is-fading');
  };
  const step = (dt) => {
    state.time += dt;
    while (state.next < cues.length && cues[state.next][0] <= state.time) {
      cues[state.next][1]();
      state.next += 1;
    }
    hud.tick(dt);
    if (state.time >= LOOP) restart();
  };

  if (scene) {
    scene.onFrame((_, dt) => {
      step(dt);
      tags.update();
    });
    const view = { on: false };
    const sync = () => (view.on && !document.hidden && !motion.paused ? scene.start() : scene.stop());
    whenVisible(
      $('#top'),
      () => {
        view.on = true;
        sync();
      },
      () => {
        view.on = false;
        sync();
      },
    );
    document.addEventListener('visibilitychange', sync);
    motion.watchers.add(sync);
    requestAnimationFrame(() => stage.classList.add('is-live', 'is-moving'));
    return;
  }

  const clock = { last: 0, raf: 0, on: false };
  const frame = (now) => {
    if (!clock.on) return;
    if (!motion.paused) step(Math.min(0.05, clock.last ? (now - clock.last) / 1000 : 0.016));
    clock.last = now;
    clock.raf = requestAnimationFrame(frame);
  };
  whenVisible(
    $('#top'),
    () => {
      if (clock.on) return;
      clock.on = true;
      clock.last = 0;
      clock.raf = requestAnimationFrame(frame);
    },
    () => {
      clock.on = false;
      cancelAnimationFrame(clock.raf);
    },
  );
};

const setupConsole = () => {
  const box = $('#console');
  if (!box || reduced) return;
  const rows = $$('.cl', box);
  let index = -1;
  box.classList.add('is-playing');
  const step = () => {
    index = (index + 1) % (rows.length + 1);
    rows.forEach((row, i) => {
      row.classList.toggle('is-now', i === index);
      row.classList.toggle('is-past', i < index || index === rows.length);
    });
  };
  step();
  ticker(box, step, 2400);
};

const setupTurn = () => {
  const box = $('#turn');
  if (!box) return;
  const ring = $('#turn-ring');
  const label = $('#turn-time');
  const rows = $$('#turn-queue li');
  if (reduced) return;
  let left = 120;
  let turn = 0;
  ticker(
    box,
    () => {
      left -= 1.6;
      if (left <= 0) {
        left = 120;
        turn = (turn + 1) % rows.length;
        rows.forEach((row, i) => row.classList.toggle('is-turn', i === turn));
      }
      const seconds = Math.max(0, Math.ceil(left));
      ring.style.setProperty('--p', ((left / 120) * 100).toFixed(1));
      ring.classList.toggle('is-low', seconds <= 20);
      label.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    },
    100,
  );
};

const setupVote = () => {
  const box = $('#vote');
  if (!box) return;
  const voters = $$('.voter', box);
  const [go, stop] = $$('.vote__bar i', box);
  const out = $('#vote-out');
  let stage = 0;
  const paint = () => {
    let yes = 0;
    let no = 0;
    voters.forEach((voter, i) => {
      const mark = voter.lastElementChild;
      const cast = i < stage;
      const wantsGo = mark.dataset.go === '1';
      voter.classList.toggle('is-go', cast && wantsGo);
      voter.classList.toggle('is-stop', cast && !wantsGo);
      mark.textContent = line(cast ? (wantsGo ? 'go' : 'stop') : 'thinking');
      if (cast) wantsGo ? (yes += 1) : (no += 1);
    });
    go.style.width = `${(yes / voters.length) * 100}%`;
    stop.style.width = `${(no / voters.length) * 100}%`;
    out.textContent = stage >= voters.length ? line('verdict') : '';
  };
  document.addEventListener('rpged:lang', paint);
  if (reduced) {
    stage = voters.length;
    paint();
    return;
  }
  paint();
  ticker(
    box,
    () => {
      stage = stage >= voters.length + 3 ? 0 : stage + 1;
      paint();
    },
    850,
  );
};

const setupSound = () => {
  const box = $('#sound');
  if (!box) return;
  const deck = $('#deck');
  const bars = $('#deck-bars');
  const name = $('#deck-name');
  const bpm = $('#deck-bpm');
  const buttons = $$('.scene', box);
  bars.innerHTML = Array.from({ length: 30 }, (_, i) => `<i style="--n:${i};height:${30 + ((i * 37) % 70)}%"></i>`).join('');
  const pick = (button) => {
    buttons.forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
    deck.style.setProperty('--tone', button.dataset.tone);
    deck.style.setProperty('--beat', `${(120 / Number(button.dataset.bpm)).toFixed(2)}s`);
    name.textContent = button.textContent;
    name.removeAttribute('data-pt');
    bpm.textContent = button.dataset.bpm;
  };
  buttons.forEach((button) => button.addEventListener('click', () => pick(button)));
  document.addEventListener('rpged:lang', () => pick(buttons.find((button) => button.getAttribute('aria-pressed') === 'true')));
  pick(buttons.find((button) => button.getAttribute('aria-pressed') === 'true'));
};

const setupCell = () => {
  const box = $('#cell');
  if (!box || reduced) return;
  const parts = [...$$('.bubble', box), $('.call', box)];
  let shown = 0;
  box.classList.add('is-playing');
  const paint = () => parts.forEach((part, i) => part.classList.toggle('is-shown', i < shown));
  ticker(
    box,
    () => {
      shown = shown >= parts.length + 3 ? 0 : shown + 1;
      paint();
    },
    1100,
  );
};

const setupLos = () => {
  const box = $('#los');
  if (!box) return;
  const status = $('#los-status');
  const W = 12;
  const H = 7;
  const NS = 'http://www.w3.org/2000/svg';
  const WALLS = [
    [4, 0],
    [4, 1],
    [4, 2],
    [4, 6],
  ];
  const GLASS = [
    [4, 4],
    [4, 5],
  ];
  const DOOR = [4, 3];
  const CRATE = [7, 3];
  const SHOOTER = [1, 3];
  const START = [10, 3];
  const state = { target: [...START], door: false, crate: 20, note: null, dragging: false };
  const key = ([x, y]) => `${x},${y}`;
  const walls = new Set(WALLS.map(key));
  const glass = new Set(GLASS.map(key));
  const make = (tag, attrs, parent) => {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
    parent.append(node);
    return node;
  };
  const svg = make('svg', { viewBox: `0 0 ${W} ${H}`, role: 'application', tabindex: '0', 'aria-label': line('los-label') }, box);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) make('rect', { class: 'los__cell', x, y, width: 1, height: 1 }, svg);
  WALLS.forEach(([x, y]) => make('rect', { class: 'los__wall', x: x + 0.04, y: y + 0.04, width: 0.92, height: 0.92 }, svg));
  GLASS.forEach(([x, y]) => make('rect', { class: 'los__glass', x: x + 0.3, y: y + 0.04, width: 0.4, height: 0.92 }, svg));
  const door = make('rect', { class: 'los__door', x: DOOR[0] + 0.25, y: DOOR[1] + 0.04, width: 0.5, height: 0.92 }, svg);
  const crate = make('rect', { class: 'los__crate', x: CRATE[0] + 0.14, y: CRATE[1] + 0.14, width: 0.72, height: 0.72 }, svg);
  const ray = make('line', { class: 'los__ray' }, svg);
  make('circle', { class: 'los__tok los__tok--a', cx: SHOOTER[0] + 0.5, cy: SHOOTER[1] + 0.5, r: 0.32 }, svg);
  const target = make('circle', { class: 'los__tok los__tok--b', r: 0.32 }, svg);
  const hit = make('circle', { class: 'los__hit', r: 0.1 }, svg);

  const trace = () => {
    const from = [SHOOTER[0] + 0.5, SHOOTER[1] + 0.5];
    const to = [state.target[0] + 0.5, state.target[1] + 0.5];
    const distance = Math.round(Math.hypot(to[0] - from[0], to[1] - from[1]) * 2);
    let through = false;
    for (let i = 1; i < 240; i += 1) {
      const t = i / 240;
      const cell = [Math.floor(from[0] + (to[0] - from[0]) * t), Math.floor(from[1] + (to[1] - from[1]) * t)];
      const id = key(cell);
      if (id === key(SHOOTER) || id === key(state.target)) continue;
      if (walls.has(id)) return { kind: 'wall', distance, at: t };
      if (id === key(DOOR) && !state.door) return { kind: 'door', distance, at: t };
      if (id === key(CRATE) && state.crate > 0) return { kind: 'cover', distance, at: t };
      if (glass.has(id)) through = true;
    }
    return { kind: through ? 'glass' : 'clear', distance, at: 1 };
  };

  const paint = () => {
    const result = trace();
    const blocked = result.kind === 'wall' || result.kind === 'door';
    const from = [SHOOTER[0] + 0.5, SHOOTER[1] + 0.5];
    const to = [state.target[0] + 0.5, state.target[1] + 0.5];
    const end = result.kind === 'clear' || result.kind === 'glass' ? 1 : result.at;
    ray.setAttribute('x1', from[0]);
    ray.setAttribute('y1', from[1]);
    ray.setAttribute('x2', from[0] + (to[0] - from[0]) * end);
    ray.setAttribute('y2', from[1] + (to[1] - from[1]) * end);
    ray.setAttribute('class', `los__ray${blocked ? ' is-blocked' : result.kind === 'cover' ? ' is-cover' : ''}`);
    target.setAttribute('cx', to[0]);
    target.setAttribute('cy', to[1]);
    door.setAttribute('class', `los__door ${state.door ? 'is-open' : 'is-shut'}`);
    crate.style.opacity = state.crate > 0 ? 0.35 + (state.crate / 20) * 0.65 : 0.12;
    crate.setAttribute('stroke-dasharray', state.crate > 0 ? 'none' : '0.1 0.1');
    const text = state.note ?? (result.kind === 'cover' ? line('los-cover', state.crate) : line(`los-${result.kind}`, result.distance));
    const tone = state.note?.tone ?? (blocked ? '#ff1f3d' : result.kind === 'cover' ? '#ff8a3d' : '#1ef2ff');
    status.textContent = typeof text === 'string' ? text : text.text();
    status.style.setProperty('--tone', tone);
    return result;
  };

  const free = (cell) => cell[0] >= 0 && cell[1] >= 0 && cell[0] < W && cell[1] < H && ![...WALLS, ...GLASS, DOOR, SHOOTER].some((other) => key(other) === key(cell)) && !(key(cell) === key(CRATE) && state.crate > 0);
  const cellAt = (event) => {
    const box = svg.getBoundingClientRect();
    return [Math.floor(((event.clientX - box.left) / box.width) * W), Math.floor(((event.clientY - box.top) / box.height) * H)];
  };
  const move = (cell) => {
    if (!free(cell)) return;
    state.target = cell;
    state.note = null;
    paint();
  };
  const note = (id, tone, n) => {
    state.note = { text: () => line(id, n), tone };
    paint();
  };

  svg.addEventListener('click', (event) => {
    const cell = cellAt(event);
    if (key(cell) !== key(DOOR)) return move(cell);
    state.door = !state.door;
    state.note = null;
    return paint();
  });
  svg.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || key(cellAt(event)) === key(DOOR)) return;
    state.dragging = true;
    svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove', (event) => state.dragging && move(cellAt(event)));
  ['pointerup', 'pointercancel'].forEach((name) => svg.addEventListener(name, () => (state.dragging = false)));
  svg.addEventListener('keydown', (event) => {
    const steps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const delta = steps[event.key];
    if (delta) {
      event.preventDefault();
      move([state.target[0] + delta[0], state.target[1] + delta[1]]);
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      state.door = !state.door;
      state.note = null;
      paint();
    }
  });

  $('#los-fire').addEventListener('click', () => {
    state.note = null;
    const result = paint();
    if (result.kind === 'wall' || result.kind === 'door') return note('los-refused', '#ff1f3d');
    const point = result.kind === 'cover' ? CRATE : state.target;
    hit.setAttribute('cx', point[0] + 0.5);
    hit.setAttribute('cy', point[1] + 0.5);
    hit.classList.remove('is-on');
    void hit.getBoundingClientRect();
    hit.classList.add('is-on');
    if (result.kind === 'cover') {
      state.crate = Math.max(0, state.crate - (7 + Math.floor(Math.random() * 6)));
      return state.crate > 0 ? note('los-chip', '#ff8a3d', state.crate) : note('los-broken', '#fcee0a');
    }
    return note('los-hit', '#3dff9a', 6 + Math.floor(Math.random() * 12));
  });
  $('#los-reset').addEventListener('click', () => {
    Object.assign(state, { target: [...START], door: false, crate: 20, note: null });
    paint();
  });
  document.addEventListener('rpged:lang', () => {
    svg.setAttribute('aria-label', line('los-label'));
    paint();
  });
  paint();
};

const setupFog = () => {
  const canvas = $('#fog-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 20;
  const H = 10;
  const ROWS = [
    '....................',
    '.########..#######..',
    '.#......#..#.....#..',
    '.#......D..D.....#..',
    '.#......#..#.....#..',
    '.####D###..###D###..',
    '....................',
    '..######....#####...',
    '..#....D....D...#...',
    '..######....#####...',
  ];
  const PATH = [
    [9, 0],
    [9, 3],
    [6, 3],
    [3, 3],
    [5, 3],
    [5, 6],
    [9, 6],
    [9, 8],
    [10, 8],
    [10, 3],
    [14, 3],
    [14, 6],
    [18, 6],
    [18, 0],
    [9, 0],
  ];
  const LOOT = [
    [3, 2, '#fcee0a'],
    [15, 2, '#1ef2ff'],
    [4, 8, '#ff2bd6'],
    [14, 8, '#3dff9a'],
  ];
  const FOE = [15, 4];
  const seen = new Float32Array(W * H);
  const noise = Array.from({ length: W * H * 3 }, (_, i) => (Math.sin(i * 91.7) * 43758.5453) % 1);
  const state = { leg: 0, t: 0, x: PATH[0][0], y: PATH[0][1], hold: 0, raf: 0, on: false, last: 0 };

  const draw = (time) => {
    const box = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(box.width * ratio)) {
      canvas.width = Math.round(box.width * ratio);
      canvas.height = Math.round(box.height * ratio);
    }
    const s = canvas.width / W;
    ctx.setTransform(s, 0, 0, canvas.height / H, 0, 0);
    ctx.fillStyle = '#0b070d';
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const ch = ROWS[y][x];
        ctx.fillStyle = ch === '#' ? '#2b2630' : ch === 'D' ? '#1f3a2c' : '#15101a';
        ctx.fillRect(x + 0.03, y + 0.03, 0.94, 0.94);
        if (ch === '#') {
          ctx.fillStyle = '#ff1f3d';
          ctx.fillRect(x + 0.03, y + 0.03, 0.94, 0.07);
        }
      }
    }
    LOOT.forEach(([x, y, color]) => {
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = s * 0.5;
      ctx.fillRect(x + 0.3, y + 0.3, 0.4, 0.4);
    });
    ctx.shadowBlur = 0;
    const ring = (x, y, color) => {
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = s * 0.5;
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      ctx.arc(x + 0.5, y + 0.5, 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    };
    ring(FOE[0], FOE[1], '#ff1f3d');
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const i = y * W + x;
        const near = Math.hypot(x - state.x, y - state.y) < 3.3;
        seen[i] = Math.min(1, seen[i] + (near ? 0.12 : 0));
        const fog = 1 - seen[i];
        if (fog <= 0.01) continue;
        ctx.fillStyle = `rgba(6,3,7,${fog})`;
        ctx.fillRect(x, y, 1.01, 1.01);
        const flick = Math.abs(noise[(i * 3 + Math.floor(time * 6)) % noise.length]);
        ctx.fillStyle = `rgba(255,60,90,${fog * flick * 0.34})`;
        ctx.fillRect(x + flick * 0.6, y + Math.abs(noise[i]) * 0.8, 0.3, 0.07);
        ctx.fillStyle = `rgba(190,170,200,${fog * (1 - flick) * 0.2})`;
        ctx.fillRect(x + (1 - flick) * 0.5, y + Math.abs(noise[i + 1]) * 0.8, 0.22, 0.07);
      }
    }
    ring(state.x, state.y, '#1ef2ff');
  };

  const advance = (dt) => {
    if (state.hold > 0) {
      state.hold -= dt;
      if (state.hold <= 0) seen.fill(0);
      return;
    }
    const [ax, ay] = PATH[state.leg];
    const [bx, by] = PATH[state.leg + 1];
    const length = Math.hypot(bx - ax, by - ay);
    state.t += (dt * 3) / length;
    if (state.t >= 1) {
      state.t = 0;
      state.leg += 1;
      if (state.leg >= PATH.length - 1) {
        state.leg = 0;
        state.hold = 1.6;
      }
    }
    const [cx, cy] = PATH[state.leg];
    const [dx, dy] = PATH[state.leg + 1];
    state.x = cx + (dx - cx) * state.t;
    state.y = cy + (dy - cy) * state.t;
  };

  if (reduced) {
    state.x = 6;
    state.y = 3;
    for (let i = 0; i < 12; i += 1) draw(0);
    return;
  }
  const frame = (now) => {
    if (!state.on) return;
    if (!motion.paused) advance(Math.min(0.05, state.last ? (now - state.last) / 1000 : 0.016));
    state.last = now;
    if (!motion.paused) draw(now / 1000);
    state.raf = requestAnimationFrame(frame);
  };
  whenVisible(
    canvas,
    () => {
      if (state.on) return;
      state.on = true;
      state.last = 0;
      state.raf = requestAnimationFrame(frame);
    },
    () => {
      state.on = false;
      cancelAnimationFrame(state.raf);
    },
  );
};

const setupDice = () => {
  const host = $('#dice');
  if (!host) return;
  const tray = $('#tray');
  const seal = $('#tray-seal');
  const out = $('#tray-out');
  const total = $('#tray-total');
  const math = $('#tray-math');
  const verdict = $('#tray-verdict');
  const button = $('#dice-roll');
  const dieButtons = $$('[data-die]', host);
  const kindButtons = $$('[data-kind]', host);
  const state = { die: 'd10', kind: 'check', engine: null, loading: null, busy: false, last: null };
  const choose = (buttons, chosen) => buttons.forEach((other) => other.setAttribute('aria-pressed', String(other === chosen)));
  const draw = (sides) => 1 + Math.floor(Math.random() * sides);

  const plan = () => {
    const sides = Number(state.die.slice(1));
    const base = state.kind === 'damage' ? TONES.damage : TONES.check;
    if (sides === 100) {
      const value = draw(100);
      return {
        dice: [
          { kind: 'd10', value: Math.floor((value % 100) / 10) || 10, face: 'tens', color: base },
          { kind: 'd10', value: value % 10 || 10, face: 'units', color: base },
        ],
        total: value,
        math: 'd100',
        tone: base,
        tag: '',
      };
    }
    const first = draw(sides);
    const explodes = sides === 10 && state.kind === 'check' && (first === 10 || first === 1);
    if (!explodes) return { dice: [{ kind: state.die, value: first, face: 'plain', color: base }], total: first, math: state.die, tone: base, tag: '' };
    const second = draw(10);
    const crit = first === 10;
    const tone = crit ? TONES.crit : TONES.fumble;
    return {
      dice: [
        { kind: 'd10', value: first, face: 'plain', color: tone },
        { kind: 'd10', value: second, face: 'plain', color: tone },
      ],
      total: crit ? first + second : first - second,
      math: crit ? `10 + ${second}` : `1 − ${second}`,
      tone,
      tag: crit ? 'crit' : 'fumble',
    };
  };

  const show = (roll) => {
    out.style.setProperty('--tone', roll.tone);
    total.textContent = roll.total;
    math.textContent = roll.math;
    verdict.textContent = roll.tag ? line(roll.tag) : '';
    out.classList.add('is-on');
    seal.textContent = roll.total;
  };

  const load = () => {
    state.loading ??= import('./dice.js').then(({ createTray }) => (state.engine = createTray($('#dice-canvas')))).catch(() => (state.engine = null));
    return state.loading;
  };

  const throwDice = async () => {
    if (state.busy) return;
    state.busy = true;
    const roll = plan();
    state.last = roll;
    out.classList.remove('is-on');
    tray.classList.add('is-busy');
    seal.textContent = line('sealed');
    await load();
    if (state.engine && !reduced) await state.engine.toss(roll.dice);
    else if (state.engine) await state.engine.toss(roll.dice, true);
    show(roll);
    state.busy = false;
  };

  dieButtons.forEach((dieButton) =>
    dieButton.addEventListener('click', () => {
      state.die = dieButton.dataset.die;
      choose(dieButtons, dieButton);
    }),
  );
  kindButtons.forEach((kindButton) =>
    kindButton.addEventListener('click', () => {
      state.kind = kindButton.dataset.kind;
      choose(kindButtons, kindButton);
    }),
  );
  button.addEventListener('click', throwDice);
  document.addEventListener('rpged:lang', () => state.last && !state.busy && show(state.last));
  if (!canWebGL) return;
  once(host, load, '500px');
  if (!reduced) shown(tray, throwDice);
};

const setupRoom = () => {
  const canvas = $('#room-canvas');
  if (!canvas || !canWebGL) return;
  const name = $('#room-name');
  const buttons = $$('#themes [data-theme]');
  const again = $('#room-again');
  const state = { engine: null, theme: 'bar', seed: 1 };
  const label = () => (name.textContent = buttons.find((button) => button.dataset.theme === state.theme).textContent);
  const build = () => {
    label();
    state.engine?.build(state.theme, state.seed);
  };
  buttons.forEach((button) =>
    button.addEventListener('click', () => {
      buttons.forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
      state.theme = button.dataset.theme;
      state.seed = 1;
      build();
    }),
  );
  again.addEventListener('click', () => {
    state.seed += 1;
    build();
  });
  document.addEventListener('rpged:lang', label);
  once(
    canvas,
    () =>
      import('./room.js')
        .then(({ createRoom }) => {
          state.engine = createRoom(canvas, { still: reduced, lowPower });
          build();
          const view = { on: false };
          const sync = () => (view.on && !motion.paused ? state.engine.start() : state.engine.stop());
          whenVisible(
            canvas,
            () => {
              view.on = true;
              sync();
            },
            () => {
              view.on = false;
              sync();
            },
          );
          motion.watchers.add(sync);
        })
        .catch(() => {}),
    '300px',
  );
};

paintFaces();
setupNav();
setupMenu();
setupMotion();
setupReveal();
setupConsole();
setupTurn();
setupVote();
setupSound();
setupCell();
setupLos();
setupFog();
setupDice();
setupRoom();
setupHero();
