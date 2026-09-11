const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);

/* =========================
   HTTP / CORS
========================= */

app.use(express.json({ limit: '20kb' }));

// Frontend jest na GitHub Pages, a API na Renderze.
// Bez tego przeglądarka blokuje POST /api/register i /api/login
// na etapie preflight (OPTIONS), co kończy się komunikatem
// "Failed to fetch" w przeglądarce.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

/* =========================
   DATABASE
========================= */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDatabase() {
  if (!process.env.DATABASE_URL) {
    console.log('WARNING: DATABASE_URL nie jest ustawione.');
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(18) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar VARCHAR(20) NOT NULL DEFAULT '😀',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS sessions_token_idx
      ON sessions(token);

    CREATE INDEX IF NOT EXISTS sessions_user_idx
      ON sessions(user_id);
  `);

  console.log('Database ready.');
}

function cleanUsername(username) {
  return String(username || '')
    .trim()
    .replace(/\s+/g, '')
    .slice(0, 18);
}

function validUsername(username) {
  return /^[a-zA-Z0-9_ąćęłńóśźżĄĆĘŁŃÓŚŹŻ-]{3,18}$/.test(username);
}

function cleanPassword(password) {
  return String(password || '');
}

const AVATARS = [
  '😀',
  '😎',
  '🤠',
  '🥶',
  '😈',
  '👑',
  '🦊',
  '🐺',
  '🐼',
  '🐸',
  '🤖',
  '👽',
  '🎩',
  '🃏',
  '♠️',
  '🔥'
];

function cleanAvatar(avatar) {
  return AVATARS.includes(String(avatar)) ? String(avatar) : '😀';
}

function makeSessionToken() {
  return crypto.randomBytes(48).toString('hex');
}

async function createSession(userId) {
  const token = makeSessionToken();

  await pool.query(
    `INSERT INTO sessions (token, user_id, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
    [token, userId]
  );

  return token;
}

async function getUserFromToken(token) {
  if (!process.env.DATABASE_URL) return null;

  const clean = String(token || '').trim();

  if (!clean) return null;

  const result = await pool.query(
    `SELECT u.id, u.username, u.avatar
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1
       AND s.expires_at > NOW()`,
    [clean]
  );

  return result.rows[0] || null;
}

async function deleteSession(token) {
  if (!token) return;

  await pool.query(
    `DELETE FROM sessions WHERE token = $1`,
    [String(token).trim()]
  );
}

function publicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    avatar: user.avatar
  };
}

/* =========================
   ACCOUNT API
========================= */

