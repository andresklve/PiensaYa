// Tests end-to-end contra los 5 servicios corriendo de verdad (sin mocks):
// Auth → User & Follow (perfil por token interno) → Post → RabbitMQ → Feed
// (fan-out en Redis) → Chat (solicitudes de mensaje).
//
// Requisitos: infraestructura y servicios levantados (./start-all.sh o el job
// "e2e" del CI) y THROTTLE_DISABLED=true en los servicios.
// Ejecutar: node --test "e2e/*.test.mjs"
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

const URL = {
  auth: process.env.AUTH_URL ?? 'http://localhost:3000',
  users: process.env.USERS_URL ?? 'http://localhost:3001',
  posts: process.env.POSTS_URL ?? 'http://localhost:3002',
  chat: process.env.CHAT_URL ?? 'http://localhost:3003',
  feed: process.env.FEED_URL ?? 'http://localhost:3004',
};

async function call(service, path, { method = 'GET', token, body } = {}) {
  const res = await fetch(URL[service] + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

// Lo asíncrono (eventos de RabbitMQ) se espera con reintentos, no con sleeps fijos.
async function eventually(check, { timeout = 10_000, every = 250 } = {}) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    last = await check();
    if (last) return last;
    await new Promise((r) => setTimeout(r, every));
  }
  return last;
}

const run = Date.now().toString(36);
async function register(name) {
  const username = `e2e_${name}_${run}`;
  const { status, data } = await call('auth', '/auth/register', {
    method: 'POST',
    body: { username, password: `E2e-${run}-pass`, firstName: name, lastName: 'E2E' },
  });
  assert.equal(status, 201, `registro de ${username}: ${JSON.stringify(data)}`);
  return { id: data.userId, username, token: data.accessToken, refreshToken: data.refreshToken };
}

