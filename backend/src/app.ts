import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { loadActivities } from './loader';
import type { ActivityStore } from './store';
import { parseTimeRange, parseRequiredUserId } from './validation';
import { HttpError } from './errors';
import { computeUserSummary, computeActionTrends } from './analytics';
import { computeSessions } from './sessions';
import { computeAnomalies } from './anomalies';

function requireLoaded(store: ActivityStore): void {
  if (!store.isLoaded()) {
    throw new HttpError(503, 'Activity data has not been loaded yet. Call POST /load.');
  }
}

/**
 * Shared preamble for the three user-scoped endpoints (/summary, /sessions,
 * /anomalies): requireLoaded -> parse user_id -> parse time range -> 404 if the
 * user has no data at all -> attach the in-range events to res.locals.
 * /summary layers its own additional 404 (empty range) on top of this; that
 * check stays in its own handler since it's specific to a single-object
 * response (see CLAUDE.md #4).
 */
function requireUserScope(store: ActivityStore) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      requireLoaded(store);
      const query = req.query as Record<string, unknown>;
      const userId = parseRequiredUserId(query);
      const { startMs, endMs } = parseTimeRange(query);

      if (!store.hasUser(userId)) {
        throw new HttpError(404, `No data for user ${userId}`);
      }
      res.locals.userId = userId;
      res.locals.events = store.getUserEventsInRange(userId, startMs, endMs)!;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function createApp(store: ActivityStore): express.Express {
  const app = express();
  app.use(cors());

  app.post('/load', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await loadActivities(store);
      res.json({ status: 'ok', ...result });
    } catch (err) {
      next(err);
    }
  });

  app.get('/summary', requireUserScope(store), (_req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = res.locals.userId!;
      const events = res.locals.events!;
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
      requireLoaded(store);
      const { startMs, endMs } = parseTimeRange(req.query as Record<string, unknown>);
      const usersEvents = store.getAllUsersEventsInRange(startMs, endMs);
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
  app.get('/sessions', requireUserScope(store), (_req: Request, res: Response) => {
    res.json(computeSessions(res.locals.events!));
  });

  app.get('/anomalies', requireUserScope(store), (_req: Request, res: Response) => {
    res.json(computeAnomalies(res.locals.events!));
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

  return app;
}
