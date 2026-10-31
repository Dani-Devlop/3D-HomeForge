'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Light/dark toggle for the top bar. Persisted by next-themes (localStorage),
 *  initial value follows the system preference. Icons swap via the `dark`
 *  class, so there is no hydration-sensitive state. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      aria-label={label}
      title={label}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <Sun className="hidden dark:block h-5 w-5" />
      <Moon className="dark:hidden h-5 w-5" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