describe('PiensaYa e2e', () => {
  let ana, beto, caro;

  before(async () => {
    [ana, beto, caro] = await Promise.all([register('ana'), register('beto'), register('caro')]);
  });

  describe('Auth + User & Follow', () => {
    it('el registro crea el perfil en el User & Follow Service', async () => {
      const profile = await eventually(async () => {
        const { status, data } = await call('users', `/users/${ana.id}`);
        return status === 200 && data;
      });
      assert.equal(profile.username, ana.username);
      assert.equal(profile.followersCount, 0);
    });

    it('login con credenciales correctas e incorrectas', async () => {
      const ok = await call('auth', '/auth/login', {
        method: 'POST',
        body: { username: ana.username, password: `E2e-${run}-pass` },
      });
      assert.equal(ok.status, 200);
      const bad = await call('auth', '/auth/login', {
        method: 'POST',
        body: { username: ana.username, password: 'incorrecta-123' },
      });
      assert.equal(bad.status, 401);
    });

    it('el refresh token entrega un access token nuevo', async () => {
      const { status, data } = await call('auth', '/auth/refresh', {
        method: 'POST',
        body: { refreshToken: ana.refreshToken },
      });
      assert.equal(status, 200);
      assert.ok(data.accessToken);
      ana.token = data.accessToken;
      ana.refreshToken = data.refreshToken;
    });

    it('seguir actualiza contadores, listas paginadas y la consulta puntual', async () => {
      assert.equal((await call('users', `/users/${beto.id}/follow`, { method: 'POST', token: ana.token })).status, 201);
      assert.equal((await call('users', `/users/${caro.id}/follow`, { method: 'POST', token: beto.token })).status, 201);

      const { data: betoProfile } = await call('users', `/users/${beto.id}`);
      assert.equal(betoProfile.followersCount, 1);

      const { data: page } = await call('users', `/users/${ana.id}/following?limit=1&offset=0`);
      assert.deepEqual(page.map((p) => p.userId), [beto.id]);

      const { data: yes } = await call('users', `/users/${ana.id}/following/${beto.id}`);
      const { data: no } = await call('users', `/users/${beto.id}/following/${ana.id}`);
      assert.equal(yes.following, true);
      assert.equal(no.following, false);
    });

    it('sugiere amigos de amigos primero', async () => {
      // ana sigue a beto y beto sigue a caro → caro, con 1 en común.
      const { status, data } = await call('users', '/users/me/suggestions?limit=5', { token: ana.token });
      assert.equal(status, 200);
      assert.equal(data[0].userId, caro.id);
      assert.equal(data[0].mutualCount, 1);
      assert.ok(!data.some((s) => s.userId === ana.id || s.userId === beto.id));
    });
  });

  describe('Post → RabbitMQ → Feed', () => {
    let postId;

    it('publicar llega al feed de quien sigue al autor', async () => {
      const { status, data } = await call('posts', '/posts', {
        method: 'POST',
        token: beto.token,
        body: { type: 'TWEET', content: `Apunte e2e #e2e${run}` },
      });
      assert.equal(status, 201);
      postId = data.id;

      const inFeed = await eventually(async () => {
        const { data: feed } = await call('feed', '/feed', { token: ana.token });
        return feed?.items?.some((i) => i.postId === postId);
      });
      assert.ok(inFeed, 'el post no llegó al feed de quien sigue al autor');
    });

    it('la reacción propia se guarda y se devuelve como myReaction', async () => {
      const react = await call('posts', `/posts/${postId}/reactions`, {
        method: 'PUT',
        token: ana.token,
        body: { type: 'FELIZ' },
      });
      assert.equal(react.status, 200);

      const mine = await call('posts', `/posts/${postId}`, { token: ana.token });
      const anon = await call('posts', `/posts/${postId}`);
      assert.equal(mine.data.myReaction, 'FELIZ');
      assert.equal(anon.data.myReaction, null);
    });

    it('borrar el post lo saca del feed', async () => {
      assert.equal((await call('posts', `/posts/${postId}`, { method: 'DELETE', token: beto.token })).status, 204);
      const gone = await eventually(async () => {
        const { data: feed } = await call('feed', '/feed', { token: ana.token });
        return feed && !feed.items.some((i) => i.postId === postId);
      });
      assert.ok(gone, 'el post borrado sigue en el feed');
    });
  });

  describe('Chat: contactos y solicitudes', () => {
    it('un desconocido entra como solicitud y tiene tope de 3 mensajes', async () => {
      for (let i = 1; i <= 3; i++) {
        const { status } = await call('chat', `/chat/conversations/${ana.id}/messages`, {
          method: 'POST',
          token: caro.token,
          body: { content: `hola ${i}` },
        });
        assert.equal(status, 201);
      }
      const blocked = await call('chat', `/chat/conversations/${ana.id}/messages`, {
        method: 'POST',
        token: caro.token,
        body: { content: 'hola 4' },
      });
      assert.equal(blocked.status, 403);

      const { data: inbox } = await call('chat', '/chat/conversations', { token: ana.token });
      const conv = inbox.find((c) => c.otherUserId === caro.id);
      assert.equal(conv.accepted, false);
      assert.equal(conv.unreadCount, 3);
    });

    it('aceptar la solicitud la pasa a contactos y quita el tope', async () => {
      const accept = await call('chat', `/chat/conversations/${caro.id}/accept`, { method: 'POST', token: ana.token });
      assert.equal(accept.status, 204);

      const { data: inbox } = await call('chat', '/chat/conversations', { token: ana.token });
      assert.equal(inbox.find((c) => c.otherUserId === caro.id).accepted, true);

      const again = await call('chat', `/chat/conversations/${ana.id}/messages`, {
        method: 'POST',
        token: caro.token,
        body: { content: 'gracias por aceptar' },
      });
      assert.equal(again.status, 201);
    });

    it('si el destinatario te sigue no hay tope', async () => {
      // beto sigue a caro: caro → beto nunca queda limitado.
      for (let i = 1; i <= 4; i++) {
        const { status } = await call('chat', `/chat/conversations/${beto.id}/messages`, {
          method: 'POST',
          token: caro.token,
          body: { content: `msg ${i}` },
        });
        assert.equal(status, 201);
      }
    });

    it('historial paginado hacia atrás con before', async () => {
      const { data: last2 } = await call('chat', `/chat/conversations/${caro.id}/messages?limit=2`, { token: ana.token });
      assert.equal(last2.length, 2);
      const { data: older } = await call(
        'chat',
        `/chat/conversations/${caro.id}/messages?limit=10&before=${encodeURIComponent(last2[0].createdAt)}`,
        { token: ana.token },
      );
      assert.ok(older.length >= 1);
      assert.ok(older.every((m) => m.createdAt < last2[0].createdAt));
    });
  });
});
