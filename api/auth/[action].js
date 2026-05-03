import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const DATA_FILE = process.env.AUTH_DATA_FILE || path.join('/tmp', 'secure-channel-users.json');
const AUTH_SECRET = process.env.AUTH_SECRET || 'change-this-secret-before-production';
const PBKDF2_ITERATIONS = process.env.VERCEL ? 10000 : 120000;

async function readUsers() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeUsers(users) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(users, null, 2));
}

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
      if (body.length > 100_000) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });

    req.on('error', reject);
  });
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateUserInput({ username, password, email }) {
  if (!/^[a-z0-9_-]{3,24}$/.test(username)) {
    return 'Username must be 3-24 characters and use only letters, numbers, underscores, or hyphens.';
  }

  if (String(password || '').length < 6) {
    return 'Password must be at least 6 characters.';
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Please enter a valid email address.';
  }

  return null;
}

function createPasswordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, PBKDF2_ITERATIONS, 32, 'sha256').toString('hex');
  return { salt, hash, iterations: PBKDF2_ITERATIONS };
}

function matchesHash(attempt, storedHash) {
  const iterations = storedHash.iterations || 120000;
  const attemptedHash = crypto.pbkdf2Sync(String(attempt), storedHash.salt, iterations, 32, 'sha256').toString('hex');
  const left = Buffer.from(attemptedHash, 'hex');
  const right = Buffer.from(storedHash.hash, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function publicUser(user) {
  return {
    username: user.username,
    email: user.email,
    peerId: user.peerId,
    createdAt: user.createdAt
  };
}

function signToken(user) {
  const payload = {
    username: user.username,
    peerId: user.peerId,
    exp: Date.now() + TOKEN_TTL_MS
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return null;

  const [encodedPayload, signature] = token.split('.');
  const expectedSignature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  if (signature.length !== expectedSignature.length) return null;

  const isValidSignature = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
  if (!isValidSignature) return null;

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

function createPeerId(users) {
  let peerId = '';
  const usedPeerIds = new Set(Object.values(users).map((user) => user.peerId));

  do {
    peerId = `sc-${crypto.randomBytes(8).toString('hex')}`;
  } while (usedPeerIds.has(peerId));

  return peerId;
}

function shouldRefreshPeerId(user) {
  if (!user.peerId) return true;
  if (user.peerId === user.username) return true;
  return user.peerId.startsWith(`${user.username}-`);
}

async function ensureDistinctPeerId(users, user) {
  if (!shouldRefreshPeerId(user)) return user;

  user.peerId = createPeerId(users);
  user.updatedAt = new Date().toISOString();
  await writeUsers(users);
  return user;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const action = getAction(req);

    if (action === 'health' && req.method === 'GET') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (action === 'register' && req.method === 'POST') {
      const body = await readBody(req);
      const username = normalizeUsername(body.username);
      const password = String(body.password || '');
      const email = normalizeEmail(body.email);
      const validationError = validateUserInput({ username, password, email });

      if (validationError) {
        sendJson(res, 400, { error: validationError });
        return;
      }

      const users = await readUsers();
      if (users[username]) {
        sendJson(res, 409, { error: 'Username already exists.' });
        return;
      }

      const user = {
        username,
        email,
        peerId: createPeerId(users),
        passwordHash: createPasswordHash(password),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      users[username] = user;
      await writeUsers(users);

      sendJson(res, 201, { user: publicUser(user), token: signToken(user) });
      return;
    }

    if (action === 'login' && req.method === 'POST') {
      const body = await readBody(req);
      const username = normalizeUsername(body.username);
      const password = String(body.password || '');
      const users = await readUsers();
      const user = users[username];

      if (!user || !matchesHash(password, user.passwordHash)) {
        sendJson(res, 401, { error: 'Invalid username or password.' });
        return;
      }

      await ensureDistinctPeerId(users, user);

      sendJson(res, 200, { user: publicUser(user), token: signToken(user) });
      return;
    }

    if (action === 'me' && req.method === 'GET') {
      const payload = verifyToken(getBearerToken(req));

      if (!payload) {
        sendJson(res, 401, { error: 'Invalid or expired session.' });
        return;
      }

      const users = await readUsers();
      const user = users[payload.username];

      if (!user) {
        sendJson(res, 401, { error: 'User no longer exists.' });
        return;
      }

      await ensureDistinctPeerId(users, user);

      sendJson(res, 200, { user: publicUser(user) });
      return;
    }

    if (action === 'forgot' && req.method === 'POST') {
      const body = await readBody(req);
      const email = normalizeEmail(body.email);

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        sendJson(res, 400, { error: 'Please enter a valid email address.' });
        return;
      }

      sendJson(res, 200, {
        message: `If ${email} is registered, a reset link will be sent.`
      });
      return;
    }

    sendJson(res, 404, { error: 'Auth endpoint not found.' });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: 'Server error.' });
  }
}
