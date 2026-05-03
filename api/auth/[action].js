import crypto from 'node:crypto';
import { MongoClient } from 'mongodb';

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const AUTH_SECRET = process.env.AUTH_SECRET || 'change-this-secret-before-production';
const PBKDF2_ITERATIONS = 10000;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'secure_channel';
const COLLECTION = 'users';

// --- MongoDB connection (reused across warm serverless invocations) ---
let cachedClient = null;

async function getCollection() {
  if (!MONGODB_URI) {
    // Fallback: file-based storage for local dev without MongoDB
    const { default: fs } = await import('node:fs/promises');
    const { default: path } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const DATA_FILE = process.env.AUTH_DATA_FILE ||
      path.join(__dirname, '../../backend/.data/users.json');

    return {
      _mode: 'file',
      _file: DATA_FILE,
      async findOne({ username }) {
        try {
          const raw = await fs.readFile(this._file, 'utf8');
          const users = JSON.parse(raw);
          return users[username] || null;
        } catch { return null; }
      },
      async insertOne(doc) {
        let users = {};
        try {
          const raw = await fs.readFile(this._file, 'utf8');
          users = JSON.parse(raw);
        } catch { /* new file */ }
        users[doc.username] = doc;
        await fs.mkdir(path.dirname(this._file), { recursive: true });
        await fs.writeFile(this._file, JSON.stringify(users, null, 2));
      },
      async updateOne({ username }, { $set }) {
        let users = {};
        try {
          const raw = await fs.readFile(this._file, 'utf8');
          users = JSON.parse(raw);
        } catch { /* new file */ }
        if (users[username]) Object.assign(users[username], $set);
        await fs.mkdir(path.dirname(this._file), { recursive: true });
        await fs.writeFile(this._file, JSON.stringify(users, null, 2));
      },
      async distinct(field) {
        try {
          const raw = await fs.readFile(this._file, 'utf8');
          const users = JSON.parse(raw);
          return Object.values(users).map(u => u[field]).filter(Boolean);
        } catch { return []; }
      }
    };
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(MONGODB_URI);
    await cachedClient.connect();
  }
  return cachedClient.db(DB_NAME).collection(COLLECTION);
}

// --- Helpers ---
function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 100_000) { reject(new Error('Request body too large.')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON body.')); }
    });
    req.on('error', reject);
  });
}

function normalizeUsername(u) { return String(u || '').trim().toLowerCase(); }
function normalizeEmail(e) { return String(e || '').trim().toLowerCase(); }

function validateUserInput({ username, password, email }) {
  if (!/^[a-z0-9_-]{3,24}$/.test(username))
    return 'Username must be 3-24 characters: letters, numbers, underscores, or hyphens.';
  if (String(password || '').length < 6)
    return 'Password must be at least 6 characters.';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return 'Please enter a valid email address.';
  return null;
}

function createPasswordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, PBKDF2_ITERATIONS, 32, 'sha256').toString('hex');
  return { salt, hash, iterations: PBKDF2_ITERATIONS };
}

function matchesHash(attempt, storedHash) {
  const iterations = storedHash.iterations || PBKDF2_ITERATIONS;
  const attemptedHash = crypto.pbkdf2Sync(String(attempt), storedHash.salt, iterations, 32, 'sha256').toString('hex');
  const left = Buffer.from(attemptedHash, 'hex');
  const right = Buffer.from(storedHash.hash, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function publicUser(user) {
  return { username: user.username, email: user.email, peerId: user.peerId, createdAt: user.createdAt };
}

function signToken(user) {
  const payload = { username: user.username, peerId: user.peerId, exp: Date.now() + TOKEN_TTL_MS };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [encodedPayload, signature] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(encodedPayload).digest('base64url');
  if (signature.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) return null;
  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

function getAction(req) {
  if (req.query?.action) return req.query.action;
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  return url.pathname.split('/').filter(Boolean).at(-1) || '';
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
}

async function generateUniquePeerId(col) {
  const usedIds = new Set(await col.distinct('peerId'));
  let peerId;
  do { peerId = `sc-${crypto.randomBytes(8).toString('hex')}`; }
  while (usedIds.has(peerId));
  return peerId;
}

function shouldRefreshPeerId(user) {
  if (!user.peerId) return true;
  if (user.peerId === user.username) return true;
  return user.peerId.startsWith(`${user.username}-`);
}

// --- Main handler ---
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }

  try {
    const col = await getCollection();
    const action = getAction(req);

    // --- Health ---
    if (action === 'health' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, storage: MONGODB_URI ? 'mongodb' : 'file' });
      return;
    }

    // --- Register ---
    if (action === 'register' && req.method === 'POST') {
      const body = await readBody(req);
      const username = normalizeUsername(body.username);
      const password = String(body.password || '');
      const email = normalizeEmail(body.email);
      const err = validateUserInput({ username, password, email });
      if (err) { sendJson(res, 400, { error: err }); return; }

      const existing = await col.findOne({ username });
      if (existing) { sendJson(res, 409, { error: 'Username already exists.' }); return; }

      const peerId = await generateUniquePeerId(col);
      const user = {
        username, email, peerId,
        passwordHash: createPasswordHash(password),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await col.insertOne(user);
      sendJson(res, 201, { user: publicUser(user), token: signToken(user) });
      return;
    }

    // --- Login ---
    if (action === 'login' && req.method === 'POST') {
      const body = await readBody(req);
      const username = normalizeUsername(body.username);
      const password = String(body.password || '');
      const user = await col.findOne({ username });

      if (!user || !matchesHash(password, user.passwordHash)) {
        sendJson(res, 401, { error: 'Invalid username or password.' });
        return;
      }

      // Refresh peerId if it looks like an old-format ID
      if (shouldRefreshPeerId(user)) {
        const peerId = await generateUniquePeerId(col);
        const updatedAt = new Date().toISOString();
        await col.updateOne({ username }, { $set: { peerId, updatedAt } });
        user.peerId = peerId;
      }

      sendJson(res, 200, { user: publicUser(user), token: signToken(user) });
      return;
    }

    // --- Me ---
    if (action === 'me' && req.method === 'GET') {
      const payload = verifyToken(getBearerToken(req));
      if (!payload) { sendJson(res, 401, { error: 'Invalid or expired session.' }); return; }

      const user = await col.findOne({ username: payload.username });
      if (!user) { sendJson(res, 401, { error: 'User no longer exists.' }); return; }

      if (shouldRefreshPeerId(user)) {
        const peerId = await generateUniquePeerId(col);
        const updatedAt = new Date().toISOString();
        await col.updateOne({ username: user.username }, { $set: { peerId, updatedAt } });
        user.peerId = peerId;
      }

      sendJson(res, 200, { user: publicUser(user) });
      return;
    }

    // --- Forgot password (placeholder) ---
    if (action === 'forgot' && req.method === 'POST') {
      const body = await readBody(req);
      const email = normalizeEmail(body.email);
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        sendJson(res, 400, { error: 'Please enter a valid email address.' });
        return;
      }
      sendJson(res, 200, { message: `If ${email} is registered, a reset link will be sent.` });
      return;
    }

    sendJson(res, 404, { error: 'Auth endpoint not found.' });
  } catch (error) {
    console.error('[auth handler error]', error);
    sendJson(res, 500, { error: 'Server error.' });
  }
}
