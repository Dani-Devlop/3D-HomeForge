'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowDown,
  Box,
  Camera,
  FolderOpen,
  Images,
  Lock,
  LogIn,
  MousePointerClick,
  Rotate3d,
  Share2,
  Sparkles,
  Type,
  Users,
  Video,
} from 'lucide-react';
import { api, type PortfolioItemDTO } from '@/lib/api';
import { hasLiveScene } from '@/components/three/portfolio-scene';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ============================================================
// Public landing page (client-facing) — platform intro + live 3D portfolio
// ============================================================

// Live 3D scene — client-side only (three.js)
const PortfolioScene = dynamic(() => import('@/components/three/portfolio-scene'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-muted animate-pulse" aria-hidden />,
});

export const CATEGORY_LABEL: Record<string, string> = {
  kitchen: 'Kitchen',
  bedroom: 'Bedroom',
  living: 'Living room',
  office: 'Cabinets & office',
  other: 'Other',
};

const BRAND = '3D HomeForge';
const BRAND_TAGLINE = 'From a few photos to a 3D space';

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- Admin login (navbar dialog) ----------
function LoginDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [pw, setPw] = useState('');

  const login = useMutation({
    mutationFn: () => api.login(pw),
    onSuccess: async () => {
      setPw('');
      await qc.invalidateQueries({ queryKey: ['session'] });
      onOpenChange(false);
      onSuccess();
    },
    onError: (e: Error) =>
      toast({
        title: 'Login failed',
        description: e.message || 'Incorrect admin password',
        variant: 'destructive',
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="ltr" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4.5 w-4.5 text-primary" /> Admin login
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Enter the admin password to access the management panel and projects.
          </p>
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && pw && login.mutate()}
            placeholder="Admin password"
            autoFocus
            className="h-11 text-center"
            aria-label="Admin password"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => login.mutate()} disabled={!pw || login.isPending} className="gap-1.5">
            {login.isPending ? (
              <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            Log in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Navbar ----------
function SiteNavbar({ authed, onEnterDashboard }: { authed: boolean; onEnterDashboard: () => void }) {
  const [loginOpen, setLoginOpen] = useState(false);

  const links = [
    { id: 'how', label: 'How it works' },
    { id: 'features', label: 'Features' },
    { id: 'portfolio', label: 'Portfolio' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3" aria-label="Main navigation">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center gap-2 shrink-0"
          aria-label={`${BRAND} — back to top`}
        >
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <Box className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <h1 className="font-black">{BRAND}</h1>
            <p className="text-[10px] text-muted-foreground hidden sm:block">{BRAND_TAGLINE}</p>
          </div>
        </a>

        <div className="hidden md:flex items-center gap-1 mx-auto">
          {links.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => scrollTo(l.id)}
              className="px-3 h-9 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="ms-auto md:ms-0 flex items-center gap-2">
          <ThemeToggle />
          {authed ? (
            <Button size="sm" className="gap-1.5" onClick={onEnterDashboard}>
              <FolderOpen className="h-4 w-4" /> Admin panel
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setLoginOpen(true)}
              aria-label="Admin login"
            >
              <Lock className="h-3.5 w-3.5" /> Log in
            </Button>
          )}
        </div>
      </nav>

      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onSuccess={onEnterDashboard}
      />
    </header>
  );
}

// ---------- Section with fade-in entrance ----------
function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---------- Hero ----------
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.07] via-transparent to-transparent"
        aria-hidden
      />
      <div className="max-w-6xl mx-auto px-4 pt-12 pb-14 md:pt-20 md:pb-20 grid md:grid-cols-2 gap-8 items-center">
        <FadeIn className="space-y-5">
          <Badge variant="secondary" className="gap-1.5 h-7 px-3 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            AI-powered 3D space design and reconstruction
          </Badge>
          <h2 className="text-3xl md:text-5xl font-black leading-[1.25]">
            From a few <span className="text-primary">simple photos</span>
            {' '}to a complete 3D model of your space
          </h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            Upload photos of your home, kitchen, or shop; AI turns the very same space — walls,
            windows, and fixtures included — into an editable 3D model. Review the design together,
            refine it, and see the final result before a single hour of on-site work begins.
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <Button size="lg" className="gap-2" onClick={() => scrollTo('portfolio')}>
              <Images className="h-4.5 w-4.5" /> View portfolio
            </Button>
            <Button size="lg" variant="outline" className="gap-2" onClick={() => scrollTo('how')}>
              How it works <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-2 text-xs text-muted-foreground">
            {[
              'No installation — fully web-based',
              'Standard GLB export',
              'Client viewing via link only, no sign-up',
            ].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                {t}
              </span>
            ))}
          </div>
        </FadeIn>
        <FadeIn delay={0.12}>
          <div className="rounded-2xl overflow-hidden border shadow-xl animate-float">
            <img
              src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/hero-kitchen.png`}
              alt="3D kitchen view designed in 3D HomeForge"
              className="w-full h-auto object-cover"
            />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ---------- How it works ----------
const STEPS = [
  {
    icon: Camera,
    title: '1. Send photos or a video',
    text: 'A few photos from different angles (or a short video) are enough. If you have the floor plan, dimension accuracy improves.',
  },
  {
    icon: Sparkles,
    title: '2. Smart reconstruction',
    text: 'AI detects walls, windows, doors, and existing fixtures (cabinets, fridge, stove, furniture, etc.) and builds the model.',
  },
  {
    icon: MousePointerClick,
    title: '3. Edit & arrange',
    text: 'Move cabinets and items, change dimensions and colors, or create new models from a single sentence.',
  },
  {
    icon: Share2,
    title: '4. Share with a link',
    text: 'Get a dedicated link; your client explores the 3D view, opens doors, and leaves feedback — no sign-up required.',
  },
];

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 py-14 md:py-20 bg-muted/40 border-y">
      <div className="max-w-6xl mx-auto px-4 space-y-8">
        <FadeIn className="text-center space-y-2.5 max-w-2xl mx-auto">
          <Badge variant="outline" className="gap-1.5 text-primary border-primary/30">
            <Sparkles className="h-3.5 w-3.5" /> The process
          </Badge>
          <h2 className="text-2xl md:text-4xl font-black">Four steps to see your space in 3D</h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            From snapping photos with your phone to final design approval, everything is online and transparent.
          </p>
        </FadeIn>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((s, i) => (
            <FadeIn key={s.title} delay={i * 0.08}>
              <div className="h-full rounded-2xl border bg-card p-5 space-y-3 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="flex items-center justify-between">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <s.icon className="h-5.5 w-5.5 text-primary" />
                  </div>
                  <span className="text-2xl font-black text-primary/15 tabular-nums" aria-hidden>
                    {(i + 1).toLocaleString('en-US')}
                  </span>
                </div>
                <h3 className="font-bold text-sm">{s.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.text}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- Features ----------
const FEATURES = [
  {
    icon: Camera,
    title: 'Reconstruction from photos & video',
    text: 'Turn a few ordinary phone photos into a complete 3D model with real dimensions and existing fixtures.',
  },
  {
    icon: Type,
    title: 'Create & edit with plain text',
    text: '“White 80 cm base cabinet with two glass doors” — just type it; the model is created or updated.',
  },
  {
    icon: MousePointerClick,
    title: 'Professional 3D editor',
    text: 'Drag to move, rotate, resize and recolor, openable doors, lights on/off — with Undo/Redo.',
  },
  {
    icon: Users,
    title: 'Role-based sharing',
    text: 'View-only or editable links with expiry dates; clients view without sign-up and feedback is saved automatically.',
  },
  {
    icon: Video,
    title: 'Modeling for every household item',
    text: 'From cabinets and islands to fridges, stoves, hoods, TVs, sofas, beds, and washing machines — all in one scene.',
  },
  {
    icon: Share2,
    title: 'Standard GLB export',
    text: 'Download the final model as glTF/GLB for use in other software and archives.',
  },
];

function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-14 md:py-20">
      <div className="max-w-6xl mx-auto px-4 space-y-8">
        <FadeIn className="text-center space-y-2.5 max-w-2xl mx-auto">
          <Badge variant="outline" className="gap-1.5 text-primary border-primary/30">
            <Box className="h-3.5 w-3.5" /> Platform features
          </Badge>
          <h2 className="text-2xl md:text-4xl font-black">Everything you need to design a space</h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            A complete platform for cabinet makers, architects, and interior designers — from survey to client handover.
          </p>
        </FadeIn>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={(i % 3) * 0.08}>
              <div className="h-full rounded-2xl border bg-card p-5 space-y-3 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <f.icon className="h-5.5 w-5.5 text-primary" />
                </div>
                <h3 className="font-bold text-sm">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.text}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- Portfolio ----------
function PortfolioCard({ item, index }: { item: PortfolioItemDTO; index: number }) {
  const live = hasLiveScene(item.sceneState);

  return (
    <FadeIn delay={(index % 3) * 0.08}>
      <figure className="group h-full rounded-2xl border bg-card overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all">
        <div className="aspect-[4/3] overflow-hidden bg-muted relative">
          {live ? (
            <>
              {/* Live 3D model — drag to rotate + door/light interaction */}
              <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.02]">
                <PortfolioScene roomSpec={item.roomSpec} sceneState={item.sceneState} />
              </div>
              <Badge className="absolute top-2.5 start-2.5 text-[10px] gap-1 bg-black/50 text-white border-0 backdrop-blur pointer-events-none">
                {CATEGORY_LABEL[item.category] ?? 'Space'}
              </Badge>
              <Badge className="absolute top-2.5 end-2.5 text-[10px] gap-1 bg-primary/90 text-primary-foreground border-0 backdrop-blur pointer-events-none">
                <Rotate3d className="h-3 w-3" /> Live 3D
              </Badge>
              <span className="absolute bottom-2.5 inset-x-2 text-center text-[10px] text-white/90 bg-black/45 rounded-full py-1 backdrop-blur pointer-events-none opacity-90 transition-opacity group-hover:opacity-100">
                Drag to rotate • Tap doors and lights
              </span>
            </>
          ) : (
            <>
              <img
                src={item.image}
                alt={`Portfolio item: ${item.title}`}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <Badge className="absolute top-2.5 start-2.5 text-[10px] gap-1 bg-black/50 text-white border-0 backdrop-blur">
                {CATEGORY_LABEL[item.category] ?? 'Space'}
              </Badge>
            </>
          )}
        </div>
        <figcaption className="p-4 space-y-1.5">
          <h3 className="font-bold text-sm">{item.title}</h3>
          {item.description && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
              {item.description}
            </p>
          )}
        </figcaption>
      </figure>
    </FadeIn>
  );
}

function PortfolioSection() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['portfolio', 'public'],
    queryFn: () => api.listPortfolio(),
    staleTime: 30_000,
  });

  const items = data?.items ?? [];

  return (
    <section id="portfolio" className="scroll-mt-20 py-14 md:py-20 bg-muted/40 border-y">
      <div className="max-w-6xl mx-auto px-4 space-y-8">
        <FadeIn className="text-center space-y-2.5 max-w-2xl mx-auto">
          <Badge variant="outline" className="gap-1.5 text-primary border-primary/30">
            <Rotate3d className="h-3.5 w-3.5" /> Portfolio
          </Badge>
          <h2 className="text-2xl md:text-4xl font-black">Real projects — as live 3D models</h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            Each portfolio item is an interactive 3D model; rotate it, open cabinet doors, and turn
            on the lights — exactly what your client sees via the link.
          </p>
        </FadeIn>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl border bg-card overflow-hidden">
                <div className="aspect-[4/3] bg-muted animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-full bg-muted rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((it, i) => (
              <PortfolioCard key={it.id} item={it} index={i} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed bg-card p-12 text-center space-y-2">
            <Images className="h-10 w-10 mx-auto text-muted-foreground/30" />
            <p className="text-sm font-medium">New portfolio items coming soon</p>
            <p className="text-xs text-muted-foreground">
              See the “How it works” section to explore the platform’s capabilities
            </p>
          </div>
        )}
        {isError && (
          <p className="text-xs text-center text-destructive">
            Failed to load the portfolio — please reload the page
          </p>
        )}
      </div>
    </section>
  );
}

// ---------- CTA + footer ----------
function CtaBand() {
  return (
    <section className="py-14">
      <div className="max-w-6xl mx-auto px-4">
        <FadeIn>
          <div className="rounded-3xl border bg-gradient-to-l from-primary/10 via-primary/5 to-transparent p-8 md:p-10 flex flex-col md:flex-row items-center gap-5 md:gap-8">
            <div className="flex-1 space-y-2 text-center md:text-start">
              <h2 className="text-xl md:text-2xl font-black">
                Ready to see your space in 3D before it’s built?
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Just send a few photos of the current space; the 3D model and proposed design appear
                right here in the portfolio.
              </p>
            </div>
            <Button size="lg" className="gap-2 shrink-0" onClick={() => scrollTo('portfolio')}>
              <Images className="h-4.5 w-4.5" /> View portfolio
            </Button>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-card">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
            <Box className="h-4 w-4 text-primary-foreground" />
          </div>
          <p>
            <span className="font-bold text-foreground">{BRAND}</span> — {BRAND_TAGLINE}
          </p>
        </div>
        <p dir="ltr" className="font-mono">
          glTF / GLB • React Three Fiber
        </p>
        <p>© {new Date().getFullYear().toLocaleString('en-US')} — All rights reserved</p>
      </div>
    </footer>
  );
}

// ---------- Full page ----------
export default function SiteLanding({
  authed,
  onEnterDashboard,
}: {
  authed: boolean;
  onEnterDashboard: () => void;
}) {
  return (
    <div id="top" className="min-h-screen flex flex-col bg-background">
      <SiteNavbar authed={authed} onEnterDashboard={onEnterDashboard} />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <Features />
        <PortfolioSection />
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  );
}
