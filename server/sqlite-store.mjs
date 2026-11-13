import { DatabaseSync } from 'node:sqlite';
import { chmodSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { ApiError } from './errors.mjs';
import { scoreVersion, scoreKeysForVersion } from '../config/stats.js';

export function createSqliteStore({ dataPath }) {
  if (!dataPath) throw new Error('dataPath is required.');
  if (dataPath !== ':memory:') mkdirSync(dirname(resolve(dataPath)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(dataPath);
  if (dataPath !== ':memory:') chmodSync(dataPath, 0o600);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY, share_id TEXT NOT NULL UNIQUE, owner_key_hash TEXT NOT NULL,
      owner_device_hash TEXT NOT NULL, nickname TEXT NOT NULL, self_scores TEXT NOT NULL,
      channel TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ratings (
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      device_hash TEXT NOT NULL, scores TEXT NOT NULL, channel TEXT, created_at TEXT NOT NULL,
      PRIMARY KEY (card_id, device_hash)
    );
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS rate_expiry ON rate_limits(expires_at);
  `);
  db.prepare('INSERT OR IGNORE INTO metadata (key, value) VALUES (?, ?)').run('hash_secret', randomBytes(32).toString('hex'));
  const hashSecret = db.prepare('SELECT value FROM metadata WHERE key = ?').get('hash_secret').value;

  function transaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function findCard(column, value) {
    const card = db.prepare(`SELECT * FROM cards WHERE ${column} = ?`).get(value);
    if (!card) throw new ApiError(404, 'NOT_FOUND', 'Card not found.');
    return card;
  }

  function authorize(card, ownerHash) {
    const expected = Buffer.from(card.owner_key_hash, 'hex');
    const received = Buffer.from(ownerHash, 'hex');
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      throw new ApiError(401, 'UNAUTHORIZED', 'A valid owner bearer key is required.', { 'WWW-Authenticate': 'Bearer' });
    }
  }

  function snapshot(card, owner = false) {
    const statVersion = scoreVersion(JSON.parse(card.self_scores));
    const keys = scoreKeysForVersion(statVersion);
    const ratings = db.prepare('SELECT scores FROM ratings WHERE card_id = ?').all(card.id);
    const count = ratings.length;
    const values = count >= 3 ? ratings.map((rating) => JSON.parse(rating.scores)) : [];
    const averages = count < 3 ? null : Object.fromEntries(keys.map((key) => [key, values.reduce((sum, scores) => sum + scores[key], 0) / count]));
    const result = { shareId: card.share_id, nickname: card.nickname, statVersion, count, unlocked: count >= 3, averages, createdAt: card.created_at };
    if (owner) Object.assign(result, { id: card.id, selfScores: JSON.parse(card.self_scores) });
    return result;
  }

  return {
    hashSecret,
    close: () => db.close(),
    purgeExpired() {
      return transaction(() => { db.exec('DELETE FROM cards; DELETE FROM rate_limits;'); });
    },
    consumeRate({ key, now, expiresAt, limit }) {
      return transaction(() => {
        db.prepare('DELETE FROM rate_limits WHERE expires_at <= ?').run(now);
        const row = db.prepare('SELECT count FROM rate_limits WHERE key = ?').get(key);
        if (row && row.count >= limit) return { allowed: false };
        db.prepare(`INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?)
          ON CONFLICT(key) DO UPDATE SET count = count + 1`).run(key, expiresAt);
        return { allowed: true };
      });
    },
    createCard(input) {
      return transaction(() => {
        db.prepare(`INSERT INTO cards (id, share_id, owner_key_hash, owner_device_hash, nickname, self_scores, channel, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(input.id, input.shareId, input.ownerHash, input.deviceHash,
          input.nickname, JSON.stringify(input.selfScores), input.channel, input.createdAt);
      });
    },
    getPublicCard({ shareId }) {
      return transaction(() => snapshot(findCard('share_id', shareId)));
    },
    getOwnerCard({ id, ownerHash }) {
      return transaction(() => {
        const card = findCard('id', id);
        authorize(card, ownerHash);
        return snapshot(card, true);
      });
    },
    submitRating(input) {
      return transaction(() => {
        const card = findCard('share_id', input.shareId);
        if (scoreVersion(input.scores) !== scoreVersion(JSON.parse(card.self_scores))) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Rating stats must match the card version.');
        }
        if (card.owner_device_hash === input.deviceHash) throw new ApiError(403, 'OWNER_CANNOT_RATE', 'You cannot rate your own card on this device.');
        if (db.prepare('SELECT 1 FROM ratings WHERE card_id = ? AND device_hash = ?').get(card.id, input.deviceHash)) {
          throw new ApiError(409, 'ALREADY_RATED', 'This device has already rated this card.');
        }
        if (db.prepare('SELECT count(*) AS count FROM ratings WHERE card_id = ?').get(card.id).count >= 30) {
          throw new ApiError(409, 'RATING_LIMIT', 'This card has reached 30 ratings.');
        }
        db.prepare('INSERT INTO ratings (card_id, device_hash, scores, channel, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(card.id, input.deviceHash, JSON.stringify(input.scores), input.channel, input.createdAt);
        return snapshot(card);
      });
    },
    deleteCard({ id, ownerHash }) {
      return transaction(() => {
        const card = findCard('id', id);
        authorize(card, ownerHash);
        db.prepare('DELETE FROM cards WHERE id = ?').run(id);
      });
    },
  };
}
