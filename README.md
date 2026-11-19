markdown
# 🦜 Pitangus.js

Engine 2D leve sobre **PixiJS v8**. Um `<script>`, uma `function`, um jogo.
Funciona **sem imagens** (sprites programáticos) e carrega via CDN.

# Uso

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Meu Jogo v2.0.0</title>
  <style>html,body{margin:0;height:100%;background:#020617;overflow:hidden}</style>
</head>
<body>
  <div id="game-container"></div>

  <!-- CDN oficial v2.0.0 -->
  <script src="https://cdn.jsdelivr.net/gh/aceleradox/Pitangus.js@v2.0.0/pitangus.js"></script>

  <script>
    function gamemode(PT, PIXI) {
      const { Level, Sprites, Input, Physics, Tween, Math: MathU } = PT;

      // Estende Level para ter câmera automática
      class Game extends Level {
        create() {
          const W = this.engine.app.screen.width;
          const H = this.engine.app.screen.height;
          
          // Define o tamanho do mundo (fase)
          this.width = 2000;
          this.height = H;

          // --- CRIANDO O CENÁRIO ---
          // Fundo (fixo, não move com a câmera)
          this.container.addChildAt(Sprites.rect(W, H, 0x0a1628), 0);

          // Chão (vai no world para a câmera movimentar)
          const chao = Sprites.rect(this.width, 100, 0x1e293b);
          chao.y = H - 100;
          this.world.addChild(chao);

          // Plataformas no ar
          this.plataformas = [
            { x: 0, y: H - 100, w: this.width, h: 100 }, // Chão
            { x: 400, y: H - 250, w: 200, h: 20 },       // Plataforma 1
            { x: 800, y: H - 400, w: 200, h: 20 }        // Plataforma 2
          ];

          this.plataformas.forEach(p => {
            const graf = Sprites.rect(p.w, p.h, 0x334155);
            graf.x = p.x; graf.y = p.y;
            this.world.addChild(graf);
          });

          // --- O PLAYER ---
          this.player = Sprites.player(0x06b6d4);
          this.player.x = 100;
          this.player.y = H - 200;
          this.world.addChild(this.player);

          // Variáveis de física do jogador
          this.vy = 0;
          this.vx = 0;
          this.grounded = false;

          // Faz a câmera seguir o player (o Level já tem a câmera configurada)
          this.camera.follow(this.player);

          // --- TWEEN (Animação da Moeda) ---
          this.moeda = Sprites.circle(15, 0xfbbf24);
          this.moeda.x = 900;
          this.moeda.y = H - 450;
          this.world.addChild(this.moeda);

          // Animação infinita subindo e descendo
          const animarMoeda = () => {
            Tween.to(this.moeda, { y: this.moeda.y - 30 }, 0.8, 'quadInOut');
            setTimeout(() => {
              Tween.to(this.moeda, { y: this.moeda.y + 30 }, 0.8, 'quadInOut');
            }, 800);
          };
          animarMoeda();
          setInterval(animarMoeda, 1600);
        }

        update(dt) {
          super.update(dt); // IMPORTANTE: Atualiza a câmera do Level

          // --- LÓGICA DE FÍSICA DO PLAYER ---
          const ax = Input.axis();
          this.vx = ax.x * 300;

          // Pulo
          if (Input.pressed('Space') && this.grounded) {
            this.vy = -700;
            this.grounded = false;
          }

          // Gravidade
          this.vy += 2000 * dt;

          // Movimento no eixo X
          this.player.x += this.vx * dt;
          this.player.x = MathU.clamp(this.player.x, 20, this.width - 20);

          // Movimento no eixo Y
          this.player.y += this.vy * dt;
          this.grounded = false;

          // Hitbox do player (caixa de colisão)
          const pBox = { x: this.player.x - 14, y: this.player.y - 20, w: 28, h: 40 };

          // Checa colisão com as plataformas
          for (const plat of this.plataformas) {
            if (Physics.hit(pBox, plat)) {
              if (this.vy > 0) { // Caindo em cima da plataforma
                this.player.y = plat.y - 20;
                this.vy = 0;
                this.grounded = true;
              } else if (this.vy < 0) { // Batendo a cabeça
                this.player.y = plat.y + plat.h + 20;
                this.vy = 0;
              }
            }
          }
        }
      }

      PT.register('Game', Game);
      PT.start('Game');
    }
  </script>
</body>
</html>
```

API rápida
Módulo	Principais
PT.Scene	create() · update(dt) · destroy()
PT.register(nome, Classe)	registra cena
PT.start(nome, data?)	inicia cena
PT.Sprites	rect · roundRect · circle · text · player · enemy · platform
PT.Input	isDown · pressed · released · axis() · mouse
PT.Camera	follow(alvo) · setBounds(x,y,w,h) · update()
PT.Assets	image(key,url) · json(key,url) · get(key)
PT.app	instância PIXI.Application
Regras do gamemode
✅ <script> clássico (não type="module")

⏱️ até 10s para aparecer

🔄 alternativa: Pitangus.defineGamemode(fn)

Licença
MIT © Aceleradox
