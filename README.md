# 🎃 Quiz de Halloween

Quiz ao vivo, no estilo Kahoot, para uma sala única. Cada convidado joga pelo próprio celular, e a pergunta, as alternativas, o resultado, o ranking e o pódio aparecem na tela de todo mundo. Não precisa de telão.

- **Jogadores:** `https://SEU-LINK/`
- **Host:** `https://SEU-LINK/host` (senha padrão: `abobora`)

## Rodar no computador

```bash
npm install
npm start
```

Abra `http://localhost:3000/host` para o host e `http://localhost:3000` para os jogadores. Para testar, use várias abas anônimas, já que cada aba vira um jogador.

## Colocar online (Render, plano gratuito)

1. Suba esta pasta para um repositório no GitHub (a pasta `node_modules` fica de fora).
2. No [Render](https://render.com), crie um **New → Web Service** e conecte o repositório.
3. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment → Add variable:** `HOST_PASSWORD` = a senha que você quiser
4. O link do app vai ser algo como `https://quiz-halloween.onrender.com`.

⚠️ No plano gratuito, o servidor "dorme" depois de uns 15 minutos sem uso, e acordar leva cerca de 1 minuto. Abra o link uns 5 minutos antes do jogo começar. Se o servidor reiniciar, os pontos são zerados, porque tudo fica guardado na memória.

## Como jogar

1. Abra `/host` no seu celular. O lobby mostra um QR code e o link para os convidados entrarem.
2. Os convidados entram com um apelido e aparecem na sua lista.
3. Toque em **Começar o jogo**. Depois, o mesmo botão grande vai avançando cada etapa: pergunta → resposta → ranking → próxima pergunta → ... → pódio.
4. A resposta é revelada sozinha quando o tempo acaba ou quando todo mundo responde. Se quiser, você pode encerrar o tempo antes.
5. Se alguém recarregar a página ou cair da internet, é só abrir o link de novo no mesmo celular e navegador: a pessoa volta com o mesmo nome e os mesmos pontos.
6. O ✕ ao lado de cada nome remove o jogador. O botão **Reiniciar** zera os pontos e volta para o lobby.

## Ajustes rápidos

| O que mudar | Onde |
|---|---|
| Perguntas, alternativas e resposta certa | `perguntas.json` (`"correta"` vai de 0 a 3: 0 = vermelho ▲, 1 = azul ◆, 2 = amarelo ●, 3 = verde ■) |
| Tempo de uma pergunta específica | `"tempo": 30` na pergunta, em segundos |
| Tempo padrão, pontuação e bônus de sequência | constantes no topo do `server.js` |
| Quantos aparecem no ranking | `TOP_RANKING` no `server.js` |
| Cores e visual | `public/style.css` (variáveis em `:root`) |
| Telas do jogador / do host | `public/index.html` / `public/host.html` |

**Pontuação:** acertar no primeiro instante vale 1000 pontos e acertar no último segundo vale 500, com o valor caindo linearmente entre os dois. Cada acerto seguido, a partir do 2º, dá +100 pontos de bônus (no máximo +500). Errar ou não responder vale 0 e quebra a sequência.

## Estrutura

```
server.js          servidor (Express + Socket.io) e regras do jogo
perguntas.json     as perguntas
public/index.html  tela do jogador
public/host.html   painel do host
public/style.css   visual
```

## Créditos

Ícones: [game-icons.net](https://game-icons.net) (Lorc, Delapouite e colaboradores), licença [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
