import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { config } from './config.js';
import { loadAndFormat } from './data-formatters.js';

const app = new Hono();

app.use('*', cors());

app.get('/homepage', async ({ req }) => {
  const offset = +req.query('offset') || 0;
  return loadAndFormat(`${config.api.host}/v3/timelines/home?offset=${offset}`, req.header('authorization'));
});

app.get('/searchpage', async ({ req }) => {
  const q = req.query('q');
  const offset = +req.query('offset') || 0;
  return loadAndFormat(`${config.api.host}/v3/search?qs=${encodeURIComponent(q)}&offset=${offset}`, req.header('authorization'), null, null, !q);
});

app.get('/discussionspage', async ({ req }) => {
  const offset = +req.query('offset') || 0;
  return loadAndFormat(`${config.api.host}/v3/timelines/filter/discussions?with-my-posts=yes&offset=${offset}`, req.header('authorization'));
});

app.get('/directspage', async ({ req }) => {
  const offset = +req.query('offset') || 0;
  return loadAndFormat(`${config.api.host}/v3/timelines/filter/directs?offset=${offset}`, req.header('authorization'));
});

app.get('/userpage/:username', async ({ req }) => {
  const username = req.param('username');
  const offset = +req.query('offset') || 0;
  return loadAndFormat(`${config.api.host}/v3/timelines/${username}?offset=${offset}`, req.header('authorization'), username);
});

app.get('/usercommentspage/:username', async ({ req }) => {
  const username = req.param('username');
  const offset = +req.query('offset') || 0;
  return loadAndFormat(`${config.api.host}/v3/timelines/${username}/comments?offset=${offset}`, req.header('authorization'), username);
});

app.get('/userlikespage/:username', async ({ req }) => {
  const username = req.param('username');
  const offset = +req.query('offset') || 0;
  return loadAndFormat(`${config.api.host}/v3/timelines/${username}/likes?offset=${offset}`, req.header('authorization'), username);
});

app.get('/postpage/:postId', async ({ req }) => {
  const postId = req.param('postId');
  const comments = req.query('comments');
  const likes = req.query('likes');
  const params = new URLSearchParams();
  if (comments === 'all') params.set('maxComments', 'all');
  if (likes === 'all') params.set('maxLikes', 'all');
  const query = params.toString();
  const url = `${config.api.host}/v3/posts/${postId}${query ? `?${query}` : ''}`;
  return loadAndFormat(url, req.header('authorization'), null, postId, false, {
    withoutComments: comments === 'none',
    withoutLikes: likes === 'none',
  });
});

app.get('/postbacklinkspage/:postId', async ({ req }) => {
  const postId = req.param('postId');
  const offset = +req.query('offset') || 0;
  return loadAndFormat(`${config.api.host}/v3/posts/${postId}/backlinks?offset=${offset}`, req.header('authorization'));
});

export default app;
