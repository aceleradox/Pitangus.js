markdown
# 🦜 Pitangus.js

Engine 2D leve sobre **PixiJS v8**. Um `<script>`, uma `function`, um jogo.
Funciona **sem imagens** (sprites programáticos) e carrega via CDN.

## Uso

```html
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Meu Jogo</title></head>
<body>
  <div id="game-container"></div>

  <!-- CDN oficial -->
  <script src="https://cdn.jsdelivr.net/gh/aceleradox/Pitangus.js@v1.1.0/pitangus.js"></script>

  <script>
    function gamemode(PT, PIXI) {
      const { Scene, Sprites, Input } = PT;

      class Game extends Scene {
        create() {
          const W = this.engine.app.screen.width;
          const H = this.engine.app.screen.height;
          this.container.addChild(Sprites.rect(W, H, 0x0a1628));

          this.player = Sprites.player(0x06b6d4);
          this.player.x = W / 2;
          this.player.y = H / 2;
          this.container.addChild(this.player);
        }
        update(dt) {
          const ax = Input.axis();
          this.player.x += ax.x * 300 * dt;
          this.player.y += ax.y * 300 * dt;
        }
      }

      PT.register('Game', Game);
      PT.start('Game');
    }
  </script>
</body>
</html>
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

text

---

### 🚀 3. O Último Passo: Como ativar a CDN

Se você tentar acessar o link da CDN agora (`.../aceleradox/Pitangus.js@v1.1.0/pitangus.js`), vai dar erro 404, porque o jsDelivr precisa de uma **Tag de Versão**. 

No seu terminal (na pasta do projeto), faça o seguinte:

1. **Adicione e comite os arquivos:**
   ```bash
   git add .
   git commit -m "feat: lançamento v1.1.0"
Crie a Tag de versão:

bash
git tag v1.1.0
Envie tudo pro GitHub:

bash
git push origin main
git push origin v1.1.0
Pronto! Agora o jsDelivr vai notar a tag v1.1.0 e o seu link https://cdn.jsdelivr.net/gh/aceleradox/Pitangus.js@v1.1.0/pitangus.js vai funcionar na hora.

(Se você quiser testar sem a tag, pode usar @main no link: https://cdn.jsdelivr.net/gh/aceleradox/Pitangus.js@main/pitangus.js, mas o recomendado é usar a tag fixa).
