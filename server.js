// Quiz de Halloween — servidor
// Uma sala única: quem abre o link entra no jogo. O host controla por /host.

const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');
const perguntas = require('./perguntas.json');

// ===== Configurações (ajuste à vontade) =====
const PORT = process.env.PORT || 3000;
const HOST_PASSWORD = process.env.HOST_PASSWORD || 'abobora';
const TEMPO_PADRAO = 20;        // segundos por pergunta (cada pergunta pode ter "tempo" próprio)
const PONTOS_MAX = 1000;        // acerto instantâneo
const PONTOS_MIN = 500;         // acerto no último segundo
const BONUS_SEQUENCIA = 100;    // por acerto seguido a partir do 2º (0 para desligar)
const BONUS_SEQUENCIA_MAX = 500;
const TOP_RANKING = 5;          // quantos aparecem no ranking entre perguntas
const TAMANHO_NOME = 16;

// ===== App =====
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/host', (req, res) => res.sendFile(path.join(__dirname, 'public', 'host.html')));
const server = http.createServer(app);
const io = new Server(server);

// ===== Estado do jogo =====
// fases: lobby -> question -> reveal -> leaderboard -> question ... -> podium
const game = { phase: 'lobby', qIndex: -1, startedAt: 0, endsAt: 0, timer: null, distribution: [0, 0, 0, 0] };
const players = new Map(); // id -> { id, name, score, streak, socketId, connected, answer, lastGain, lastCorrect }

