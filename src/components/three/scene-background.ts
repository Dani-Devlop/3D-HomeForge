'use client';

import { useSyncExternalStore } from 'react';

const LIGHT_BG = '#cdc6ba';
const DARK_BG = '#161513';

function subscribe(onChange: () => void): () => void {
  // next-themes toggles the `dark` class on <html> — watch it.
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}

const getSnapshot = (): string =>
  document.documentElement.classList.contains('dark') ? DARK_BG : LIGHT_BG;

const getServerSnapshot = (): string => LIGHT_BG;

/** Canvas clear color per theme — visually matches the CSS `--background` token
 *  and updates live when the theme changes. */
export function useSceneBackground(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
