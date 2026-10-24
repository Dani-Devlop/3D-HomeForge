# Worklog

---
Task ID: 2-a
Agent: general-purpose (backend)
Task: پیاده‌سازی APIهای پلتفرم کابینت سه‌بعدی

Work Log:
- خواندن فایل‌های پایه: prisma/schema.prisma، src/lib/db.ts، scene-types.ts، share-token.ts، sample-room.ts و worklog.md (وجود نداشت)
- ساخت هلپرهای مشترک در src/app/api/_lib/serialize.ts: parseJsonSafe، serializeProject (پارس roomSpec/sceneState + shareCount + تاریخ ISO) و readJsonBody (خواندن امن بدنه JSON → 400 در بدنه خراب)
- ساخت src/app/api/_lib/share-guard.ts: checkShareToken (امضاسنجی + فعال‌بودن + چک انقضای دیتابیس با پیام‌های ۴۰۳ فارسی) برای استفاده مشترک در resolve و ثبت مهمان
- پیاده‌سازی /api/projects (GET با _count.shareLinks و مرتب‌سازی updatedAt desc، POST با zod و ذخیره JSON.stringify)
- پیاده‌سازی /api/projects/[id] (GET/PATCH/DELETE با پارامترهای async مطابق Next 16؛ 404 فارسی؛ حذف آبشاری لینک‌ها)
- پیاده‌سازی /api/projects/[id]/guests (مهمان‌های همه لینک‌ها با فیلتر relational و مرتب‌سازی newest first)
- پیاده‌سازی /api/reconstruct: پرامپت انگلیسی متخصص تحلیل فضای داخلی، اعتبارسنجی تصویر (data URL تصویری یا base64 خام، سقف ۷MB)، پارس تدافعی (حذف فنس markdown، اولین { تا آخرین })، clamp/normalize همه فیلدها به بازه‌های قرارداد، retry حداکثر ۲ تلاش، خطا → 502
- نکته مهم runtime: Endpoint متن /chat/completions بک‌اند محتوای multimodal (image_url) را با خطای 400 رد می‌کند؛ مسیر اصلی طبق قرارداد حفظ شد و در همان حلقه retry به مسیر رسمی SDK برای تصویر یعنی zai.chat.completions.createVision (endpoint /chat/completions/vision) fallback اضافه شد — تست زنده موفق بود
- پیاده‌سازی /api/share: POST (تولید id با crypto.randomUUID و امضای توکن قبل از create — یک کوئری)، GET با ?projectId و guestCount، PATCH (اعتبارسنجی نقش با isValidRole از scene-types)
- پیاده‌سازی /api/share/resolve: چک توکن + لینک فعال/منقضی + تطابق payload.pid با link.projectId + پاسخ پروژه پارس‌شده
- پیاده‌سازی /api/guests و /api/guests/[id]: ثبت‌نام با نام trim شده (1..30)، رنگ از guestColorFor، نقش از لینک؛ GET به‌عنوان heartbeat (به‌روزرسانی lastSeenAt) و PATCH نقش
- پیاده‌سازی /api/presets: GET/POST/DELETE(?id) با پارس data به آرایه
- رفع یافته تست: بدنه JSON خراب ابتدا 500 می‌داد؛ با readJsonBody به 400 فارسی اصلاح شد
- تست دودی کامل با curl روی سرور dev پورت 3000: چرخه کامل پروژه→لینک→resolve→مهمان→نقش→غیرفعال‌سازی→پریست→حذف و cascade؛ تست خطاها (توکن نامعتبر 403، نقش نامعتبر 400، حجم تصویر 400، فرمت غیرتصویری 400، 404ها)
- اجرای bunx eslint src/app/api --no-warn-ignored → بدون خطا؛ bunx tsc --noEmit → بدون خطا در src/app/api

