/**
 * 🦜 Pitangus.js — CDN Edition v1.1.0
 *
 * Uso:
 *   <script src="https://cdn.jsdelivr.net/gh/USER/REPO/pitangus.js"></script>
 *   <script>
 *     function gamemode(PT, PIXI) {
 *       PT.register('Menu', class extends PT.Scene { ... });
 *       PT.start('Menu');
 *     }
 *   </script>
 *
 * O engine:
 *   1. Mostra tela de loading (auto-injetada)
 *   2. Carrega PixiJS v8 do CDN (se ainda não estiver presente)
 *   3. Cria o canvas e inicializa
 *   4. Aguarda window.gamemode() aparecer
 *   5. Chama gamemode(PT, PIXI, { Scene, Sprites, Input, Camera, Assets })
 */
(function (global) {
  'use strict';

  const VERSION   = '1.1.0';
  const PIXI_URL  = 'https://cdn.jsdelivr.net/npm/pixi.js@8.6.6/dist/pixi.min.js';
  const POLL_MS   = 20;
  const TIMEOUT   = 10000;

  if (global.__PITANGUS_LOADED__) { console.warn('[Pitangus] já carregado'); return; }
  global.__PITANGUS_LOADED__ = true;

  /* ---------------- LOADING ---------------- */
  function showLoading(msg) {
    let el = document.getElementById('pitangus-loading');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pitangus-loading';
      el.innerHTML = `
        <style>
          #pitangus-loading{position:fixed;inset:0;z-index:99999;background:radial-gradient(circle at 50% 40%,#0f172a 0%,#020617 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,sans-serif;transition:opacity .4s}
          #pitangus-loading.hidden{opacity:0;pointer-events:none}
          #pitangus-loading .sp{width:52px;height:52px;border:3px solid #1e293b;border-top-color:#06b6d4;border-radius:50%;animation:pit-spin .8s linear infinite;margin-bottom:24px}
          #pitangus-loading .ti{font-size:22px;font-weight:700;color:#fbbf24;letter-spacing:3px;margin-bottom:10px}
          #pitangus-loading .ms{font-size:13px;color:#64748b;font-family:monospace;max-width:80vw;text-align:center}
          @keyframes pit-spin{to{transform:rotate(360deg)}}
        </style>
        <div class="sp"></div>
        <div class="ti">🦜 PITANGUS.JS</div>
        <div class="ms" id="pitangus-loading-msg">Carregando...</div>`;
      document.body.appendChild(el);
    }
    if (msg) {
      const m = document.getElementById('pitangus-loading-msg');
      if (m) m.textContent = msg;
    }
  }
  function hideLoading() {
    const el = document.getElementById('pitangus-loading');
    if (el) { el.classList.add('hidden'); setTimeout(() => el.remove(), 500); }
  }

  /* ---------------- UTILS ---------------- */
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => res();
      s.onerror = () => rej(new Error('Falha ao carregar: ' + src));
      document.head.appendChild(s);
    });
  }
  function whenDomReady(fn) {
    if (document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* ---------------- INPUT ---------------- */
  const Input = {
    keys: {}, justPressed: {}, justReleased: {},
    mouse: { x: 0, y: 0, down: false, justDown: false },
    _init: false,
    init(canvas) {
      if (this._init) return; this._init = true;
      window.addEventListener('keydown', e => {
        if (!this.keys[e.code]) this.justPressed[e.code] = true;
        this.keys[e.code] = true;
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space',
             'KeyW','KeyA','KeyS','KeyD','KeyJ','KeyI','KeyE'].includes(e.code))
          e.preventDefault();
      });
      window.addEventListener('keyup', e => {
        this.keys[e.code] = false; this.justReleased[e.code] = true;
      });
      if (canvas) {
        canvas.addEventListener('mousemove', e => {
          const r = canvas.getBoundingClientRect();
          this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
          this.mouse.y = (e.clientY - r.top)  * (canvas.height / r.height);
        });
        canvas.addEventListener('mousedown', () => { this.mouse.down = true; this.mouse.justDown = true; });
        canvas.addEventListener('mouseup',   () => { this.mouse.down = false; });
      }
    },
    isDown(c) { return !!this.keys[c]; },
    pressed(c) { return !!this.justPressed[c]; },
    released(c) { return !!this.justReleased[c]; },
    endFrame() { this.justPressed = {}; this.justReleased = {}; this.mouse.justDown = false; },
    axis() {
      let x = 0, y = 0;
      if (this.keys['ArrowLeft']  || this.keys['KeyA']) x -= 1;
      if (this.keys['ArrowRight'] || this.keys['KeyD']) x += 1;
      if (this.keys['ArrowUp']    || this.keys['KeyW']) y -= 1;
      if (this.keys['ArrowDown']  || this.keys['KeyS']) y += 1;
      return { x, y };
    }
  };

  /* ---------------- ASSETS ---------------- */
  const Assets = {
    cache: {},
    async image(k, url) {
      if (this.cache[k]) return this.cache[k];
      try { return (this.cache[k] = await global.PIXI.Assets.load(url)); }
      catch (e) { console.warn('[Pitangus.Assets]', k, e.message); return null; }
    },
    async json(k, url) {
      if (this.cache[k]) return this.cache[k];
      try { return (this.cache[k] = await fetch(url).then(r => r.json())); }
      catch (e) { console.warn('[Pitangus.Assets] JSON', k, e.message); return null; }
    },
    get(k) { return this.cache[k]; }
  };

  /* ---------------- CAMERA ---------------- */
  class Camera {
    constructor(w, h) {
      this.width = w; this.height = h;
      this.x = 0; this.y = 0;
      this.lerp = 0.12; this.followTarget = null;
      this.bounds = { x: -Infinity, y: -Infinity, w: Infinity, h: Infinity };
      this.deadzone = { x: 0, y: 60 };
    }
    follow(t, instant) { this.followTarget = t; if (instant) this.snap(); }
    setBounds(x, y, w, h) { this.bounds = { x, y, w, h }; }
    snap() {
      if (!this.followTarget) return;
      this.x = this.followTarget.x - this.width / 2;
      this.y = this.followTarget.y - this.height / 2 - this.deadzone.y;
      this.clamp();
    }
    update() {
      if (!this.followTarget) return;
      const tx = this.followTarget.x - this.width / 2;
      const ty = this.followTarget.y - this.height / 2 - this.deadzone.y;
      this.x += (tx - this.x) * this.lerp;
      this.y += (ty - this.y) * this.lerp;
      this.clamp();
    }
    clamp() {
      const b = this.bounds;
      if (b.w < Infinity) this.x = Math.max(b.x, Math.min(this.x, b.x + b.w - this.width));
      if (b.h < Infinity) this.y = Math.max(b.y, Math.min(this.y, b.y + b.h - this.height));
    }
  }

  /* ---------------- SCENE ---------------- */
  class Scene {
    constructor(engine, data) {
      this.engine = engine;
      this.data = data || {};
      this.container = new global.PIXI.Container();
    }
    create() {}
    update(dt, time) {}
    destroy() {
      if (this.container) { this.container.destroy({ children: true }); this.container = null; }
    }
  }

  /* ---------------- SPRITES ---------------- */
  const Sprites = {
    rect(w, h, color) {
      return new global.PIXI.Graphics().rect(0, 0, w, h).fill(color);
    },
    roundRect(w, h, r, color) {
      return new global.PIXI.Graphics().roundRect(0, 0, w, h, r).fill(color);
    },
    circle(r, color) {
      return new global.PIXI.Graphics().circle(0, 0, r).fill(color);
    },
    text(str, opts) {
      opts = opts || {};
      return new global.PIXI.Text({
        text: str,
        style: {
          fontFamily: opts.fontFamily || 'Arial, sans-serif',
          fontSize: opts.fontSize || 24,
          fill: opts.fill !== undefined ? opts.fill : 0xffffff,
          align: opts.align || 'left',
          fontWeight: opts.bold ? 'bold' : 'normal',
          ...(opts.style || {})
        }
      });
    },
    player(color) {
      color = color || 0x06b6d4;
      const c = new global.PIXI.Container();
      c.addChild(new global.PIXI.Graphics().roundRect(-14, -20, 28, 40, 6).fill(color));
      c.addChild(new global.PIXI.Graphics().circle(-6, -8, 5).fill(0xffffff));
      c.addChild(new global.PIXI.Graphics().circle(6, -8, 5).fill(0xffffff));
      c.addChild(new global.PIXI.Graphics().circle(-6, -8, 2).fill(0x000000));
      c.addChild(new global.PIXI.Graphics().circle(6, -8, 2).fill(0x000000));
      return c;
    },
    enemy(color) {
      color = color || 0xef4444;
      const c = new global.PIXI.Container();
      c.addChild(new global.PIXI.Graphics().roundRect(-16, -16, 32, 32, 8).fill(color));
      c.addChild(new global.PIXI.Graphics().circle(-7, -4, 4).fill(0xffdd00));
      c.addChild(new global.PIXI.Graphics().circle(7, -4, 4).fill(0xffdd00));
      c.addChild(new global.PIXI.Graphics().rect(-8, 6, 16, 3).fill(0x000000));
      return c;
    },
    platform(w, h, topColor) {
      const c = new global.PIXI.Container();
      c.addChild(new global.PIXI.Graphics().rect(0, 0, w, h).fill(0x334155));
      c.addChild(new global.PIXI.Graphics().rect(0, 0, w, 4).fill(topColor || 0x06b6d4));
      return c;
    }
  };

  /* ---------------- ENGINE ---------------- */
  class Engine {
    constructor() {
      this.app = null;
      this.scenes = new Map();
      this.current = null;
      this.currentName = null;
      this.time = 0;
      this.paused = false;
      this.version = VERSION;

      // módulos no próprio engine (atalhos)
      this.Input = Input;
      this.Assets = Assets;
      this.Camera = Camera;
      this.Scene = Scene;
      this.Sprites = Sprites;
    }
    async init(opts) {
      opts = opts || {};
      this.app = new global.PIXI.Application();
      await this.app.init({
        width:  opts.width  || 1280,
        height: opts.height || 720,
        backgroundColor: opts.backgroundColor !== undefined ? opts.backgroundColor : 0x020617,
        antialias: false,
        resolution: Math.min(global.devicePixelRatio || 1, 2),
        autoDensity: true
      });
      const container = document.getElementById(opts.container || 'game-container');
      (container || document.body).appendChild(this.app.canvas);
      Input.init(this.app.canvas);
      this.app.ticker.add(() => this.tick());
      global.addEventListener('resize', () => this.fitCanvas());
      this.fitCanvas();
      return this;
    }
    fitCanvas() {
      if (!this.app) return;
      const W = this.app.screen.width, H = this.app.screen.height;
      const s = Math.min(global.innerWidth / W, global.innerHeight / H);
      this.app.canvas.style.width  = Math.floor(W * s) + 'px';
      this.app.canvas.style.height = Math.floor(H * s) + 'px';
    }
    register(name, cls) { this.scenes.set(name, cls); }
    start(name, data) {
      if (this.current) this.current.destroy();
      const S = this.scenes.get(name);
      if (!S) return console.error('[Pitangus] cena não encontrada:', name);
      this.current = new S(this, data || {});
      this.currentName = name;
      this.app.stage.addChild(this.current.container);
      if (this.current.create) this.current.create();
    }
    tick() {
      if (this.paused || !this.current) return;
      const dt = Math.min(this.app.ticker.deltaMS / 1000, 0.05);
      this.time += dt;
      if (this.current.update) this.current.update(dt, this.time);
      Input.endFrame();
    }
  }

  /* ---------------- BOOT ---------------- */
  function waitForGamemode(timeout) {
    return new Promise(resolve => {
      const start = Date.now();
      (function check() {
        if (typeof global.gamemode === 'function') return resolve(global.gamemode);
        if (Date.now() - start > timeout) return resolve(null);
        setTimeout(check, POLL_MS);
      })();
    });
  }

  async function boot() {
    whenDomReady(async () => {
      try {
        showLoading('Carregando PixiJS...');
        if (!global.PIXI) await loadScript(PIXI_URL);

        showLoading('Construindo engine...');
        const engine = new Engine();

        // cria container se não existir
        let container = document.getElementById('game-container')
                     || document.getElementById('game')
                     || document.getElementById('app');
        if (!container) {
          container = document.createElement('div');
          container.id = 'game-container';
          container.style.cssText =
            'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#020617';
          document.body.appendChild(container);
        }

        await engine.init({ container: container.id });

        global.Pitangus = engine;
        global.PT = engine;

        showLoading('Aguardando gamemode()...');
        const fn = await waitForGamemode(TIMEOUT);
        if (!fn) {
          console.warn('[Pitangus] window.gamemode não foi definido em ' + TIMEOUT + 'ms');
          return showLoading('⚠ gamemode() não definido — veja o console');
        }

        showLoading('Iniciando jogo...');
        try {
          await fn.call(global, engine, global.PIXI, {
            Scene, Sprites, Input, Camera, Assets, Engine
          });
        } catch (e) {
          console.error('[Pitangus] erro em gamemode():', e);
          showLoading('❌ ' + e.message);
          throw e;
        }

        hideLoading();
        console.log('%c🦜 Pitangus.js v' + VERSION + ' pronto',
                    'color:#fbbf24;font-weight:bold;font-size:14px');
      } catch (err) {
        console.error('[Pitangus] boot falhou:', err);
        showLoading('❌ Boot falhou: ' + err.message);
      }
    });
  }

  // expõe cedo (permite chamar PT.defineGamemode antes do boot acabar)
  global.Pitangus = global.Pitangus || {
    version: VERSION,
    __pending: true,
    defineGamemode(fn) { global.gamemode = fn; }
  };

  boot();
})(window);