app.post('/api/register', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        error: 'Baza danych nie jest skonfigurowana.'
      });
    }

    const username = cleanUsername(req.body?.username);
    const password = cleanPassword(req.body?.password);
    const avatar = cleanAvatar(req.body?.avatar);

    if (!validUsername(username)) {
      return res.status(400).json({
        error: 'Login musi mieć 3–18 znaków i może zawierać litery, cyfry, _ lub -.'
      });
    }

    if (password.length < 6 || password.length > 100) {
      return res.status(400).json({
        error: 'Hasło musi mieć od 6 do 100 znaków.'
      });
    }

    const existing = await pool.query(
      `SELECT id FROM users WHERE LOWER(username) = LOWER($1)`,
      [username]
    );

    if (existing.rows.length) {
      return res.status(409).json({
        error: 'Taki login jest już zajęty.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (username, password_hash, avatar)
       VALUES ($1, $2, $3)
       RETURNING id, username, avatar`,
      [username, passwordHash, avatar]
    );

    const user = result.rows[0];
    const token = await createSession(user.id);

    res.json({
      ok: true,
      user: publicUser(user),
      token
    });
  } catch (err) {
    console.error('REGISTER ERROR:', err);
    res.status(500).json({
      error: 'Nie udało się utworzyć konta.'
    });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        error: 'Baza danych nie jest skonfigurowana.'
      });
    }

    const username = cleanUsername(req.body?.username);
    const password = cleanPassword(req.body?.password);

    const result = await pool.query(
      `SELECT id, username, password_hash, avatar
       FROM users
       WHERE LOWER(username) = LOWER($1)`,
      [username]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        error: 'Nieprawidłowy login lub hasło.'
      });
    }

    const correct = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!correct) {
      return res.status(401).json({
        error: 'Nieprawidłowy login lub hasło.'
      });
    }

    const token = await createSession(user.id);

    res.json({
      ok: true,
      user: publicUser(user),
      token
    });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({
      error: 'Nie udało się zalogować.'
    });
  }
});

app.get('/api/me', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ')
      ? auth.slice(7)
      : '';

    const user = await getUserFromToken(token);

    if (!user) {
      return res.status(401).json({
        error: 'Sesja wygasła.'
      });
    }

    res.json({
      ok: true,
      user: publicUser(user)
    });
  } catch (err) {
    console.error('ME ERROR:', err);
    res.status(500).json({
      error: 'Błąd serwera.'
    });
  }
});

app.post('/api/profile', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ')
      ? auth.slice(7)
      : '';

    const user = await getUserFromToken(token);

    if (!user) {
      return res.status(401).json({
        error: 'Sesja wygasła.'
      });
    }

    const avatar = cleanAvatar(req.body?.avatar);

    const result = await pool.query(
      `UPDATE users
       SET avatar = $1
       WHERE id = $2
       RETURNING id, username, avatar`,
      [avatar, user.id]
    );

    res.json({
      ok: true,
      user: publicUser(result.rows[0])
    });
  } catch (err) {
    console.error('PROFILE ERROR:', err);
    res.status(500).json({
      error: 'Nie udało się zapisać profilu.'
    });
  }
});

app.post('/api/logout', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ')
      ? auth.slice(7)
      : '';

    await deleteSession(token);

    res.json({ ok: true });
  } catch (err) {
    console.error('LOGOUT ERROR:', err);
    res.json({ ok: true });
  }
});

/* =========================
   GAME
========================= */

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    database: !!process.env.DATABASE_URL
  });
});

const rooms = new Map();

const SUITS = ['♣', '♦', '♥', '♠'];
const RANKS = [
  '2', '3', '4', '5', '6', '7', '8',
  '9', '10', 'J', 'Q', 'K', 'A'
];

const value = r => RANKS.indexOf(r);

function cleanName(name) {
  return String(name || 'Gracz')
    .trim()
    .slice(0, 18) || 'Gracz';
}

function cleanToken(token) {
  return String(token || '')
    .trim()
    .slice(0, 200);
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
}

function sortHand(hand) {
  const suitOrder = {
    '♣': 0,
    '♦': 1,
    '♥': 2,
    '♠': 3
  };

  hand.sort(
    (a, b) =>
      value(a.r) - value(b.r) ||
      suitOrder[a.s] - suitOrder[b.s]
  );
}

function makeDeck() {
  return SUITS.flatMap(s =>
    RANKS.map(r => ({
      id: crypto.randomUUID(),
      key: `${s}|${r}`,
      s,
      r
    }))
  );
}

function newCode() {
  let c;

  do {
    c = crypto
      .randomBytes(3)
      .toString('hex')
      .toUpperCase();
  } while (rooms.has(c));

  return c;
}

function maxHandSize(n) {
  return n === 2
    ? 24
    : n === 3
      ? 16
      : n === 4
        ? 12
        : 0;
}

function findPlayer(room, id) {
  return room.players.find(x => x.id === id);
}

function findPlayerByToken(room, token) {
  if (!token) return null;

  return room.players.find(
    x => x.token === token
  ) || null;
}

function publicRoom(room) {
  return {
    code: room.code,
    phase: room.phase,
    round: room.round,
    maxRounds: room.maxRounds,
    handSize: room.handSize,
    trump: room.trump,
    currentPlayer: room.currentPlayer,
    currentDeclarer: room.currentDeclarer,

    trick: room.trick.map(t => ({
      player: t.player,
      card: t.card
    })),

    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar || '😀',
      score: p.score,
      decl: p.decl,
      won: p.won,
      roundPoints: p.roundPoints,
      connected: p.connected
    }))
  };
}

function stateFor(room, playerId) {
  const pl = findPlayer(room, playerId);

  return {
    room: publicRoom(room),
    myId: playerId,
    hand: pl?.hand || []
  };
}

function send(room) {
  for (const pl of room.players) {
    if (pl.connected && pl.socketId) {
      io.to(pl.socketId).emit(
        'state',
        stateFor(room, pl.id)
      );
    }
  }
}

function attachSocket(socket, room, pl) {
  pl.socketId = socket.id;
  pl.connected = true;

  socket.data.room = room.code;
  socket.data.playerId = pl.id;
  socket.data.token = pl.token;

  socket.join(pl.socketRoom);
}

function orderNext(room, id) {
  const i = room.players.findIndex(
    x => x.id === id
  );

  return room.players[
    (i + 1) % room.players.length
  ].id;
}

function trickWinner(room) {
  const lead = room.trick[0].card.s;
  let best = 0;

  for (let i = 1; i < room.trick.length; i++) {
    const a = room.trick[i].card;
    const b = room.trick[best].card;

    const at = a.s === room.trump;
    const bt = b.s === room.trump;

    if (at && !bt) {
      best = i;
    } else if (at === bt) {
      const al = a.s === lead;
      const bl = b.s === lead;

      if (al && !bl) {
        best = i;
      } else if (
        al === bl &&
        value(a.r) > value(b.r)
      ) {
        best = i;
      }
    }
  }

  return room.trick[best].player;
}

function startRound(room) {
  if (room.round > room.maxRounds) {
    room.phase = 'finished';
    send(room);
    return;
  }

  room.phase = 'declaration';

  room.handSize =
    room.maxRounds - room.round + 1;

  room.trick = [];
  room.currentPlayer = null;

  room.currentDeclarer =
    room.players[
      (room.dealerIndex + 1) %
      room.players.length
    ].id;

  room.deck = shuffle(makeDeck());

  const trumpCard = room.deck.pop();
  room.trump = trumpCard.s;

  room.players.forEach(pl => {
    pl.hand = [];
    pl.decl = null;
    pl.won = 0;
    pl.roundPoints = 0;

    for (let i = 0; i < room.handSize; i++) {
      pl.hand.push(room.deck.pop());
    }

    sortHand(pl.hand);
  });

  send(room);
}

function declarationSum(room) {
  return room.players.reduce(
    (sum, p) => sum + (p.decl ?? 0),
    0
  );
}

function declarationDone(room) {
  return room.players.every(
    p => p.decl !== null
  );
}

function startPlay(room) {
  room.phase = 'play';
  room.currentPlayer =
    room.players[
      (room.dealerIndex + 1) %
      room.players.length
    ].id;
  send(room);
}

function declare(room, playerId, amount) {
  const pl = findPlayer(room, playerId);

  if (!pl) return 'Gracz nie istnieje.';

  if (room.phase !== 'declaration') {
    return 'Nie trwa deklarowanie.';
  }

  if (room.currentDeclarer !== playerId) {
    return 'Teraz deklaruje inny gracz.';
  }

  const n = Number(amount);

  if (!Number.isInteger(n) || n < 0 || n > room.handSize) {
    return 'Nieprawidłowa deklaracja.';
  }

  const others = room.players
    .filter(x => x.id !== playerId)
    .reduce((sum, x) => sum + (x.decl ?? 0), 0);

  if (
    room.players.length > 1 &&
    declarationSum(room) - (pl.decl ?? 0) + n === room.handSize &&
    room.players.some(x => x.id !== playerId && x.decl === null)
  ) {
    return 'Nie można teraz domknąć sumy deklaracji.';
  }

  pl.decl = n;

  const i = room.players.findIndex(
    x => x.id === playerId
  );

  room.currentDeclarer =
    room.players[
      (i + 1) % room.players.length
    ].id;

  if (declarationDone(room)) {
    startPlay(room);
  } else {
    send(room);
  }

  return null;
}

function play(room, playerId, card) {
  const pl = findPlayer(room, playerId);

  if (
    !pl ||
    room.phase !== 'play' ||
    room.currentPlayer !== playerId
  ) {
    return 'Nie jest teraz Twoja kolej.';
  }

  const wantedId =
    String(card?.id || '').trim();

  const wantedKey =
    String(card?.key || '').trim();

  const wantedSuit =
    String(card?.s || '').trim();

  const wantedRank =
    String(card?.r || '').trim();

  let idx = -1;

  if (wantedId) {
    idx = pl.hand.findIndex(
      c => String(c.id) === wantedId
    );
  }

  if (idx < 0 && wantedKey) {
    idx = pl.hand.findIndex(
      c => String(c.key) === wantedKey
    );
  }

  if (
    idx < 0 &&
    wantedSuit &&
    wantedRank
  ) {
    idx = pl.hand.findIndex(
      c =>
        c.s === wantedSuit &&
        c.r === wantedRank
    );
  }

  if (idx < 0) {
    console.log(
      `[PLAY] karta nie znaleziona: room=${room.code} player=${pl.name} id=${wantedId} key=${wantedKey}`
    );

    return 'Nie mam takiej karty w tej ręce.';
  }

  const playedCard = pl.hand[idx];

  const lead =
    room.trick[0]?.card.s;

  if (
    lead &&
    pl.hand.some(c => c.s === lead) &&
    playedCard.s !== lead
  ) {
    return 'Musisz dołożyć do koloru.';
  }

  pl.hand.splice(idx, 1);

  room.trick.push({
    player: playerId,
    card: playedCard
  });

  if (
    room.trick.length <
    room.players.length
  ) {
    room.currentPlayer =
      orderNext(room, playerId);

    send(room);
    return null;
  }

  const winId = trickWinner(room);
  const winner = findPlayer(room, winId);

  if (winner) {
    winner.won++;
  }

  room.currentPlayer = winId;
  room.trick = [];

  if (
    room.players.every(
      x => x.hand.length === 0
    )
  ) {
    finishRound(room);
  } else {
    send(room);
  }

  return null;
}

function finishRound(room) {
  for (const pl of room.players) {
    pl.roundPoints =
      pl.won === pl.decl
        ? 10 + pl.won
        : -Math.abs(pl.decl - pl.won) * 10;

    pl.score += pl.roundPoints;
  }

  room.phase = 'roundEnd';
  send(room);

  setTimeout(() => {
    if (!rooms.has(room.code)) return;

    room.round++;
    room.dealerIndex =
      (room.dealerIndex + 1) %
      room.players.length;

    startRound(room);
  }, 1800);
}

function createPlayer(name, token, avatar) {
  return {
    id: crypto.randomUUID(),
    token,

    name: cleanName(name),
    avatar: cleanAvatar(avatar),

    score: 0,
    hand: [],
    decl: null,
    won: 0,
    roundPoints: 0,

    connected: false,
    socketId: null,
    socketRoom: null
  };
}

/* =========================
   SOCKET
========================= */

io.on('connection', socket => {

  socket.on('resume', ({ code, token } = {}) => {
    const roomCode =
      String(code || '')
        .trim()
        .toUpperCase();

    const stableToken =
      cleanToken(token);

    const room = rooms.get(roomCode);

    if (!room || !stableToken) return;

    const pl =
      findPlayerByToken(
        room,
        stableToken
      );

    if (!pl) return;

    attachSocket(socket, room, pl);

    socket.emit(
      'resumed',
      room.code
    );

    send(room);
  });

  socket.on(
    'createRoom',
    ({ name, token, avatar } = {}) => {

      const stableToken =
        cleanToken(token) ||
        crypto.randomUUID();

      const code = newCode();

      const room = {
        code,
        players: [],

        phase: 'lobby',

        round: 1,
        maxRounds: 0,
        handSize: 0,

        trump: null,

        currentPlayer: null,
        currentDeclarer: null,

        dealerIndex: 0,

        deck: [],
        trick: []
      };

      const pl =
        createPlayer(
          name,
          stableToken,
          avatar
        );

      pl.socketRoom =
        `room:${code}`;

      room.players.push(pl);

      rooms.set(code, room);

      attachSocket(
        socket,
        room,
        pl
      );

      socket.emit(
        'roomCreated',
        code
      );

      send(room);
    }
  );

  socket.on(
    'joinRoom',
    ({ code, name, token, avatar } = {}) => {
      const roomCode =
        String(code || '')
          .trim()
          .toUpperCase();

      const stableToken =
        cleanToken(token) ||
        crypto.randomUUID();

      const room = rooms.get(roomCode);

      if (!room) {
        return socket.emit(
          'errorMsg',
          'Nie znaleziono pokoju.'
        );
      }

      const existing =
        findPlayerByToken(
          room,
          stableToken
        );

      if (existing) {
        existing.name = cleanName(name);
        existing.avatar = cleanAvatar(avatar);

        attachSocket(
          socket,
          room,
          existing
        );

        socket.emit(
          'roomJoined',
          room.code
        );

        send(room);
        return;
      }

      if (room.players.length >= 4) {
        return socket.emit(
          'errorMsg',
          'Pokój jest pełny — maksymalnie 4 graczy.'
        );
      }

      const pl =
        createPlayer(
          name,
          stableToken,
          avatar
        );

      pl.socketRoom =
        `room:${room.code}`;

      room.players.push(pl);

      attachSocket(
        socket,
        room,
        pl
      );

      socket.emit(
        'roomJoined',
        room.code
      );

      send(room);
    }
  );

  socket.on('startGame', () => {
    const room =
      rooms.get(socket.data.room);

    const playerId =
      socket.data.playerId;

    if (!room || !playerId) return;

    if (
      room.players[0]?.id !==
      playerId
    ) {
      return socket.emit(
        'errorMsg',
        'Tylko twórca pokoju może rozpocząć.'
      );
    }

    if (room.players.length < 2) {
      return socket.emit(
        'errorMsg',
        'Potrzeba co najmniej 2 graczy.'
      );
    }

    room.maxRounds =
      maxHandSize(
        room.players.length
      );

    room.round = 1;
    room.dealerIndex = 0;

    room.players.forEach(
      x => {
        x.score = 0;
      }
    );

    startRound(room);
  });

  socket.on('declare', amount => {
    const room =
      rooms.get(socket.data.room);

    const playerId =
      socket.data.playerId;

    if (!room || !playerId) return;

    const error =
      declare(
        room,
        playerId,
        amount
      );

    if (error) {
      socket.emit(
        'errorMsg',
        error
      );

      send(room);
    }
  });

  socket.on('play', card => {
    const room =
      rooms.get(socket.data.room);

    const playerId =
      socket.data.playerId;

    if (!room || !playerId) return;

    const error =
      play(
        room,
        playerId,
        card
      );

    if (error) {
      socket.emit(
        'errorMsg',
        error
      );

      send(room);
    }
  });

  socket.on('requestState', () => {
    const room =
      rooms.get(socket.data.room);

    const playerId =
      socket.data.playerId;

    if (!room || !playerId) return;

    const pl =
      findPlayer(
        room,
        playerId
      );

    if (!pl) return;

    pl.socketId = socket.id;
    pl.connected = true;

    send(room);
  });

  socket.on('disconnect', () => {
    const room =
      rooms.get(socket.data.room);

    const playerId =
      socket.data.playerId;

    if (!room || !playerId) return;

    const pl =
      findPlayer(
        room,
        playerId
      );

    if (!pl) return;

    if (
      pl.socketId === socket.id
    ) {
      pl.connected = false;
      pl.socketId = null;
    }

    send(room);
  });
});

/* =========================
   START
========================= */

const PORT =
  process.env.PORT || 3000;

initDatabase()
  .then(() => {
    server.listen(
      PORT,
      () => {
        console.log(
          `Planowanie server listening on ${PORT}`
        );
      }
    );
  })
  .catch(err => {
    console.error(
      'DATABASE START ERROR:',
      err
    );

    server.listen(
      PORT,
      () => {
        console.log(
          `Planowanie server listening on ${PORT} (database error)`
        );
      }
    );
  });
