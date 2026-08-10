/**
 * Four session bars at varying heights and gaps — the signature timeline at
 * 16px. Domain-derived rather than decorative: the mark is the product's core
 * idea (activity punctuated by gaps) at logo scale.
 *
 * Decorative, so aria-hidden — the adjacent text title carries the accessible name.
 */
export function Wordmark() {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" aria-hidden="true" focusable="false" className="wordmark">
      <rect x="0" y="0" width="3" height="16" rx="1" fill="currentColor" />
      <rect x="5" y="7" width="3" height="9" rx="1" fill="currentColor" />
      <rect x="13" y="3" width="3" height="13" rx="1" fill="currentColor" />
      <rect x="17" y="10" width="3" height="6" rx="1" fill="currentColor" />
    </svg>
  );
}
