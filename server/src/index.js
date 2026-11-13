import express from 'express';
import cors from 'cors';
import { connect } from './db.js';
import api from './routes/api.js';
import users from './routes/users.js';
import reviews from './routes/reviews.js';
import { buildIndex } from './recommender/engine.js';

const PORT = process.env.PORT || 5050;
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', users);
app.use('/api', reviews);
app.use('/api', api);
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

await connect();
app.listen(PORT, () => console.log(`[api] listening on http://localhost:${PORT}`));
buildIndex().catch((e) => console.error('[engine] failed', e));

export default app;
