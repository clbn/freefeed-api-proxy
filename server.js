import fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyCompress from '@fastify/compress';

import { config } from './config.js';
import { loadAndFormat } from './data-formatters.js';

const app = fastify();

await app.register(fastifyCors, {
  origin: true, // reflect the request origin
});

await app.register(fastifyCompress, {
  encodings: ['gzip'], // gzip is twice faster than br on this low-end server
});

app.get('/homepage', async request => {
  const offset = +request.query.offset || 0;
  return loadAndFormat(`${config.api.host}/v2/timelines/home?offset=${offset}`, request.headers.authorization);
});

app.get('/searchpage', async request => {
  const q = request.query.q;
  const offset = +request.query.offset || 0;
  return loadAndFormat(`${config.api.host}/v2/search?qs=${encodeURIComponent(q)}&offset=${offset}`, request.headers.authorization);
});

app.get('/discussionspage', async request => {
  const offset = +request.query.offset || 0;
  return loadAndFormat(`${config.api.host}/v2/timelines/filter/discussions?with-my-posts=yes&offset=${offset}`, request.headers.authorization);
});

app.get('/directspage', async request => {
  const offset = +request.query.offset || 0;
  return loadAndFormat(`${config.api.host}/v2/timelines/filter/directs?offset=${offset}`, request.headers.authorization);
});

app.get('/userpage/:username', async request => {
  const username = request.params.username;
  const offset = +request.query.offset || 0;
  return loadAndFormat(`${config.api.host}/v2/timelines/${username}?offset=${offset}`, request.headers.authorization, username);
});

app.get('/usercommentspage/:username', async request => {
  const username = request.params.username;
  const offset = +request.query.offset || 0;
  return loadAndFormat(`${config.api.host}/v2/timelines/${username}/comments?offset=${offset}`, request.headers.authorization, username);
});

app.get('/userlikespage/:username', async request => {
  const username = request.params.username;
  const offset = +request.query.offset || 0;
  return loadAndFormat(`${config.api.host}/v2/timelines/${username}/likes?offset=${offset}`, request.headers.authorization, username);
});

app.get('/postpage/:postId', async request => {
  const postId = request.params.postId;
  const maxLikes = request.query.maxLikes;
  return loadAndFormat(`${config.api.host}/v2/posts/${postId}?maxComments=all&maxLikes=${maxLikes}`, request.headers.authorization, null, postId);
});

(async () => {
  try {
    await app.listen({ port: 3001 });
    console.log(`Server listening at http://${app.server.address().address}:${app.server.address().port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
})();
