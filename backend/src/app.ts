import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { loadActivities } from './loader';
import type { ActivityStore } from './store';
import { parseTimeRange, parseRequiredUserId, parsePagination, parseLimit } from './validation';
import { HttpError } from './errors';
import { computeUserSummary, computeActionTrends } from './analytics';
import { computeSessions, sessionsRange } from './sessions';
import { computeAnomalies } from './anomalies';
import { paginate } from './pagination';
import type { UserCount } from 'activity-analytics-shared-types';

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
      const query = req.query as Record<string, unknown>;
      const { startMs, endMs } = parseTimeRange(query);
      const limit = parseLimit(query);
      const usersEvents = store.getAllUsersEventsInRange(startMs, endMs);
      res.json(computeActionTrends(usersEvents, limit));
    } catch (err) {
      next(err);
    }
  });

  /**
   * /sessions and /anomalies return a *paginated list*, so — unlike /summary, which
   * returns a single object and 404s on an empty result — an empty result for a valid
   * user is a normal, successful response (e.g. "no anomalies found" isn't an error;
   * it's `{ items: [], total: 0, total_pages: 0, ... }`). 404 is reserved for a
   * user_id that has no data at all, still consistent with /summary. Pagination is
   * applied after computing the full session/anomaly list for the range — these are
   * derived aggregates, not slices of raw events, so they can't be paginated earlier.
   */
  app.get('/sessions', requireUserScope(store), (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize } = parsePagination(req.query as Record<string, unknown>);
      const sessions = computeSessions(res.locals.events!);
      res.json({ ...paginate(sessions, page, pageSize), ...sessionsRange(sessions) });
    } catch (err) {
      next(err);
    }
  });

  app.get('/anomalies', requireUserScope(store), (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize } = parsePagination(req.query as Record<string, unknown>);
      const anomalies = computeAnomalies(res.locals.events!);
      res.json(paginate(anomalies, page, pageSize));
    } catch (err) {
      next(err);
    }
  });

  app.get('/users', (_req: Request, res: Response, next: NextFunction) => {
    try {
      requireLoaded(store);
      const users: UserCount[] = store.listUserCounts().map(({ userId, count }) => ({ user_id: userId, count }));
      res.json(users);
    } catch (err) {
      next(err);
    }
  });

  // Deliberately exempt from requireLoaded: its whole job is to report load
  // state, including "never loaded," so it always 200s instead of 503ing.
  app.get('/health', (_req: Request, res: Response) => {
    const last = store.getLastLoadResult();
    res.json({
      loaded: store.isLoaded(),
      total_lines: last?.totalLines ?? null,
      rows_loaded: last?.loaded ?? null,
      rows_skipped: last?.skipped ?? null,
      skipped_reasons: last?.skippedReasons ?? null,
    });
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
