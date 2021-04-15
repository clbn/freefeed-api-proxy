import fastify from 'fastify';
import fastifyCors from 'fastify-cors';
import fastifyCompress from 'fastify-compress';
import { loadAndFormat } from './data-formatters.js';

const app = fastify();

app.register(fastifyCors, {
  origin: true, // reflect the request origin
});

app.register(fastifyCompress, { encodings: ['gzip'] }); // gzip is twice faster than br on this low-end server

app.get('/homepage', async request => {
  return loadAndFormat(`https://freefeed.net/v2/timelines/home?offset=0`, request.headers.authorization);
});

app.get('/userpage/:username', async request => {
  const username = request.params.username;
  return loadAndFormat(`https://freefeed.net/v2/timelines/${username}?offset=0`, request.headers.authorization, username);
});

app.get('/postpage/:postId', async request => {
  const postId = request.params.postId;
  const maxLikes = request.query.maxLikes;
  return loadAndFormat(`https://freefeed.net/v2/posts/${postId}?maxComments=all&maxLikes=${maxLikes}`, request.headers.authorization);
});

(async () => {
  try {
    await app.listen(3001);
    console.log(`Server listening at http://${app.server.address().address}:${app.server.address().port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
})();
