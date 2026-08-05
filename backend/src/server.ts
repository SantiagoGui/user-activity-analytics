import { createApp } from './app';
import { ActivityStore } from './store';
import { loadActivities } from './loader';
import { PORT } from './config';

const store = new ActivityStore();
const app = createApp(store);

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});

// Load on startup, but don't block the server from accepting connections while it does.
// If this fails, endpoints return 503 until a successful POST /load retries it.
loadActivities(store)
  .then((result) => console.log('Initial CSV load succeeded:', result))
  .catch((err) => console.error('Initial CSV load failed; call POST /load to retry.', err));
