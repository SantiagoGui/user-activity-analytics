import type { ActivityEvent } from './types';

// Populated by requireUserScope in app.ts once the user_id/time-range preamble
// has run; optional because they don't exist before that middleware executes.
declare global {
  namespace Express {
    interface Locals {
      userId?: number;
      events?: ActivityEvent[];
    }
  }
}

export {};
