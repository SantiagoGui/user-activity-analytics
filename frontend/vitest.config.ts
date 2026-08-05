import { defineConfig } from 'vitest/config';

// No frontend test files exist yet (Phase 2 of docs/roadmap.md is
// backend-only; frontend tests arrive in Phase 4 once components are
// extracted into testable units). passWithNoTests keeps `npm test` green
// in the meantime instead of failing on an empty suite.
export default defineConfig({
  test: {
    passWithNoTests: true,
  },
});