const currentQ = () => perguntas[game.qIndex];
const limitMs = (q) => (q.tempo || TEMPO_PADRAO) * 1000;
const ranking = () => [...players.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
const rankOf = (id) => ranking().findIndex((p) => p.id === id) + 1;
const connectedPlayers = () => [...players.values()].filter((p) => p.connected);
const brief = (p) => ({ name: p.name, score: p.score });

function startQuestion(i) {
  clearTimeout(game.timer);
  game.qIndex = i;
  game.phase = 'question';
  game.distribution = [0, 0, 0, 0];
  for (const p of players.values()) { p.answer = null; p.lastGain = 0; p.lastCorrect = false; }
  const limit = limitMs(currentQ());
  game.startedAt = Date.now();
  game.endsAt = game.startedAt + limit;
  game.timer = setTimeout(reveal, limit + 300); // pequena folga para respostas em trânsito
  broadcast();
}

function handleAnswer(p, choice) {
  if (game.phase !== 'question' || p.answer !== null) return;
  if (!Number.isInteger(choice) || choice < 0 || choice > 3) return;
  const ms = Date.now() - game.startedAt;
  if (ms > limitMs(currentQ()) + 300) return;
  p.answer = { choice, ms };
  game.distribution[choice]++;
  if (connectedPlayers().every((x) => x.answer !== null)) reveal();
  else broadcast();
}

function reveal() {
  if (game.phase !== 'question') return;
  clearTimeout(game.timer);
  const q = currentQ();
  const limit = limitMs(q);
  for (const p of players.values()) {
    const correct = p.answer !== null && p.answer.choice === q.correta;
    if (correct) {
      const frac = Math.min(p.answer.ms, limit) / limit;
      p.streak++;
      const bonus = Math.min(BONUS_SEQUENCIA * (p.streak - 1), BONUS_SEQUENCIA_MAX);
      p.lastGain = Math.round(PONTOS_MAX - (PONTOS_MAX - PONTOS_MIN) * frac) + bonus;
    } else {
      p.streak = 0;
      p.lastGain = 0;
    }
    p.lastCorrect = correct;
    p.score += p.lastGain;
  }
  game.phase = 'reveal';
  broadcast();
}

function advance() {
  switch (game.phase) {
    case 'lobby': if (perguntas.length) startQuestion(0); break;
    case 'question': reveal(); break;
    case 'reveal': game.phase = 'leaderboard'; broadcast(); break;
    case 'leaderboard':
      if (game.qIndex < perguntas.length - 1) startQuestion(game.qIndex + 1);
      else { game.phase = 'podium'; broadcast(); }
      break;
  }
}

function resetGame() {
  clearTimeout(game.timer);
  Object.assign(game, { phase: 'lobby', qIndex: -1, startedAt: 0, endsAt: 0, distribution: [0, 0, 0, 0] });
  for (const p of players.values()) Object.assign(p, { score: 0, streak: 0, answer: null, lastGain: 0, lastCorrect: false });
  broadcast();
}

// ===== O que cada um vê =====
function questionPublic() {
  const q = currentQ();
  return { numero: game.qIndex + 1, total: perguntas.length, texto: q.texto, alternativas: q.alternativas };
}

function playerView(p) {
  const v = { phase: game.phase, name: p.name, score: p.score, rank: rankOf(p.id), totalPlayers: players.size };
  if (game.phase === 'lobby') v.lobby = ranking().map((x) => x.name);
  if (game.phase === 'question') {
    v.question = questionPublic(); // a resposta certa NÃO vai junto
    v.remainingMs = Math.max(0, game.endsAt - Date.now());
    v.answered = p.answer !== null;
    v.choice = p.answer ? p.answer.choice : null;
  }
  if (game.phase === 'reveal') {
    v.question = questionPublic();
    v.correta = currentQ().correta;
    v.choice = p.answer ? p.answer.choice : null;
    v.correct = p.lastCorrect;
    v.gain = p.lastGain;
    v.streak = p.streak;
    v.distribution = game.distribution;
  }
  if (game.phase === 'leaderboard') {
    v.top = ranking().slice(0, TOP_RANKING).map(brief);
    v.isLast = game.qIndex === perguntas.length - 1;
    v.numero = game.qIndex + 1; v.total = perguntas.length;
  }
  if (game.phase === 'podium') v.top = ranking().slice(0, 3).map(brief);
  return v;
}

function hostView() {
  const q = currentQ();
  return {
    phase: game.phase,
    numero: game.qIndex + 1,
    total: perguntas.length,
    question: q ? { texto: q.texto, alternativas: q.alternativas, correta: q.correta } : null,
    remainingMs: game.phase === 'question' ? Math.max(0, game.endsAt - Date.now()) : 0,
    answered: [...players.values()].filter((p) => p.answer !== null).length,
    connected: connectedPlayers().length,
    distribution: game.distribution,
    players: ranking().map((p) => ({ id: p.id, name: p.name, score: p.score, connected: p.connected, answered: p.answer !== null, lastGain: p.lastGain })),
  };
}

function broadcast() {
  for (const p of players.values()) if (p.connected && p.socketId) io.to(p.socketId).emit('state', playerView(p));
  io.to('hosts').emit('host:state', hostView());
}

// ===== Conexões =====
io.on('connection', (socket) => {
  socket.on('join', (data, cb = () => {}) => {
    const { playerId, name } = data || {};
    let p = playerId ? players.get(playerId) : null;
    if (!p) {
      const nome = String(name || '').replace(/\s+/g, ' ').trim().slice(0, TAMANHO_NOME);
      if (!nome) return cb({ ok: false, erro: playerId ? 'reentrar' : 'Digite um apelido' });
      if ([...players.values()].some((x) => x.name.toLowerCase() === nome.toLowerCase()))
        return cb({ ok: false, erro: 'Esse apelido já está em uso 👻' });
      p = { id: crypto.randomUUID(), name: nome, score: 0, streak: 0, socketId: null, connected: false, answer: null, lastGain: 0, lastCorrect: false };
      players.set(p.id, p);
    }
    p.socketId = socket.id;
    p.connected = true;
    socket.data.playerId = p.id;
    cb({ ok: true, playerId: p.id, name: p.name });
    broadcast();
  });

  socket.on('answer', (choice) => {
    const p = players.get(socket.data.playerId);
    if (p) handleAnswer(p, choice);
  });

  socket.on('host:auth', (senha, cb = () => {}) => {
    if (senha !== HOST_PASSWORD) return cb({ ok: false });
    socket.data.host = true;
    socket.join('hosts');
    cb({ ok: true });
    socket.emit('host:state', hostView());
  });

  const hostOnly = (fn) => (...args) => { if (socket.data.host) fn(...args); };
  socket.on('host:advance', hostOnly(advance));
  socket.on('host:reset', hostOnly(resetGame));
  socket.on('host:kick', hostOnly((id) => {
    const p = players.get(id);
    if (!p) return;
    if (p.socketId) io.to(p.socketId).emit('kicked');
    players.delete(id);
    if (game.phase === 'question' && connectedPlayers().length && connectedPlayers().every((x) => x.answer !== null)) reveal();
    else broadcast();
  }));

  socket.on('disconnect', () => {
    const p = players.get(socket.data.playerId);
    if (p && p.socketId === socket.id) {
      p.connected = false;
      // se só faltava quem caiu, não precisa esperar o tempo acabar
      if (game.phase === 'question' && connectedPlayers().length && connectedPlayers().every((x) => x.answer !== null)) reveal();
      else broadcast();
    }
  });
});

server.listen(PORT, () => {
  console.log(`🎃 Quiz rodando em http://localhost:${PORT}`);
  console.log(`   Host: http://localhost:${PORT}/host  (senha: ${HOST_PASSWORD})`);
});
