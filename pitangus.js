/**
 * 🦜 Pitangus.js — v2.0.0 (Robusta)
 * Focada em facilidade, poder total do PixiJS, SVGs, Áudio e Animações.
 */
(function (global) {
  'use strict';

  const VERSION = '2.0.0';
  const PIXI_URL = 'https://cdn.jsdelivr.net/npm/pixi.js@8.6.6/dist/pixi.min.js';

  if (global.__PITANGUS_LOADED__) return;
  global.__PITANGUS_LOADED__ = true;

  // --- HELPERS MATEMÁTICOS ---
  const MathUtils = {
    clamp: (val, min, max) => Math.max(min, Math.min(max, val)),
    lerp: (start, end, amt) => (1 - amt) * start + amt * end,
    random: (min, max) => Math.random() * (max - min) + min,
    randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
  };

  // --- SISTEMA DE SAVE ---
  const Save = {
    data: {},
    init(key = 'pitangus_save') {
      this.key = key;
      try { this.data = JSON.parse(localStorage.getItem(key)) || {}; } catch(e) { this.data = {}; }
    },
    get(k, def = 0) { return this.data[k] !== undefined ? this.data[k] : def; },
    set(k, v) { this.data[k] = v; this.commit(); },
    add(k, v) { this.data[k] = this.get(k, 0) + v; this.commit(); },
    commit() { localStorage.setItem(this.key, JSON.stringify(this.data)); }
  };

  // --- INPUT ---
  const Input = {
    keys: {}, justPressed: {}, justReleased: {},
    mouse: { x: 0, y: 0, down: false, justDown: false },
    _init: false,
    init(canvas) {
      if (this._init) return; this._init = true;
      window.addEventListener('keydown', e => {
        if (!this.keys[e.code]) this.justPressed[e.code] = true;
        this.keys[e.code] = true;
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
      });
      window.addEventListener('keyup', e => {
        this.keys[e.code] = false; this.justReleased[e.code] = true;
      });
      if (canvas) {
        canvas.addEventListener('pointermove', e => {
          const r = canvas.getBoundingClientRect();
          this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
          this.mouse.y = (e.clientY - r.top)  * (canvas.height / r.height);
        });
        canvas.addEventListener('pointerdown', () => { this.mouse.down = true; this.mouse.justDown = true; });
        canvas.addEventListener('pointerup', () => { this.mouse.down = false; });
      }
    },
    isDown(c) { return !!this.keys[c]; },
    pressed(c) { return !!this.justPressed[c]; },
    endFrame() { this.justPressed = {}; this.justReleased = {}; this.mouse.justDown = false; },
    axis() {
      return {
        x: (this.keys['ArrowRight'] || this.keys['KeyD'] ? 1 : 0) - (this.keys['ArrowLeft'] || this.keys['KeyA'] ? 1 : 0),
        y: (this.keys['ArrowDown'] || this.keys['KeyS'] ? 1 : 0) - (this.keys['ArrowUp'] || this.keys['KeyW'] ? 1 : 0)
      };
    }
  };

  // --- ASSETS (SVG + Imagens) ---
  const Assets = {
    cache: {},
    async loadImage(key, url) {
      if (this.cache[key]) return this.cache[key];
      try {
        const texture = await global.PIXI.Assets.load(url);
        this.cache[key] = texture;
        return texture;
      } catch (e) {
        console.warn(`[Pitangus] Erro ao carregar ${key}:`, e.message);
        return null;
      }
    },
    get(key) { return this.cache[key]; }
  };

  // --- ÁUDIO ---
  const AudioSys = {
    cache: {},
    load(key, url) {
      const audio = new Audio(url);
      audio.preload = 'auto';
      this.cache[key] = audio;
    },
    play(key) {
      if (this.cache[key]) {
        this.cache[key].currentTime = 0;
        this.cache[key].play().catch(()=>{});
      }
    }
  };

  // --- FÍSICA ---
  const Physics = {
    hit: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  };

  // --- TWEEN (Animações) ---
  const Tweens = [];
  const Tween = {
    to: (target, props, duration, ease = 'linear') => {
      const start = {};
      for (let k in props) start[k] = target[k];
      Tweens.push({ target, start, props, duration, elapsed: 0, ease });
    },
    update: (dt) => {
      for (let i = Tweens.length - 1; i >= 0; i--) {
        const t = Tweens[i];
        t.elapsed += dt;
        let progress = Math.min(t.elapsed / t.duration, 1);
        
        // Easing simples
        if (t.ease === 'quadInOut') progress = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
        
        for (let k in t.props) {
          t.target[k] = t.start[k] + (t.props[k] - t.start[k]) * progress;
        }
        if (progress >= 1) Tweens.splice(i, 1);
      }
    }
  };

  // --- CÂMERA ---
  class Camera {
    constructor(w, h) {
      this.width = w; this.height = h;
      this.x = 0; this.y = 0;
      this.lerpSpeed = 0.1; this.target = null;
      this.bounds = { x: -Infinity, y: -Infinity, w: Infinity, h: Infinity };
    }
    follow(target) { this.target = target; }
    setBounds(x, y, w, h) { this.bounds = { x, y, w, h }; }
    update(dt) {
      if (!this.target) return;
      let tx = this.target.x - this.width / 2;
      let ty = this.target.y - this.height / 2;
      this.x = MathUtils.lerp(this.x, tx, this.lerpSpeed * (dt * 60));
      this.y = MathUtils.lerp(this.y, ty, this.lerpSpeed * (dt * 60));
      
      if (this.bounds.w < Infinity) this.x = MathUtils.clamp(this.x, this.bounds.x, this.bounds.x + this.bounds.w - this.width);
      if (this.bounds.h < Infinity) this.y = MathUtils.clamp(this.y, this.bounds.y, this.bounds.y + this.bounds.h - this.height);
    }
  }

  // --- CENAS ---
  class Scene {
    constructor(engine, data) {
      this.engine = engine;
      this.data = data || {};
      this.container = new global.PIXI.Container();
      this.ui = new global.PIXI.Container(); 
      this.container.addChild(this.ui);
    }
    create() {}
    update(dt, time) {}
    destroy() { this.container.destroy({ children: true }); }
  }

  class Level extends Scene {
    constructor(engine, data) {
      super(engine, data);
      this.world = new global.PIXI.Container();
      this.container.addChildAt(this.world, 0);
      
      this.camera = new Camera(engine.app.screen.width, engine.app.screen.height);
      this.width = data.width || 3000;
      this.height = data.height || 720;
      this.camera.setBounds(0, 0, this.width, this.height);
    }
    update(dt, time) {
      super.update(dt, time);
      this.camera.update(dt);
      this.world.x = -this.camera.x;
      this.world.y = -this.camera.y;
    }
  }

  // --- SPRITES ---
  const Sprites = {
    rect: (w, h, color) => new global.PIXI.Graphics().rect(0, 0, w, h).fill(color),
    circle: (r, color) => new global.PIXI.Graphics().circle(0, 0, r).fill(color),
    text: (str, opts = {}) => new global.PIXI.Text({ text: str, style: { fontFamily: 'Arial', fontSize: 24, fill: 0xffffff, ...opts } }),
    sprite: async (url) => {
      const tex = await Assets.loadImage(url, url);
      return tex ? new global.PIXI.Sprite(tex) : Sprites.rect(32, 32, 0xff00ff);
    },
    player: (color = 0x06b6d4) => {
      const c = new global.PIXI.Container();
      c.addChild(new global.PIXI.Graphics().roundRect(-14, -20, 28, 40, 6).fill(color));
      c.addChild(new global.PIXI.Graphics().circle(-6, -8, 5).fill(0xffffff));
      c.addChild(new global.PIXI.Graphics().circle(6, -8, 5).fill(0xffffff));
      return c;
    }
  };

  // --- ENGINE ---
  class Engine {
    constructor() {
      this.app = null; this.scenes = new Map(); this.current = null;
      this.time = 0; this.version = VERSION;
      
      this.Input = Input; this.Assets = Assets; this.Camera = Camera;
      this.Scene = Scene; this.Level = Level; this.Sprites = Sprites;
      this.Physics = Physics; this.Save = Save; this.Math = MathUtils;
      this.Audio = AudioSys; this.Tween = Tween;
    }
    async init(opts = {}) {
      this.app = new global.PIXI.Application();
      await this.app.init({
        width: opts.width || 1280, height: opts.height || 720,
        backgroundColor: opts.backgroundColor || 0x0f172a,
        resolution: Math.min(global.devicePixelRatio || 1, 2), autoDensity: true, antialias: true
      });
      const parent = document.getElementById(opts.container || 'game-container') || document.body;
      parent.appendChild(this.app.canvas);
      Input.init(this.app.canvas);
      this.app.ticker.add(() => this.tick());
      global.addEventListener('resize', () => this.fit());
      this.fit();
      return this;
    }
    fit() {
      const W = this.app.screen.width, H = this.app.screen.height;
      const s = Math.min(global.innerWidth / W, global.innerHeight / H);
      this.app.canvas.style.width = Math.floor(W * s) + 'px';
      this.app.canvas.style.height = Math.floor(H * s) + 'px';
    }
    register(name, cls) { this.scenes.set(name, cls); }
    start(name, data) {
      if (this.current) this.current.destroy();
      const S = this.scenes.get(name);
      if (!S) return console.error('Cena não encontrada:', name);
      this.current = new S(this, data || {});
      this.app.stage.addChild(this.current.container);
      if (this.current.create) this.current.create();
    }
    tick() {
      if (!this.current) return;
      const dt = Math.min(this.app.ticker.deltaMS / 1000, 0.05);
      this.time += dt;
      
      Tween.update(dt); // Atualiza as animações
      
      if (this.current.update) this.current.update(dt, this.time);
      Input.endFrame();
    }
  }

  // --- BOOT ---
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  async function boot() {
    document.addEventListener('DOMContentLoaded', async () => {
      if (!global.PIXI) await loadScript(PIXI_URL);
      
      const engine = new Engine();
      await engine.init();
      Save.init();
      
      global.Pitangus = engine;
      global.PT = engine;

      const wait = setInterval(async () => {
        if (typeof global.gamemode === 'function') {
          clearInterval(wait);
          document.getElementById('loading')?.remove(); // Remove o loading simples do HTML
          await global.gamemode(engine, global.PIXI);
        }
      }, 50);
    });
  }
  
  global.Pitangus = { version: VERSION };
  boot();
})(window);
