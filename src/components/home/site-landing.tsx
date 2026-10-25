'use client';

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
  Share2,
  Sparkles,
  Type,
  Users,
  Video,
} from 'lucide-react';
import { api, type PortfolioItemDTO } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
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
// صفحه اصلی عمومی (لندینگ مشتری) — معرفی پلتفرم + نمونه‌کارها
// ============================================================

export const CATEGORY_LABEL: Record<string, string> = {
  kitchen: 'آشپزخانه',
  bedroom: 'اتاق خواب',
  living: 'نشیمن',
  office: 'کمد و اداری',
  other: 'سایر',
};

const BRAND = 'استودیو۳بعد';
const BRAND_TAGLINE = 'از چند عکس تا فضای سه‌بعدی';

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- ورود مدیر (دیاalog نوبار) ----------
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
        title: 'ورود ناموفق',
        description: e.message || 'رمز مدیر اشتباه است',
        variant: 'destructive',
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4.5 w-4.5 text-primary" /> ورود مدیر
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            برای ورود به پنل مدیریت و پروژه‌ها، رمز مدیر را وارد کنید.
          </p>
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && pw && login.mutate()}
            placeholder="رمز مدیر"
            autoFocus
            className="h-11 text-center"
            aria-label="رمز مدیر"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button onClick={() => login.mutate()} disabled={!pw || login.isPending} className="gap-1.5">
            {login.isPending ? (
              <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            ورود
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- نوبار ----------
function SiteNavbar({ authed, onEnterDashboard }: { authed: boolean; onEnterDashboard: () => void }) {
  const [loginOpen, setLoginOpen] = useState(false);

  const links = [
    { id: 'how', label: 'چطور کار می‌کند؟' },
    { id: 'features', label: 'امکانات' },
    { id: 'portfolio', label: 'نمونه‌کارها' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3" aria-label="ناوبری اصلی">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center gap-2 shrink-0"
          aria-label={`${BRAND} — بازگشت به بالای صفحه`}
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
          {authed ? (
            <Button size="sm" className="gap-1.5" onClick={onEnterDashboard}>
              <FolderOpen className="h-4 w-4" /> پنل مدیریت
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setLoginOpen(true)}
              aria-label="ورود مدیر"
            >
              <Lock className="h-3.5 w-3.5" /> ورود
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

// ---------- بخش عمومی با انیمیشن ورود ----------
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

// ---------- هیرو ----------
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
            طراحی و بازسازی سه‌بعدی فضا با هوش مصنوعی
          </Badge>
          <h2 className="text-3xl md:text-5xl font-black leading-[1.25]">
            از چند <span className="text-primary">عکس ساده</span>
            {' '}تا مدل سه‌بعدی کامل فضای شما
          </h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            عکس‌های خانه، آشپزخانه یا مغازه‌تان را آپلود کنید؛ هوش مصنوعی همان فضا را با دیوارها،
            پنجره‌ها و تجهیزاتش به یک مدل سه‌بعدی قابل ویرایش تبدیل می‌کند. طرح را با هم مرور می‌کنید،
            تغییرش می‌دهید و نتیجه نهایی را قبل از حتی یک ساعت کار اجرایی می‌بینید.
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <Button size="lg" className="gap-2" onClick={() => scrollTo('portfolio')}>
              <Images className="h-4.5 w-4.5" /> مشاهده نمونه‌کارها
            </Button>
            <Button size="lg" variant="outline" className="gap-2" onClick={() => scrollTo('how')}>
              چطور کار می‌کند؟ <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-2 text-xs text-muted-foreground">
            {[
              'بدون نیاز به نصب — کاملاً تحت وب',
              'خروجی استاندارد GLB',
              'بازدید مشتری فقط با لینک، بدون ثبت‌نام',
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
              src="/hero-kitchen.png"
              alt="نمای سه‌بعدی آشپزخانه طراحی‌شده در استودیو۳بعد"
              className="w-full h-auto object-cover"
            />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ---------- چطور کار می‌کند ----------
const STEPS = [
  {
    icon: Camera,
    title: '۱. ارسال عکس یا ویدیو',
    text: 'چند عکس از زوایای مختلف فضا (یا یک ویدیو کوتاه) کافی است. اگر پلان خانه را دارید، دقت ابعاد بیشتر می‌شود.',
  },
  {
    icon: Sparkles,
    title: '۲. بازسازی هوشمند',
    text: 'AI دیوارها، پنجره‌ها، درب‌ها و تجهیزات موجود (کابینت، یخچال، اجاق، مبلمان و…) را تشخیص می‌دهد و مدل می‌سازد.',
  },
  {
    icon: MousePointerClick,
    title: '۳. ویرایش و چیدمان',
    text: 'کابینت و لوازم را جابه‌جا کنید، ابعاد و رنگ‌ها را عوض کنید یا با یک جمله فارسی مدل جدید بسازید.',
  },
  {
    icon: Share2,
    title: '۴. اشتراک‌گذاری با لینک',
    text: 'لینک اختصاصی بگیرید؛ مشتری بدون ثبت‌نام سه‌بعدی را می‌گردد، درب‌ها را باز می‌کند و نظرش را می‌دهد.',
  },
];

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 py-14 md:py-20 bg-muted/40 border-y">
      <div className="max-w-6xl mx-auto px-4 space-y-8">
        <FadeIn className="text-center space-y-2.5 max-w-2xl mx-auto">
          <Badge variant="outline" className="gap-1.5 text-primary border-primary/30">
            <Sparkles className="h-3.5 w-3.5" /> فرایند کار
          </Badge>
          <h2 className="text-2xl md:text-4xl font-black">چهار قدم تا دیدن فضای شما در سه‌بعد</h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            از لحظه گرفتن عکس با گوشی تا تایید نهایی طرح، همه‌چیز آنلاین و شفاف است.
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
                    {(i + 1).toLocaleString('fa-IR')}
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

// ---------- امکانات ----------
const FEATURES = [
  {
    icon: Camera,
    title: 'بازسازی از عکس و ویدیو',
    text: 'تبدیل چند عکس معمولی گوشی به مدل سه‌بعدی کامل با ابعاد واقعی فضا و تجهیزات موجود.',
  },
  {
    icon: Type,
    title: 'ساخت و ویرایش با متن فارسی',
    text: '«کابینت زمینی سفید ۸۰ سانتی با دو درب شیشه‌ای» — فقط بنویسید؛ مدل ساخته یا ویرایش می‌شود.',
  },
  {
    icon: MousePointerClick,
    title: 'ویرایشگر سه‌بعدی حرفه‌ای',
    text: 'جابه‌جایی با درگ، چرخش، تغییر ابعاد و رنگ، باز شدن درب‌ها و روشن/خاموش چراغ‌ها — با Undo/Redo.',
  },
  {
    icon: Users,
    title: 'اشتراک‌گذاری با نقش',
    text: 'لینک فقط-نمایش یا ویرایش‌پذیر با تاریخ انقضا؛ بازدید مشتری بدون ثبت‌نام و ذخیره خودکار نظرات.',
  },
  {
    icon: Video,
    title: 'مدل‌سازی همه لوازم خانه',
    text: 'از کابینت و جزیره تا یخچال، اجاق، هود، تلویزیون، مبل، تخت و لباسشویی — همه در یک صحنه.',
  },
  {
    icon: Share2,
    title: 'خروجی استاندارد GLB',
    text: 'دانلود مدل نهایی در قالب glTF/GLB برای استفاده در سایر نرم‌افزارها و آرکایو.',
  },
];

function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-14 md:py-20">
      <div className="max-w-6xl mx-auto px-4 space-y-8">
        <FadeIn className="text-center space-y-2.5 max-w-2xl mx-auto">
          <Badge variant="outline" className="gap-1.5 text-primary border-primary/30">
            <Box className="h-3.5 w-3.5" /> امکانات پلتفرم
          </Badge>
          <h2 className="text-2xl md:text-4xl font-black">هرچیزی که برای طراحی فضا لازم دارید</h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            یک پلتفرم کامل برای کابینت‌سازها، معماران و طراحان داخلی — از بازسازی تا تحویل به مشتری.
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

// ---------- نمونه‌کارها ----------
function PortfolioCard({ item, index }: { item: PortfolioItemDTO; index: number }) {
  return (
    <FadeIn delay={(index % 3) * 0.08}>
      <figure className="group h-full rounded-2xl border bg-card overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all">
        <div className="aspect-[4/3] overflow-hidden bg-muted relative">
          <img
            src={item.image}
            alt={`نمونه‌کار: ${item.title}`}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <Badge className="absolute top-2.5 start-2.5 text-[10px] gap-1 bg-black/50 text-white border-0 backdrop-blur">
            {CATEGORY_LABEL[item.category] ?? 'فضا'}
          </Badge>
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
            <Images className="h-3.5 w-3.5" /> نمونه‌کارها
          </Badge>
          <h2 className="text-2xl md:text-4xl font-black">کارهایی که با این پلتفرم طراحی شده‌اند</h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            نمونه‌های واقعی از آشپزخانه، اتاق خواب و فضاهای کاری — همه بازسازی‌شده از عکس‌های معمولی.
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
            <p className="text-sm font-medium">به‌زودی نمونه‌کارهای جدید اضافه می‌شود</p>
            <p className="text-xs text-muted-foreground">
              برای دیدن قابلیت‌های پلتفرم، بخش «چطور کار می‌کند» را ببینید
            </p>
          </div>
        )}
        {isError && (
          <p className="text-xs text-center text-destructive">
            خطا در بارگذاری نمونه‌کارها — صفحه را دوباره بارگذاری کنید
          </p>
        )}
      </div>
    </section>
  );
}

// ---------- CTA + فوتر ----------
function CtaBand() {
  return (
    <section className="py-14">
      <div className="max-w-6xl mx-auto px-4">
        <FadeIn>
          <div className="rounded-3xl border bg-gradient-to-l from-primary/10 via-primary/5 to-transparent p-8 md:p-10 flex flex-col md:flex-row items-center gap-5 md:gap-8">
            <div className="flex-1 space-y-2 text-center md:text-start">
              <h2 className="text-xl md:text-2xl font-black">
                آماده‌اید فضای خودتان را قبل از ساخت، سه‌بعدی ببینید؟
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                کافی است چند عکس از فضای فعلی بفرستید؛ مدل سه‌بعدی و طرح پیشنهادی را در همین صفحه
                نمونه‌کارها می‌بینید.
              </p>
            </div>
            <Button size="lg" className="gap-2 shrink-0" onClick={() => scrollTo('portfolio')}>
              <Images className="h-4.5 w-4.5" /> دیدن نمونه‌کارها
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
        <p>© {new Date().getFullYear().toLocaleString('fa-IR')} — همه حقوق محفوظ است</p>
      </div>
    </footer>
  );
}

// ---------- صفحه کامل ----------
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
