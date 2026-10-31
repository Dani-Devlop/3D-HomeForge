'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

type Route =
  | { view: 'home' }
  | { view: 'editor'; projectId: string }
  | { view: 'editor-pf'; portfolioId: string }
  | { view: 'share'; token: string };

function parseHash(): Route {
  const h = window.location.hash.replace(/^#/, '');
  // ⚠️ must be checked before '/editor/' (shared prefix)
  if (h.startsWith('/editor/pf/')) {
    const portfolioId = h.slice('/editor/pf/'.length);
    if (portfolioId) return { view: 'editor-pf', portfolioId };
  }
  if (h.startsWith('/editor/')) {
    const projectId = h.slice('/editor/'.length);
    if (projectId) return { view: 'editor', projectId };
  }
  if (h.startsWith('/s/')) {
    const token = h.slice(3);
    if (token) return { view: 'share', token };
  }
  return { view: 'home' };
}

function FullScreenLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

const HomeView = dynamic(() => import('@/components/home/home-view'), {
  ssr: false,
  loading: FullScreenLoading,
});
const EditorView = dynamic(() => import('@/components/editor/editor-view'), {
  ssr: false,
  loading: FullScreenLoading,
});
const ViewerView = dynamic(() => import('@/components/viewer/viewer-view'), {
  ssr: false,
  loading: FullScreenLoading,
});

export default function Page() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 5_000 },
        },
      })
  );
  const [route, setRoute] = useState<Route>({ view: 'home' });

  useEffect(() => {
    const apply = () => setRoute(parseHash());
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {route.view === 'editor' ? (
        <EditorView key={route.projectId} projectId={route.projectId} />
      ) : route.view === 'editor-pf' ? (
        <EditorView key={`pf-${route.portfolioId}`} portfolioId={route.portfolioId} />
      ) : route.view === 'share' ? (
        <ViewerView key={route.token} token={route.token} />
      ) : (
        <HomeView />
      )}
    </QueryClientProvider>
  );
}
