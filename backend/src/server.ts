import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { PORT } from './config';
import { loadActivities } from './loader';
import { activityStore } from './store';
import { parseTimeRange, parseRequiredUserId } from './validation';
import { HttpError } from './errors';
import { computeUserSummary, computeActionTrends } from './analytics';
import { computeSessions } from './sessions';
import { computeAnomalies } from './anomalies';

const app = express();
app.use(cors());

function requireLoaded(): void {
  if (!activityStore.isLoaded()) {
    throw new HttpError(503, 'Activity data has not been loaded yet. Call POST /load.');
  }
}

app.post('/load', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await loadActivities();
    res.json({ status: 'ok', ...result });
  } catch (err) {
    next(err);
  }
});

app.get('/summary', (req: Request, res: Response, next: NextFunction) => {
  try {
    requireLoaded();
    const query = req.query as Record<string, unknown>;
    const userId = parseRequiredUserId(query);
    const { startMs, endMs } = parseTimeRange(query);

    if (!activityStore.hasUser(userId)) {
      throw new HttpError(404, `No data for user ${userId}`);
    }
    const events = activityStore.getUserEventsInRange(userId, startMs, endMs)!;
    if (events.length === 0) {
      throw new HttpError(404, `No data for user ${userId} in the given time range`);
    }

    res.json(computeUserSummary(userId, events));
  } catch (err) {
    next(err);
  }
});

app.get('/action_trends', (req: Request, res: Response, next: NextFunction) => {
  try {
    requireLoaded();
    const { startMs, endMs } = parseTimeRange(req.query as Record<string, unknown>);
    const usersEvents = activityStore.getAllUsersEventsInRange(startMs, endMs);
    res.json(computeActionTrends(usersEvents, 3));
  } catch (err) {
    next(err);
  }
});

/**
 * /sessions and /anomalies return a *list*, so — unlike /summary, which returns a
 * single object and 404s on an empty result — an empty list for a valid user is a
 * normal, successful response (e.g. "no anomalies found" isn't an error). 404 is
 * reserved for a user_id that has no data at all, still consistent with /summary.
 */
app.get('/sessions', (req: Request, res: Response, next: NextFunction) => {
  try {
    requireLoaded();
    const query = req.query as Record<string, unknown>;
    const userId = parseRequiredUserId(query);
    const { startMs, endMs } = parseTimeRange(query);

    if (!activityStore.hasUser(userId)) {
      throw new HttpError(404, `No data for user ${userId}`);
    }
    const events = activityStore.getUserEventsInRange(userId, startMs, endMs)!;
    res.json(computeSessions(events));
  } catch (err) {
    next(err);
  }
});

app.get('/anomalies', (req: Request, res: Response, next: NextFunction) => {
  try {
    requireLoaded();
    const query = req.query as Record<string, unknown>;
    const userId = parseRequiredUserId(query);
    const { startMs, endMs } = parseTimeRange(query);

    if (!activityStore.hasUser(userId)) {
      throw new HttpError(404, `No data for user ${userId}`);
    }
    const events = activityStore.getUserEventsInRange(userId, startMs, endMs)!;
    res.json(computeAnomalies(events));
  } catch (err) {
    next(err);
  }
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});

// Load on startup, but don't block the server from accepting connections while it does.
// If this fails, endpoints return 503 until a successful POST /load retries it.
loadActivities()
  .then((result) => console.log('Initial CSV load succeeded:', result))
  .catch((err) => console.error('Initial CSV load failed; call POST /load to retry.', err));