Stage Summary:
- Endpoints: /api/projects (GET,POST) — /api/projects/[id] (GET,PATCH,DELETE) — /api/projects/[id]/guests (GET) — /api/reconstruct (POST) — /api/share (GET,POST,PATCH) — /api/share/resolve (GET) — /api/guests (POST) — /api/guests/[id] (GET,PATCH) — /api/presets (GET,POST,DELETE)
- فایل‌های ساخته‌شده: ۹ فایل روت + ۲ هلپر (_lib/serialize.ts، _lib/share-guard.ts) — فقط داخل src/app/api/**
- تصمیم‌های کلیدی: ساخت ShareLink با id از پیش‌تولیدشده (crypto.randomUUID) تا توکن HMAC یک‌باره با id واقعی امضا شود؛ fallback به createVision برای تصویر چون endpoint متنی بک‌اند multimodal را نمی‌پذیرد؛ کلیدهای اختیاری PATCH با شرط spread فقط در صورت ارسال؛ پاسخ‌های ساخت با کد 201
- برای توسعه‌دهنده فرانت: همه تاریخ‌ها ISO string؛ roomSpec/sceneState/preset.data به‌صورت آبجکت/آرایه پارس‌شده برمی‌گردند؛ خطاها با کلید error (و ok:false در resolve) فارسی هستند؛ status های مورد انتظار: 400/403/404/500/502

---
Task ID: 1
Agent: orchestrator (main)
Task: لایه پایه — اسکیمای دیتابیس، تایپ‌های صحنه، توکن امضاشده

Work Log:
- بازنویسی prisma/schema.prisma با مدل‌های Project، ShareLink، Guest، Preset (حذف User/Post پیش‌فرض) و اجرای bun run db:push
- ساخت src/lib/scene-types.ts: تایپ‌های RoomSpec/SceneObject/SceneState + کاتالوگ پارامتریک CATALOG (۱۰ آیتم) + پالت رنگ مهمان + guestColorFor
- ساخت src/lib/share-token.ts: امضا/راستی‌آزمایی HMAC-SHA256 با base64url (payload.lid/pid/role/exp)
- ساخت src/lib/sample-room.ts: آشپزخانه نمونه با ۱۱ آبجکت برای شروع بدون عکس

Stage Summary:
- دیتابیس SQLite همگام شد؛ پایه تایپ‌های مشترک بین API و فرانت‌اند آماده است

---
Task ID: 2-b
Agent: orchestrator (main)
Task: فرانت‌اند کامل — روتینگ هش، موتور سه‌بعدی R3F، ویرایشگر، نمای مشتری، خانه

Work Log:
- layout.tsx: RTL فارسی + فونت Vazirmatn (CDN) + عنوان پلتفرم؛ globals.css: تم کهربایی/چوبی (بدون آبی)، اسکرول‌بار سفارشی
- page.tsx: روتر هش (home | editor/:id | s/:token) با dynamic import و ssr:false + QueryClientProvider
- src/lib/api.ts: لایه تایپ‌دار fetch برای همه endpointها؛ image-utils.ts (resize کلاینت تا 1280px)؛ export-glb.ts (GLTFExporter دودویی)
- src/store/editor-store.ts: Zustand با تاریخچه undo/redo (snapshot)، انتخاب چندگانه، addObject/updateParams/toggleOpen/toggleLight + findFreeSpot برای جای خالی
- three/room.tsx: اتاق از RoomSpec — کف، باکس BackSide (دیوارها فقط از داخل دیده می‌شوند)، قرنیز، پنجره با قاب/شیشه emissive و درب‌دهانه، اعمال offsetX روی دیوار (fix)
- three/cabinet.tsx: کابینت پارامتریک — بدنه، داخل تیره، رویه، درب لولادار با THREE.MathUtils.damp (Mesh States)، کشوی سرسره‌ای، دستگیره bar/knob، Edges برای انتخاب؛ fix لولا (hingeX=w/2)، آفست yCenter و علامت چرخش
- three/decor.tsx: چراغ آویز/ایستاده با pointLight و emissive، گیاه، فرش
- three/editor-scene.tsx: Canvas + OrbitControls + TransformControls (snap 5cm) + DropReceiver (ری‌کست صفحه→کف برای Drag&Drop) + Grid toggle + onPointerMissed برای لغو انتخاب
- three/viewer-scene.tsx: نمای مشتری بدون گیزموت مگر Modifier
- editor/: editor-view (تاپ‌بار واگرد/ازنو/GLB/انتشار + ذخیره خودکار 1.4s با thumbnail بوم + کلیدهای Ctrl+Z/Y)، library-panel (draggable)، properties-panel (اسلایدر ابعاد، رنگ‌ها، درب/کشو/دستگیره، شدت نور)، presets-panel (ذخیره انتخاب چندتایی با آفست نسبی)، share-dialog (تب لینک‌ها/بازدیدکنندگان، ساخت لینک با نقش/انقضا، کپی، سوییچ فعال، تغییر نقش مهمان با polling 5s)
- home/home-view: هیرو با تصویر تولید AI، ویزارد آپلود با انیمیشن مراحل AI، پروژه نمونه، گرید کارت‌ها با thumbnail، حذف با AlertDialog، فوتر چسبان
- viewer/viewer-view: resolve توکن → GuestGate (نام بدون ثبت‌نام) → sessionStorage → polling نقش هر 4s → تعامل درب/چراغ + چیپ چراغ‌ها؛ fix DialogTitle خارج از Dialog
- تصویر hero با z-ai image CLI تولید شد (public/hero-kitchen.png)

Stage Summary:
- هر ۳ نما (خانه/ویرایشگر/مشتری) با تست مرورگری Agent Browser تأیید شدند
- fixهای حین تست: offsetX بازشوها، aria-label سوییچ‌ها، z-fight پنل داخلی، هندسه کامل درب (hingeX/yCenter/علامت چرخش)، DialogTitle بدون کانتکست
- تایید شده: آپلود→AI→اتاق، افزودن کابینت+پنل ابعاد، باز شدن درب با انیمیشن، خاموش/روشن چراغ، ساخت لینک، ثبت مهمان با رنگ، تغییر نقش زنده (گیزموت ظاهر شد)، خروجی GLB، موبایل ریسپانسیو، فوتر چسبان

---
Task ID: 3
Agent: orchestrator (main)
Task: یکپارچه‌سازی و تست مرورگری

Work Log:
- bunx tsc --noEmit → بدون خطا در src؛ bunx eslint src --no-warn-ignored → بدون خطا
- dev.log بررسی شد — همه درخواست‌ها 200، بدون خطای runtime
- تست E2E با agent-browser در ۱۲ مرحله (جزئیات در بخش 2-b)

Stage Summary:
- پلتفرم کامل و قابل استفاده است؛ دو پروژه نمونه در دیتابیس باقی مانده (آشپزخانه نمونه + پروژه بازسازی‌شده AI) برای دموی فوری
