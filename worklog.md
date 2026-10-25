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

---
Task ID: 4
Agent: orchestrator (main)
Task: پایه نسخه ۲ — اسکما (پوشه/عمومی)، تایپ‌های لوازم خانگی، api.ts، استور، ابزار ویدیو

Work Log:
- prisma/schema.prisma: افزودن مدل Folder + فیلدهای Project.isPublic و Project.folderId (onDelete: SetNull) و اجرای bun run db:push
- src/lib/scene-types.ts: افزودن ObjectType های fridge/stove/hood، RECONSTRUCTABLE_TYPES/DOOR_TYPES/LIGHT_TYPES + isDoorType/isLightType، دسته CatalogCategory جدید 'appliance' + CATALOG_CATEGORY_LABEL، سه آیتم کاتالوگ یخچال/اجاق/هود، هلپر placeAtWall برای جانمایی روی دیوار، تایپ ObjectPatch برای ویرایش متنی
- src/lib/api.ts: ProjectDTO += isPublic/folderId/folderName، FolderDTO، GeneratedItem، ReconstructResult += objects، api.reconstruct теперь images[]، api.generateObject (text-to-3D)، api.aiEditObject، CRUD پوشه‌ها، patchProject += isPublic/folderId
- src/store/editor-store.ts: defaultY برای hood، toggleLight با isLightType (شامل stove/hood)، findFreeSpot برای لوازم، اکشن جدید addGenerated برای درج خروجی text-to-3D
- src/lib/image-utils.ts: افزودن videoToFrames (استخراج ۳ فریم از ویدیو سمت کلاینت)
- bunx tsc: خطاهای باقی‌مانده فقط در library-panel/home-view (در Task 6 بازنویسی می‌شوند) و examples/skills (پیش‌موجود، خارج از src)

Stage Summary:
- پایه داده و تایپ‌های نسخه ۲ آماده است؛ قراردادها: POST /api/ai/cabinet {text}→{item:{type,label,params}}، POST /api/ai/edit {object,text}→{patch:ObjectPatch}، POST /api/reconstruct {images[]}→{roomType,roomSpec,objects[],description}، GET /api/projects?folderId=…|none، CRUD /api/folders

---
Task ID: 5-b
Agent: general-purpose (3D)
Task: مدل‌های سه‌بعدی یخچال/اجاق/هود + اتصال به dispatcher

Work Log:
- خواندن worklog.md و فایل‌های مرجع: scene-types.ts (defaults جدید لوازم)، cabinet.tsx (الگوی MeshCtx/RefsMap/HingedDoor/Edges/damp)، decor.tsx (الگوی نور) و هر دو dispatcher (editor-scene / viewer-scene)
- ساخت src/components/three/appliance.tsx با 'use client' و سه کامپوننت FridgeMesh/StoveMesh/HoodMesh؛ هلپرهای محلی hoverCursor/unhover (کپی از decor) و HingedDoor محلی (اقتباس از cabinet با THREE.MathUtils.damp، لولا side×hingeX، آفست درب -side×w/2) که children را در مختصات مرکز درب رندر می‌کند (برای پنجره/دستگیره)
- یخچال: بدنه استیل roughness 0.35/metalness 0.55 + Edges نارنجی هنگام انتخاب، درب فریزر ثابت بالا (~۲۶٪) با دستگیره افقی، درز تیره #2a2c30 بین درب‌ها، درب اصلی لولادار (لولا راست side=+1، OPEN_ANGLE=1.75) با دستگیره عمودی لبه بازشو metalness 0.7؛ همه بخش‌ها refsMap.set در ref callback گروه
- اجاق: بدنه، صفحه تیره براق (countertopColor، metalness 0.6)، ۴ شعله‌پخش‌کن شبکه ۲×۲ (استوانه r=0.07)، هنگام obj.on چهار حلقه torus (r=0.05, tube=0.008, emissive #ff5a1f, intensity 2.5) + pointLight (0.6/dist 1.2/#ff8c42) بالای صفحه، پنل پشتی (+0.06 بالای صفحه)، درب فر لولادار (~۶۰٪ ارتفاع، لولا چپ) با پنجره تیره #14161a (۶۰٪ سطح درب) و دستگیره افقی، نوار کنترل با ۳ ولوم
- هود: کلاهک w×h×d دقیقاً روی نقطه نصب (مرکز y+h/2 چون position.y=mountY)، دودکش w*0.45×0.5×d*0.45 بالای کلاهک، نوار نور emissive زیر کلاهک (w*0.7×0.015×0.06) که هنگام obj.on با #fff3d6/intensity 2 می‌درخشد + pointLight (params.intensity ?? 0.9، dist 2.2، #ffe9c8)
- اتصال dispatcherها: افزودن case 'fridge'/'stove'/'hood' به ObjectEntry در editor-scene.tsx و ObjectEntryV در viewer-scene.tsx + import از './appliance' (فقط dispatcher و importها تغییر کرد)
- تأیید: bunx tsc --noEmit → بدون خطا در components/three (خطاهای باقی‌مانده فقط library-panel/home-view — از Task 4، خارج از محور)؛ bunx eslint src/components/three --no-warn-ignored → بدون خطا

Stage Summary:
- فایل‌ها: appliance.tsx (جدید)، editor-scene.tsx و viewer-scene.tsx (فقط dispatcher + import)
- مدل تعامل: یخچال → کلیک درب اصلی = toggleOpen (فریزر ثابت است)؛ اجاق → کلیک درب فر = toggleOpen، کلیک شعله‌پخش‌کن‌ها/پنل پشتی = toggleLight (حلقه‌های شعله + نور)؛ هود → کلیک کلاهک/نوار نور = toggleLight
- مشترک: کلیک بدنه/گروه → onSelect (shift = افزودنی)، هاور → cursor pointer روی بخش‌های تعاملی، Edges نارنجی #f59e0b هنگام انتخاب، انیمیشن درب‌ها با damp(8) مطابق الگوی Mesh States کابینت

---
Task ID: 5-a
Agent: general-purpose (backend)
Task: APIهای نسخه ۲ — پوشه‌ها، بازسازی چندعکسی با تشخیص تجهیزات، text-to-3D، ویرایش متنی

Work Log:
- خواندن worklog و قراردادها (scene-types.ts با placeAtWall/ObjectPatch، serialize.ts، share-guard.ts، reconstruct v1، routes پروژه‌ها، schema.prisma)
- ساخت src/app/api/_lib/normalize.ts: هلپرهای مشترک نرمال‌سازی خروجی LLM — clamp/toFinite/toWall/toColor/toHandle/isRecord/extractJsonObject (حذف فنس markdown) + shadeColor (میکس رنگ با سفید/سیاه) + KIND_DEFAULT_H/D + KIND_LABELS + normalizeFullParams (خروجی کامل text-to-3D با clamp همه بازه‌ها و mountY فقط برای wall/hood) + normalizePartialParams (پچ جزئی سخت‌گیرانه؛ فقط کلیدهای معتبر)
- بازنویسی /api/reconstruct (v2): بدنه { images: 1..5 } + سازگاری legacy { image }؛ اعتبارسنجی هر تصویر (data URL تصویری یا base64 خام، ≤۷MB، رد کل درخواست)؛ مرحله ۱: تحلیل VLM ترتیبی هر تصویر با createVision (مسیر مستقیم چون /chat/completions متن multimodal را 400 می‌کند؛ ۲ تلاش برای هر تصویر)؛ پرامپت v2 علاوه بر اتاق/پنجره/درب‌دهانه، تشخیص تجهیزات (base/wall/tall/island/shelf/fridge/stove/hood) با wall/offsetX/ابعاد/رنگ و تقسیم ردیف کابینت زمینی به سگمنت‌های ۰.۶ تا ۱.۲ متر؛ مرحله ۲: ادغام نتایج جزئی با یک فراخوانی TEXT-ONLY (اجتماع + dedupe پنجره/درب و آیتم‌ها) با fallback به اولین تحلیل موفق؛ مرحله ۳: نرمال‌سازی و تبدیل آیتم‌ها به SceneObject (id = crypto.randomUUID().slice(0,8)، برچسب فارسی «(بازسازی‌شده)»، رنگ درب ۲۰٪ روشن‌تر با shadeColor، doors بر اساس عرض، fridge درب ۱، hood با mountY 1.62، placeAtWall با clamp آفست داخل دیوار |offset|+w/2 ≤ wallLength/2−۰.۰۵، y=mountY برای wall/hood و ۰ برای زمینی‌ها)؛ اگر همه تحلیل‌ها شکست بخورند → 502 فارسی
- ساخت /api/ai/cabinet (text-to-3D): بدنه {text 1..500} با zod؛ پرامپت انگلیسی با انواع مجاز هشت‌گانه، بازه‌های پارامتر، واژه‌های عددی فارسی و ۴ مثال فارسی-به-JSON؛ فراخوانی TEXT-ONLY با thinking disabled، ۲ تلاش، پارس تدافعی، نرمال‌سازی کامل با normalizeFullParams و fallback نوع/برچسب؛ پاسخ { item: { type, label, params } }؛ خطا 400/502 فارسی
- ساخت /api/ai/edit: بدنه { object (zod: id/type/label?/params/position/rotationY/open?/on?), text 1..300 }؛ پرامپت انگلیسی پچ نسبی با مثال‌های قرارداد (بالا بردن/رنگ/چرخش/درب/عرض) + قواعد مطلق‌بودن ابعاد و رنگ‌ها و ترکیب دستورات؛ نرمال‌سازی positionDelta (هر مؤلفه ±3)، rotationYDelta (±6.283)، params با normalizePartialParams (mountY بر اساس نوع آبجکت)، label ≤40، open/on بولین؛ {} مجاز است (no-op)؛ خطا 400/502 فارسی
- ساخت /api/folders: GET (orderBy createdAt asc با _count.projects → projectCount) و POST {name 1..60} → 201
- ساخت /api/folders/[id]: PATCH نام (404 «پوشه یافت نشد») و DELETE با بررسی موجودیت → { ok:true } (جدایی پروژه‌ها با SetNull دیتابیس)
- به‌روزرسانی _lib/serialize.ts: SerializedProject += isPublic/folderId/folderName (folder?.name) — سازگار با استفاده‌های قبلی
- به‌روزرسانی /api/projects: GET شامل folder {name} و فیلتر ?folderId=<id> | ?folderId=none؛ POST با folderId اختیاری (غیرتهی → بررسی موجودیت → 400 «پوشه یافت نشد»)
- به‌روزرسانی /api/projects/[id]: GET/PATCH با projectCount شامل folder؛ PATCH += isPublic و folderId (null → جداسازی، غیرتهی → بررسی موجودیت)
- رفع مشکل زیرساختی: سرور dev قدیمی کلاینت Prisma تولیدشده قبل از مدل Folder را در حافظه داشت (500 با «Unknown field folder») — سرور با kill و اجرای مجدد detached (setsid) ری‌استارت شد؛ بدون تغییر اسکیما/دیتابیس
- تست curl کامل: چرخه پوشه (201 → لیست با projectCount → rename → حذف → 404 تکرار)، پروژه در پوشه (folderId/folderName ست شد)، ?folderId و ?folderId=none، PATCH isPublic، folderId ناموجود 400، SetNull بعد از حذف پوشه تأیید شد
- تست AI: cabinet «کابینت زمینی سفید ۸۰ سانتی با دو درب شیشه‌ای» → {type:'base', w:0.8, سفید/درب شیشه‌ای}؛ cabinet هود → type:'hood' با mountY 1.62؛ edit «۲۰ سانت بالاتر ببر» → positionDelta [0,0.2,0]؛ رنگ خاکستری/۹۰ درجه/باز کردن درب/عرض ۱۲۰ هم تست شد؛ reconstruct با 1×1 PNG (تک‌عکسی، legacy و دوعکسی با merge) → 200 با roomSpec و objects (خالی برای تصویر خالی)
- پاکسازی: هر دو پروژه تست و پوشه تست حذف شدند؛ دیتابیس فقط ۳ پروژه دموی اولیه را دارد
- bunx eslint src/app/api --no-warn-ignored → بدون خطا؛ bunx tsc --noEmit → بدون خطا در src/app/api (باقی‌مانده فقط خطاهای پیش‌موجود library-panel/home-view مربوط به Task 6)

Stage Summary:
- Endpoints جدید: POST /api/ai/cabinet {text}→{item:{type,label,params}} — POST /api/ai/edit {object,text}→{patch:ObjectPatch} — GET/POST /api/folders — PATCH/DELETE /api/folders/[id]
- Endpoints ارتقا‌یافته: POST /api/reconstruct {images[1..5]|image}→{roomType,roomSpec,objects[],description} (تحلیل چندعکسی + ادغام + آبجکت‌های تجهیزات) — GET/POST /api/projects و GET/PATCH /api/projects/[id] با isPublic/folderId/folderName و فیلتر ?folderId=…|none
- فایل‌ها: ۴ روت جدید + _lib/normalize.ts + بازنویسی reconstruct + به‌روزرسانی serialize.ts و دو روت پروژه — همه داخل src/app/api/**
- تصمیم‌های کلیدی: VLM مستقیماً createVision (حذف تلاش بی‌ثمر /chat/completions برای تصویر)؛ ادغام چندعکسی با LLM متنی و fallback امن به اولین تحلیل؛ آفست آیتم‌ها به اندازه دیوار clamp می‌شود تا هرگز بیرون نزنند؛ normalizePartialParams کلیدهای نامعتبر را کامل حذف می‌کند (پچ امن)؛ خطاها همه فارسی با status 400/404/502/500
- نکته برای فرانت: خروجی reconstruct حالا objects[] دارد (SceneObject کامل با id/label/params/position/rotationY) آماده افزودن مستقیم به صحنه؛ api.ts موجود بدون تغییر سازگار است
---

---
Task ID: 7
Agent: orchestrator (main)
Task: یکپارچه‌سازی نسخه ۲ و تست مرورگری E2E

Work Log:
- bunx tsc --noEmit (بدون examples/skills) → تمیز؛ bunx eslint src → تمیز؛ dev.log → بدون خطا
- رفع lint: setState در effect دیالوگ پوشه → رندر مشروط + state از props؛ رفع خطای DOM: دکمه تودرتو در کارت آپلود → div با role="button" و کیبورد-اکسسIBLE
- تست E2E با agent-browser (۱۲ صحنه):
  ۱. خانه: ساخت پوشه «خانه آزمایشی» → چیپ با شمارنده (۱) و انتخاب خودکار
  ۲. پروژه خالی داخل پوشه → ریدایرکت به ویرایشگر
  ۳. text-to-3D: «کابینت زمینی سفید با دو درب شیشه‌ای، عرض ۸۰ سانت» → کابینت سفید 0.8m روی دیوار پشت
  ۴. ویرایش متنی: «۲۰ سانت بالاتر ببر و رنگ درب‌ها را مشکی کن» → y+0.2 و درب مشکی (بدنه سفید ماند)
  ۵. افزودن یخچال/اجاق/هود از کتابخانه؛ شعله‌های اجاق روشن پیش‌فرض؛ هود با Edges انتخاب
  ۶. پنل مشخصات لوازم: ارتفاع نصب هود، سوییچ چراغ، شدت نور
  ۷. خاموش کردن چراغ هود از پنل
  ۸. خروجی GLB → توست «دانلود شد»
  ۹. Ctrl+Z ×۳ → حذف آخرین افزودنی‌ها
  ۱۰. خانه: منوی کارت → «عمومی کردن (نمونه‌کار)» → بخش «نمونه‌کارهای عمومی» ظاهر شد؛ بج عمومی سبز
  ۱۱. موبایل ۳۹۰px → چیدمان ریسپانسیو
  ۱۲. اشتراک: افزودن یخچال → ذخیره خودکار → ساخت لینک → بازکردن در تب جدید → ثبت نام مهمان «مشتری آزمایشی» → اتاق با یخچال رندر شد → کلیک روی درب یخچال → باز شد (Mesh States)
  ۱۳. ویدیو: آپلود test.mp4 با ffmpeg → ۳ فریم استخراج و به آپلود اضافه شد
- خروجی نهایی: هر ۶ خروجی خواسته‌شده نسخه ۲ تأیید شد

Stage Summary:
- پلتفرم نسخه ۲ کامل است: بازسازی چندعکسی/ویدیویی با تشخیص تجهیزات، تولید مدل با متن، ویرایش متنی آبجکت، پوشه‌بندی، انتشار عمومی/خصوصی + نمونه‌کار، و همه قابلیت‌های نسخه ۱ (Undo/Redo، انتشار، GLB، لینک مهمان) دست‌نخورده

---
Task ID: 2-b
Agent: general-purpose (3D)
Task: مبلمان خانه (TV/مبل/تخت/میز/صندلی) + لوازم جدید (لباسشویی/ظرفشویی/مایکروویو) + فیکس شیشه شفاف + نور از سمت پنجره

Work Log:
- خواندن worklog و فایل‌های مرجع: cabinet.tsx (MeshCtx/RefsMap/HingedDoor/useCursor/Edges)، appliance.tsx (الگوی FridgeMesh/HingedDoor محلی)، decor.tsx، room.tsx، هر دو dispatcher، library-panel، editor-store و scene-types
- scene-types.ts: افزودن ۸ آیتم کاتالوگ (tv/sofa/bed/table/chair در دسته furniture و washer/dishwasher/microwave در appliance) با defaults قراردادی — بدون دست‌زدن به union ها (از قبل توسط orchestrator گسترش یافته)
- ساخت src/components/three/furniture.tsx با ۵ کامپوننت MeshCtx-محور:
  • TvMesh: پنل نازک در ارتفاع mountY (مرکز محلی y=0)، براکت دیواری، صفحه با emissive ‎#9fd8ff‎ هنگام obj.on + pointLight ‎#bfe3ff‎، کلیک صفحه/قاب = toggleLight (tv در LIGHT_TYPES)، انتخاب در جای دیگر
  • SofaMesh: پایه‌های چوبی + بدنه + ۲-۳ کوسن نشیمن (بسته به عرض) + پشتی + ۲ دسته + ۲ کوسن تزئینی چرخیده با shadeColor
  • BedMesh: قاب روی ۴ پایه + تاج + تشک روشن ‎#e8e2d8‎ + لحاف (پوشش ۵۵٪ پایین با ریزش جانبی) + ۲ بالش سفید؛ ارتفاع قاب از پارامتر h
  • TableMesh: رویه + ۴ پایه inset 0.08؛ ChairMesh: نشیمن 0.42 + پشتی + ۴ پایه
  • همه: refsMap.set در ref callback، castShadow، Edges نارنجی هنگام انتخاب
- appliance.tsx: سه کامپوننت جدید:
  • WasherMesh: پنل کنترل + ولوم/دکمه/نمایشگر، دیگ داخلی ثابت پشت درب، درب گرد لولادار (لولا چپ، damp به ‎-1.1‎) شامل حلقه torus استیل + شیشه استوانه‌ای meshPhysicalMaterial ‎#3a4148‎ شفاف opacity 0.85 براق (هرگز سیاه خالص)؛ کلیک حلقه/شیشه = toggleOpen
  • DishwasherMesh: درب تمام‌صفحه با HingedDoor محلی (side=-1) + دستگیره افقی + نوار کنترل باریک بالا
  • MicrowaveMesh: بدنه روی mountY، درب چپ لولادار با قاب تیره + شیشه پنجره ‎#9fb4bd‎ شفاف opacity 0.4 (هرگز سیاه) + دستگیره عمودی متحرک با درب، ستون کنترل راست (نمایشگر سبز emissive + ۲ ولوم + ۳ دکمه، کلیک = انتخاب)
- cabinet.tsx (فیکس انتقادی شیشه): HingedDoor پراپ glass? گرفت — حالت شیشه‌ای: پن pane با meshPhysicalMaterial ‎#cdeaf2‎ transparent opacity 0.26 roughness 0.06 metalness 0.05 DoubleSide + قاب باریک ۴ تکه (ضخامت 0.03/عمق 0.028) با رنگ درب؛ دستگیره و انیمیشن دست‌نخورده؛ CabinetMesh گلاس={!!p.glass} به هر ۳ استفاده پاس داد
- room.tsx: محاسبه پنجره اصلی (بزرگ‌ترین مساحت، تساوی = اولین) و directionalLight از بیرون همان دیوار (back→‎[0,h*0.85,-d*0.75]‎ و مشابه برای front/left/right) با intensity 1.15 رنگ ‎#fff1da‎؛ بدون پنجره → ‎[2,h*0.9,2.5]‎ با 0.85 ‎#fffaf2‎ — هدف پیش‌فرض مرکز اتاق
- editor-store.ts: defaultY برای tv (min(mountY,roomH-0.6)) و microwave (min(mountY,roomH-0.3))؛ findFreeSpot با WALL_ROW_TYPES شامل tv/sofa/bed/washer/dishwasher/microwave + backZ نزدیک‌تر فقط برای tv (0.09) تا به دیوار بچسبد؛ table/chair در مارپیچ مرکزی با دکور
- library-panel.tsx: آیکون‌های ۸ نوع جدید (Tv/Sofa/BedDouble/Table/Armchair/WashingMachine/UtensilsCrossed/Microwave — Dishwasher آیکون نداشت → UtensilsCrossed) + چیپ دسته 'furniture' (برچسب از CATALOG_CATEGORY_LABEL)؛ خطای تایپ Record<ObjectType,…> همین‌جا رفع شد
- dispatcherها: case های ۸ نوع جدید در ObjectEntry (editor-scene) و ObjectEntryV (viewer-scene) — فلگ‌ها همان الگوی قبلی (canInteract همیشه true؛ toggleLight از طریق isLightType در store و toggleOpen مستقیم)
- تأیید: bunx tsc --noEmit → صفر خطا در فایل‌های من (خطای باقی‌مانده reconstruct/route.ts متعلق به کار در حال انجام Agent 2-a در src/app/api است — خارج از محدوده من)؛ bunx eslint روی src/components/three + editor-store + scene-types + library-panel → بدون خطا

Stage Summary:
- فایل‌ها: furniture.tsx (جدید، ۵ کامپوننت) — appliance.tsx (+۳ کامپوننت) — cabinet.tsx (فیکس شیشه) — room.tsx (نور پنجره) — editor-scene/viewer-scene (dispatch) — library-panel (آیکون+دسته) — editor-store (defaultY/findFreeSpot) — scene-types (۸ آیتم کاتالوگ)
- تعامل‌ها: TV → کلیک صفحه/قاب = روشن/خاموش صفحه+نور؛ لباسشویی/ظرفشویی/مایکروویو → کلیک درب = باز/بسته با انیمیشن damp؛ بقیه → کلیک = انتخاب (shift = افزودنی)
- فیکس شیشه: درب شیشه‌ای کابینت حالا شفاف با تینت آبی-سبز روشن (opacity 0.26) و قاب چوبی باریک — هرگز سیاه/تیره نیست؛ شیشه‌های لباسشویی (تیره براق ‎#3a4148‎) و مایکروویو (‎#9fb4bd‎ روشن) هم شفاف‌اند
- نور پنجره: خورشید از دیوارِ پنجره اصلی می‌تابد (intensity 1.15 گرم) — جهت نور با محل پنجره هماهنگ است
- نکته برای ادامه: properties-panel (خارج از محدوده من) برای انواع جدید فقط کنترل‌های عمومی دارد؛ افزودن اسلایدر mountY برای tv/microwave و سوییچ چراغ tv به orchestration بعدی

---
Task ID: 2-a
Agent: general-purpose (backend)
Task: بک‌اند v3 — احراز هویت مدیر، گاردها، CRM و جست‌وجو، reconstruct استریمی موازی همه‌چیزشناس، share/save مهمان، آمار ادمین

Work Log:
- src/lib/auth.ts (جدید): رمز مدیر (sha256) و کلید نشست (۴۸ hex تصادفی) در جدول Setting با seed یک‌باره idempotent (ensureAdminSettings) — رمز پیش‌فرض admin1234؛ توکن نشست `${expMs}.${hmacSHA256(expMs, session_key)}`؛ verifySessionToken با timingSafeEqual + چک انقضا؛ getOwner/requireOwner (async) با کوکی c3d_admin (httpOnly/sameSite lax/path /maxAge 30d)؛ verifyPassword/setPassword (حداقل ۶ کاراکتر)؛ setOwnerCookie/clearOwnerCookie
- ۴ روت auth: POST /api/auth/login (401 «رمز مدیر اشتباه است»)، POST /api/auth/logout، GET /api/auth/session → {authed}، POST /api/auth/password {currentPassword,newPassword} (مالک + رمز فعلی صحیح)
- گارد ۴۰۱ «برای این عملیات باید به‌عنوان مدیر وارد شوید» روی همه متدهای projects، folders، presets، share (GET/POST/PATCH)، projects/[id]/guests GET، guests/[id] PATCH، reconstruct، ai/cabinet، ai/edit؛ GET /api/guests/[id] عمومی ماند ولی پاسخ محدود به {id,name,color,role} (حذف shareLinkId)؛ عمومی: auth/*، share/resolve، guests POST، share/save
- CRM: POST/PATCH پروژه با clientName(≤80)/clientPhone(≤30)/address(≤300) و visitAt/installAt/dueAt (رشته ISO یا '' → null با toDate امن در serialize.ts)؛ GET /api/projects?q= جست‌وجوی contains در name/clientName/clientPhone/address + الگوی تاریخ YYYY-MM-DD یا YYYY/MM/DD → OR روی بازدید/اجرا/اتمام همان روز؛ ترکیب AND با folderId
- serialize.ts: SerializedProject += شش فیلد CRM (تاریخ‌ها ISO|null) + هلپر toDate
- POST /api/share/save (جدید): {token,guestId,sceneState:{objects[]≤400}} → توکن معتبر + مهمان متعلق به همان لینک («مهمان شناسایی نشد») + نقش modifier («این لینک دسترسی ویرایش ندارد») → آپدیت project.sceneState + guest.lastSeenAt در یک تراکنش → {ok,updatedAt}
- GET /api/admin/stats (جدید، فقط مدیر): counts (projects/folders/guests/shareLinks/activeShareLinks/publicProjects)، roomTypes (groupBy)، recentGuests (۱۲ آخر با projectName)، upcoming (پروژه‌هایی که هر یک از سه تاریخشان در بازه دیروز تا ۴۵ روز بعد است، مرتب بر نزدیک‌ترین تاریخ، حداکثر ۲۰)
- بازنویسی /api/reconstruct v3: حداکثر ۸ عکس (+ سازگاری legacy {image} و floorPlan اختیاری با اعتبارسنجی مشابه)؛ دوتابعی — Accept: application/json → پاسخ JSON مثل v2، در غیر این صورت استریم NDJSON (content-type: application/x-ndjson, cache-control: no-cache, no-transform) با رویدادهای {type:'progress',stage:floorplan|analyze|merge,index?,total?,message} و پایانی {type:'result',...} یا {type:'error',error}؛ گارد مالک قبل از شروع استریم؛ تحلیل تصاویر PARALLEL با Promise.allSettled (نقشه هم در همان دسته) و یک رویداد progress بعد از اتمام هر عکس با پیام فارسی «تحلیل عکس ۲ از ۴...»؛ FLOORPLAN_PROMPT اختصاصی (اتاق‌ها/ابعاد از مقیاس/پنجره‌ها/جهت) که خطایش هرگز کل درخواست نمی‌شکند؛ MERGE_PROMPT با ground-truth بودن نقشه؛ RECONSTRUCT_PROMPT v3: انواع base/wall/tall/island/shelf/fridge/stove/hood/tv/sofa/bed/table/chair/washer/dishwasher/microwave + دستور خانه یکپارچه (بزرگ‌ترین ابعاد تا ۱۵ متر، همه اقلام)، تأکید پنجره/نور (دیوار صحیح نسبت به دوربین)، فیلد glassDoors با قاعده «شیشه هرگز تیره/سیاه»؛ items≤40، windows≤8؛ normalizeAnalysis: width/depth clamp(2,15)، height clamp(2.2,4.2)، offsetX ±7، glassDoors بولی؛ buildObject: tv (d=0.06، mountY 1.4، on:false)، sofa/bed/table/chair/washer/dishwasher/microwave (mountY 0.9) طبق قرارداد + glass فقط برای base/wall/tall/island/shelf/dishwasher با روشن‌سازی خودکار رنگ تیره (luminance<0.35 → shadeColor 0.65)
- normalize.ts: FURNITURE_KINDS/KIND_LABELS/KIND_DEFAULT_H/D += ۸ نوع جدید (tv/sofa/bed/table/chair/washer/dishwasher/microwave)؛ بازه‌های خاص نوع (tv h 0.3..1.2 و d 0.04..0.3، bed d تا 2.3، hood h 0.1..0.5) در normalizeFullParams و normalizePartialParams؛ mountY برای wall/hood/tv/microwave؛ عبور glass در normalizePartialParams و خروجی glass:true فقط وقتی صریح است در normalizeFullParams
- /api/ai/cabinet: پرامپت با انواع جدید + واژه‌های فارسی (تلویزیون/مبل/کاناپه/تخت/میز/صندلی/لباسشویی/ظرفشویی/مایکروویو) + قاعده glass (فقط درخواست صریح درب شیشه‌ای → doorColor روشن مثل #cfd8dc) + مثال مبل؛ /api/ai/edit: هینت glass در پرامپت (پارامترها از قبل از normalize.ts عبور می‌کنند)
- src/lib/api.ts: ProjectDTO/ProjectCrmFields + createProject/patchProject CRM؛ listProjects(folderId?, q?)؛ login/logout/session/changePassword؛ adminStats با AdminStatsDTO؛ saveAsGuest؛ reconstructStream (fetch با Accept: application/x-ndjson، خواندن getReader+TextDecoder، پارس خط‌به‌خط، progress→callback، result→resolve، error→throw، خطای HTTP قبل از استریم JSON است)؛ reconstruct قدیمی به‌صورت fallback JSON حفظ شد
- رفع زیرساختی: سرور dev قدیمی کلاینت Prisma بدون مدل Setting را در حافظه داشت (500 روی db.setting) — کلاینت روی دیسک موجود بود؛ سرور با kill و اجرای مجدد ری‌استارت شد (نکته: سرور از sandbox این ایجنت بین کال‌ها بقا ندارد — باید orchestartor/کاربر خودش bun run dev را اجرا کند)
- تست curl کامل (سرور موقت داخل یک کال): ورود/خروج/نشست، تعویض رمز و بازگردانی admin1234، گارد ۴۰۱ روی ۹ endpoint، ساخت پروژه CRM، جست‌وجوی متنی/تاریخی، پچ تاریخ‌ها (='' → null)، لینک viewer/modifier + دو مهمان، share/save با توکن نامعتبر/مهمان بیگانه/لینک viewer (هر سه ۴۰۳ با پیام فارسی درست) و موفق با modifier + ماندگاری sceneState، admin/stats کامل، GET مهمان محدود (بدون shareLinkId)، share/resolve عمومی ۲۰۰، reconstruct استریم با ۱×۱ PNG (رویداد progress + result نهایی)؛ همه داده‌های تست حذف شدند (پروژه → cascade لینک/مهمان)
- bunx tsc --noEmit → بدون خطا در src (فقط examples/skills پیش‌موجود)؛ bunx eslint src/app/api src/lib/api.ts src/lib/auth.ts --no-warn-ignored → بدون خطا

Stage Summary:
- قرارداد جدید: همه APIهای مدیریت اکنون ۴۰۱ می‌دهند بدون کوکی c3d_admin — فرانت باید gate ورود با api.session() بگذارد؛ رمز پیش‌فرض مدیر admin1234 (تغییرش با api.changePassword در پنل ادمین)
- Endpoints جدید: POST /api/auth/login {password}→{ok}|401، POST /api/auth/logout→{ok}، GET /api/auth/session→{authed}، POST /api/auth/password {currentPassword,newPassword}→{ok}، GET /api/admin/stats→AdminStatsDTO، POST /api/share/save {token,guestId,sceneState}→{ok,updatedAt}|403
- GET /api/projects?q=... (متن یا تاریخ YYYY-MM-DD/YYYY/MM/DD)؛ ProjectDTO و createProject/patchProject شش فیلد CRM دارند (clientName/clientPhone/address رشته، visitAt/installAt/dueAt ISO یا '' برای پاک‌کردن)
- GET /api/guests/[id] پاسخش فقط {guest:{id,name,color,role}} است (shareLinkId حذف شد)
- POST /api/reconstruct: پیش‌فرض استریم NDJSON است (رویداد progress با stage floorplan/analyze/merge + result نهایی)؛ برای پاسخ JSON قدیمی هدر Accept: application/json بفرستید؛ حداکثر ۸ عکس؛ فیلد اختیاری floorPlan (dataURL/base64) به‌عنوان ground truth ابعاد؛ خروجی watermarked با glass برای درب‌های شیشه‌ای و انواع مبلمان/لوازم خانه (tv/sofa/bed/table/chair/washer/dishwasher/microwave) که همگی در scene-types از قبل موجودند
- api.ts: reconstructStream(images, floorPlan, onProgress) برای فرانت (پیشرفت زنده فارسی) — reconstruct() قدیمی سر جای خودش است
---
Task ID: 3
Agent: general-purpose (frontend)
Task: گیت ورود مدیر، پنل مدیریت، CRM و جست‌وجو، بازسازی استریمی با پلان اختیاری، MovePad و میانبرهای کیبورد، ذخیره خودکار مهمان ویرایشگر

Work Log:
- src/lib/format.ts (جدید): formatFaDate/formatFaDateTime با Intl fa-IR («—» برای خالی)، relativeFa فارسی (چند لحظه/دقیقه/ساعت/روز پیش)، localInputToIso و isoToLocalInput برای ورودی datetime-local — تست دودی با bun موفق
- src/components/editor/move-pad.tsx (جدید): پد شناور جابه‌جایی (bottom-16، وسط، بالای نوار راهنما) — ردیف چرخش ±۴۵°، چهار جهت حسی (جلو=-z/عقب=+z/چپ=-x/راست=+x) + ستون ارتفاع (بالا/پایین)، ردیف تکثیر/حذف اختیاری، لیبل فارسی ریز و aria-label، دکمه‌های ۴۴px با HoldButton (نگه‌داشتن → فوری + setInterval ۱۳۰ms با cbRef و پاک‌سازی روی pointerup/leave/cancel)، خط راهنمای کیبورد
- home-view.tsx (بازنویسی کامل ~۹۴۰ خط → ساختار تب‌دار): گیت ورود مدیر — useQuery ['session'] با enabled gates؛ هنگام لود اسپینر، !authed → <OwnerLogin/> تمام‌صفحه با early return (داشبورد هرگز پشت آن رندر نمی‌شود)؛ Enter سابمیت، توست خطای ۴۰۱ با پیام سرور «رمز مدیر اشتباه است»، موفقیت → invalidate ['session']؛ دکمه «خروج» در هدر (api.logout + qc.clear + invalidate session)
- home-view تب‌ها: Tabs rtl «پروژه‌ها» (پیش‌فرض) | «مدیریت» (ShieldCheck) — محتوای قبلی (هیرو/پوشه‌ها/آپلود/کارت‌ها/نمونه‌کار عمومی) داخل TabsContent projects و <AdminPanel/> داخل تب مدیریت؛ فوتر بیرون تب‌ها
- AdminPanel (همان فایل): useQuery api.adminStats با staleTime 15s؛ ۵ کارت آمار (پروژه‌ها/پوشه‌ها/مهمان‌ها/لینک‌های فعال/نمونه‌کار عمومی با Folder/Boxes/Users/Send/Globe)؛ «زمان‌بندی پیش‌رو» با ردیف‌های نام+مشتری+تلفن (dir=ltr) و سه بج رنگی بازدید(کهربایی)/اجرا(سبز)/اتمام(خاکستری) با formatFaDate و حالت خالی؛ «مهمان‌های اخیر» با دات رنگ، نام، پروژه، بج نقش نمایشگر/ویرایشگر و relativeFa(lastSeenAt)؛ کارت «تغییر رمز مدیر» با سه Input پسورد + اعتبارسنجی (≥۶ کاراکتر، تطابق تکرار) و توست «رمز تغییر کرد»؛ چیپ‌های انواع فضا با لیبل فارسی (آشپزخانه/اتاق خواب/نشیمن/ناهارخوری/سرویس/اتاق کار/سایر) و شمارنده
- جست‌وجوی پروژه‌ها: Input با آیکون Search و placeholder «جستجو: نام مشتری، شماره، آدرس یا تاریخ...» + دکمه پاک‌کردن؛ debounce ۳۵۰ms → state q؛ listProjects(folderArg, q) سمت سرور (folderArg: all=undefined/none=null/folder=id — فیلتر پوشه و q با هم AND می‌شوند)؛ queryKey ['projects', folderKey, q]؛ نمایش شمارنده نتیجه و حالت خالی مخصوص جست‌وجو (راهنمای الگوی تاریخ YYYY-MM-DD)
- CRM روی کارت‌ها: بج‌های نام مشتری (User)، تلفن (Phone، dir=ltr، mono)، آدرس (MapPin، truncate) + ردیف سه مینی‌بج زمان‌بندی فقط وقتی ست شده‌اند (text-xs، wrap)؛ آیتم منوی کارت «اطلاعات مشتری و زمان‌بندی…» (Contact) → CrmDialog با ۶ فیلد prefilled → patchProject (رشته‌ها '' برای پاک‌کردن، تاریخ‌ها ISO یا null) → invalidate ['projects'] و توست موفقیت
- CrmDialog مشترک (همان فایل): فیلدهای clientName/clientPhone/address + سه datetime-local (زمان بازدید/اجرا و پیاده‌سازی/اتمام) با isoToLocalInput/localInputToIso؛ دکمه «پروژه جدید» نوار پوشه‌ها حالا همین دیالوگ را با فیلد نام باز می‌کند (با withName) و createProject با roomSpec پیش‌فرض و folderId جاری
- UploadCard: سقف عکس ۵→۸ (addImages/addVideo هر دو slice(0,8) و دکمه‌ها تا سقف ۸)؛ ناحیه دوم dashed برای «پلان خانه (اختیاری — برای دقت بیشتر)» + متن راهنما؛ تک‌عکس با fileToResizedDataUrl(f,1600)، بندانگشتی + X حذف، درگ‌اند‌داپ هم پشتیبانی می‌شود
- بازسازی استریمی واقعی: AI_STEPS فیک حذف شد؛ buildSteps(hasPlan) پویا (ارسال/پلان اگر هست/تحلیل/ادغام/ساخت مش) و api.reconstructStream(shots, floorPlan, onProgress) — stage floorplan→۱۰٪، analyze→۱۵+۶۵×(index/total)٪، merge→۸۵٪، موفقیت→۱۰۰٪؛ گام آخر «ساخت مش سه‌بعدی ویرایش‌پذیر...» فقط در onSuccess کامل می‌شود (هرگز منتظر نماندنش گیر نمی‌کند)؛ زیرنویس پیام فارسی سرور verbatim با aria-live؛ خطا → توست پیام فارسی سرور + ریست پیشرفت؛ onSuccess مثل قبل createProject و ریدایرکت به ویرایشگر
- editor-view.tsx: تشخیص ۴۰۱ پروژه → <OwnerLoginInline> (کارت ورود با api.login؛ موفقیت → invalidate ['project', id] و ['projects'])؛ کیبورد ناج — گارد isTypingTarget (INPUT/TEXTAREA/SELECT/contentEditable) و ترکیب Ctrl/Meta/Alt؛ ArrowUp/Down=-z/+z، Left/Right=-x/+x، PageUp/PageDown=y±، Q/E=چرخش ∓/+۴۵°؛ قدم ۰.۰۵ و Shift→۰.۲۵؛ e.preventDefault؛ beginAction فقط روی !e.repeat (اول burst) مطابق گیزموت؛ clamp موقعیت مثل applyAiPatch (x ±width، y [0,height]، z ±depth)؛ MovePad وقتی primary هست با onDelete/onDuplicate + holdNudge/holdRotate (beginAction یک‌بار در هر نگه‌داشتن با آستانه ۴۰۰ms)؛ متن راهنما به «کلیک: انتخاب • کلیدهای جهت‌نما: حرکت • Q/E: چرخش • Shift+جهت‌نما: قدم بزرگ» تغییر کرد (pill در bottom-3، پد در bottom-16)
- properties-panel.tsx: سوییچ «درب شیشه‌ای» (params.glass) برای base/wall/tall/island/shelf/dishwasher فقط با doors>0 + توضیح «شیشه شفاف روشن — مناسب ویترین»؛ اسلایدر «ارتفاع نصب» tv (۰.۴..۲.۲) و «ارتفاع از کف» مایکروویو (۰.۵..۱.۴) با همان الگوی DimSlider؛ سوییچ «صفحه روشن باشد؟» برای tv (tv در LIGHT_TYPES است ولی پنل کنترلی نداشت)
- viewer-view.tsx: ذخیره خودکار مهمان ویرایشگر — شمارش dirty با dirtyTick که توسط patchObject/toggle/onMoved/پد لمس می‌شود؛ useEffect debounce ۱۲۰۰ms → api.saveAsGuest({token,guestId,sceneState:{objects}})؛ گارد dirtyTick===0 و role==='modifier' و skip اولین ران با ref؛ نشانگر هدر «در حال ذخیره.../ذخیره شد ✓/ذخیره ناموفق» (۳ ثانیه بعد idle، خطا بی‌صدا)؛ onMoved حالا position را از refsMap (THREE.Group) می‌خواند تا جابه‌جایی گیزموت مهمان واقعاً ذخیره شود؛ انتخاب محلی selectedId (ViewerScene onSelect) + <MovePad> بدون delete/duplicate برای modifier با clamp داخل roomSpec و چرخش ۴۵°؛ سوییچ چراغ‌های چیپ هم از patchObject (سبب ذخیره) استفاده می‌کند؛ polling نقش دست‌نخورده
- bunx tsc --noEmit → صفر خطا در src (فقط خطاهای پیش‌موجود examples/ و skills/)؛ bunx eslint روی src/components/home، src/components/editor، src/components/viewer، src/lib/format.ts → بدون خطا (فیکس: انتساب ref حین رندر HoldButton به useEffect منتقل شد، Card به importهای editor-view اضافه شد)

Stage Summary:
- فایل‌ها: format.ts (جدید) — move-pad.tsx (جدید) — home-view.tsx (بازنویسی) — editor-view.tsx — properties-panel.tsx — viewer-view.tsx؛ هیچ فایل read-only تغییر نکرد و هیچ وابستگی جدیدی اضافه نشد
- ورود: کل اپ (خانه/ویرایشگر) با کوکی c3d_admin گیت دارد؛ رمز پیش‌فرض مدیر admin1234 (تغییر از تب «مدیریت» ← «تغییر رمز مدیر»، حداقل ۶ کاراکتر)؛ ۴۰۱ در هر دو نما کارت ورود فارسی می‌دهد؛ نمای مهمان (s/:token) عمومی می‌ماند
- مسیرهای حساس E2E: ورود/خروج → تب پروژه‌ها/مدیریت؛ جست‌وجوی متنی/تاریخی + فیلتر پوشه؛ دیالوگ CRM از «پروژه جدید» و منوی کارت؛ بازسازی استریمی (تا ۸ عکس + پلان اختیاری) با درصد زنده؛ حرکت با دکمه پد و کیبورد (Undo یک‌باره در هر burst)؛ مهمان ویرایشگر: حرکت با پد/گیزموت → ذخیره خودکار ۱.۲s → ماندگاری بعد از رفرش
- نکته برای تست: سرور dev در sandbox این ایجنت بقا ندارد — orchestartor باید bun run dev را اجرا و ورود با admin1234 را تست کند؛ دقت datetime-local بر حسب دقیقه است (رفت‌وبرگشت ISO ثانیه‌ها را می‌اندازد — عمدی)

---
Task ID: 8
Agent: orchestrator (main)
Task: صفحه اصلی عمومی (لندینگ مشتری) با نمونه‌کارهای قابل مدیریت + ورود مدیر در نوبار با رمز admin

Work Log:
- prisma/schema.prisma: مدل جدید PortfolioItem (title/description/category/image/visible/sortOrder) + bun run db:push
- src/lib/auth.ts: DEFAULT_PASSWORD به «admin» تغییر کرد (طبق درخواست کاربر) + حداقل طول setPassword از ۶ به ۴؛ همین تغییر در /api/auth/password و pwError پنل مدیریت اعمال شد
- ریست رمز دیتابیس با اسکریپت یک‌باره (sha256('admin') در Setting) تا ورود با «admin» فوراً کار کند
- API جدید: GET /api/portfolio (عمومی، فقط visible، مرتب sortOrder/createdAt) + GET ?all=1 (گارد مدیر) + POST (گارد مدیر، zod: عنوان/تصویر الزامی، تصویر dataURL یا مسیر عمومی، sortOrder خودکار انتهای لیست) + PATCH/DELETE /api/portfolio/[id] (گارد مدیر، 404 فارسی)؛ serialize مشترک در _lib/portfolio.ts (خارج از route.ts طبق قاعده exportهای Next)
- src/lib/api.ts: PortfolioItemDTO + listPortfolio/createPortfolioItem/updatePortfolioItem/deletePortfolioItem
- تصاویر: ۴ رندر سه‌بعدی با z-ai image CLI تولید و در public/portfolio/ ذخیره شد (kitchen-1/bedroom-1/living-1/office-1.jpg) + seed یک‌باره ۴ نمونه‌کار در دیتابیس
- src/components/home/site-landing.tsx (جدید): لندینگ عمومی کامل RTL — نوبار چسبان با لینک‌های اسکرول نرم (چطور کار می‌کند/امکانات/نمونه‌کارها) و دکمه «ورود» → LoginDialog (رمز مدیر) یا «پنل مدیریت» وقتی وارد است؛ هیرو با بج/تیتر/CTA/hero-kitchen.png؛ بخش ۴ مرحله‌ای «چطور کار می‌کند»؛ ۶ کارت امکانات؛ بخش نمونه‌کارها با fetch عمومی (کارت عکس+دسته+توضیح، اسکلتون لودینگ، حالت خالی)؛ نوار CTA؛ SiteFooter چسبان مشترک؛ انیمیشن FadeIn با framer-motion (whileInView once)
- src/components/home/portfolio-manager.tsx (جدید): تب «نمونه‌کارها» داشبورد — گرید مدیریت با بج دسته/نمایش، ترتیب با فلش‌های بالا/پایین (سواپ sortOrder دو مورد)، سوییچ نمایش (Eye/EyeOff)، ویرایش، حذف با AlertDialog؛ ItemDialog مشترک افزودن/ویرایش با آپلود تصویر (fileToResizedDataUrl 1400px)، دسته (Select ۵تایی)، توضیح (Textarea)، سوییچ «نمایش در صفحه اصلی»؛ ذخیره بدون تصویر/عنوان غیرفعال
- home-view.tsx: حذف گیت تمام‌صفحه OwnerLogin؛ حالت view با sessionStorage ('site' پیش‌فرض | 'dashboard')؛ لندینگ برای همه، داشبورد فقط با authed؛ هدر داشبورد: برند کلیک‌پذیر + «نمایش سایت» + «خروج»؛ تب‌ها ۳تایی شدند (پروژه‌ها/نمونه‌کارها/مدیریت)؛ هیرو تکراری تب پروژه‌ها حذف شد (لندینگ جایگزین محتواست)؛ فوتر → SiteFooter مشترک؛ برند «کابین‌۳بعد» → «استودیو۳بعد» با تگ‌لاین «از عکس تا فضای سه‌بعدی» (layout.tsx هم آپدیت شد)
- رفع: importهای بلااستفاده (MousePointerClick حذف، Images اضافه شد)؛ restart سرور dev برای Prisma Client جدید (پاسخ قبلی «خطای سرور» بود)

Stage Summary:
- جریان جدید: بازدیدکننده عمومی لندینگ را با نمونه‌کارها می‌بیند بدون هیچ لاگینی؛ مدیر از نوبار با رمز موقت «admin» وارد داشبورد می‌شود (تب‌های پروژه‌ها/نمونه‌کارها/مدیریت) و محتوای نمونه‌کارها را آزادانه می‌سازد/ویرایش/مرتب/پنهان/حذف می‌کند
- قرارداد: GET /api/portfolio عمومی (فقط visible)؛ همه تغییرات با کوکی c3d_admin؛ تصویر مسیر عمومی یا dataURL ≤ ~4.5MB؛ ترتیب: sortOrder asc سپس newest
- تست E2E مرورگر: لندینگ دسکتاپ+موبایل (390px)، اسکرول انکری نرم، ورود با رمز غلط → توست «رمز مدیر اشتباه است»، ورود admin → داشبورد، CRUD کامل نمونه‌کار (اعتبارسنجی دیالوگ/ویرایش prefill/PATCH/سواپ ترتیب/حذف با تایید)، سوییچ نمایش و بازگشت به سایت/پنل، خروج → لندینگ عمومی — همه تأیید شد؛ tsc و eslint بدون خطا؛ dev.log بدون خطای runtime

---
Task ID: 9
Agent: orchestrator (main)
Task: فیکس ورود مدیر (رفتن مستقیم به بخش مدیریت) + نمونه‌کارهای سه‌بعدی زنده به‌جای عکس

Work Log:
- فیکس ورود: در home-view.tsx مسیر onEnterDashboard (ورود موفق از دیالوگ نوبار یا کلیک «پنل مدیریت») حالا قبل از setView('dashboard') مقدار setTab('admin') هم می‌گذارد — بعد از تایپ رمز، مستقیم بخش مدیریت (تب «مدیریت») باز می‌شود نه صفحه اول پروژه‌ها؛ ورود/رمز admin از قبل سالم بود (تست curl: 200 + کوکی ۳۰ روزه)
- اسکیما: مدل PortfolioItem دو فیلد roomSpec و sceneState (JSON string، default "{}") گرفت و image به optional با default "" تغییر کرد + bun run db:push
- API نمونه‌کار: serializePortfolioItem حالا roomSpec/sceneState پارس‌شده برمی‌گرداند؛ POST/PATCH با zod پذیرای roomSpec (record آزاد) و sceneState {objects[]} (سقف ۴۰۰ آبجکت) هستند؛ قاعده جدید: حداقل تصویر یا مدل زنده (پیام فارسی 400)؛ stringifyOrEmpty با سقف ۵۰۰KB؛ PATCH بعد از ادغام هم گارد «حداقل تصویر یا مدل زنده» دارد
- api.ts: PortfolioItemDTO += roomSpec/sceneState (پارس‌شده) و PortfolioItemInput آنها را به‌صورت unknown پاس می‌دهد
- کامپوننت جدید src/components/three/portfolio-scene.tsx: صحنه زنده داخل کارت — Canvas با دوربین عروسکی متناسب ابعاد اتاق (hypot و×د ×۰.۹۵+۱)، OrbitControls با autoRotate 0.9 و enableZoom/enablePan=false (اسکرول صفحه نمی‌شکند)، RoomMesh + همه ۱۶ نوع آبجکت با همان dispatcher نمای مشتری، تعامل زنده درب/چراغ با overrideهای محلی (open/on) بدون تغییر داده، normalizeRoomSpec (clamp ۲..۱۵م) و normalizeSceneObjects (حذف آبجکت خراب)، hasLiveScene؛ رندر فقط وقتی کارت در دید است (useInView once از framer-motion) با dpr [1,1.5]
- لندینگ (site-landing.tsx): PortfolioCard اگر hasLiveScene → صحنه زنده (dynamic import ssr:false) + بج «سه‌بعدی زنده» با Rotate3d + بج دسته pointer-events-none + نوار راهنمای «بچرخانید • درب‌ها و چراغ‌ها را لمس کنید»؛ بدون صحنه → عکس مثل قبل؛ تیتر بخش به «کارهای واقعی — به‌صورت مدل سه‌بعدی زنده» با توضیح تعاملی تغییر کرد
- پنل نمونه‌کارها (portfolio-manager.tsx بازنویسی): دیالوگ افزودن/ویرایش بخش «مدل سه‌بعدی زنده» دارد — Select «انتخاب از پروژه‌های من…» (لیست پروژه‌های مدیر با آیکون انتخاب) → کپی roomSpec/sceneState پروژه با پیش‌نمایش زنده داخل دیالوگ + بج نام منبع + دکمه «حذف مدل»؛ تصویر اختیاری شد (وقتی مدل زنده هست) و قاعده ذخیره: title + (تصویر یا مدل زنده)؛ هنگام پاک‌کردن مدل، roomSpec:{} و sceneState:{objects:[]} ارسال می‌شود؛ کارت‌های مدیریت هم پیش‌نمایش زنده دارند + بج «سه‌بعدی زنده» و شمارنده «N مدل سه‌بعدی زنده»
- Seed (scripts/seed-portfolio-3d.ts یک‌بارمصرف): ۴ صحنه دموی کامل به ۴ نمونه‌کار موجود وصل شد — آشپزخانه (کابینت/جزیره/اجاق روشن/هود/یخچال/درب شیشه‌ای/آویزها)، اتاق خواب (تخت/کمد/تلویزیون روشن/چراغ ایستاده)، اتاق کار (میز/صندلی/قفسه/کمد دیواری)، نشیمن (تلویزیون روشن/میز تلویزیون/مبل رو به تلویزیون/فرش/چراغ)
- زیرساخت: سرور dev با کلاینت Prisma کهنه جواب اشتباه می‌داد (objects:0) — kill کامل پروسه‌های ۳۰۰۰ و استارت مجدد با (setsid nohup … &)؛ نکته: استارت با setsid ساده/nohup+disown بین کال‌ها بقا ندارد، فقط الگوی double-fork subshell ماندگار شد
- تست E2E مرورگر: لندینگ → ۵ کارت سه‌بعدی زنده رندر شد (۴ دمو + آیتم تست)؛ چرخش خودکار با دیفرانس دو اسکرین‌شات (~۳۲هزار پیکسل تغییر) تأیید؛ کلیک روی صفحه تلویزیون کارت اتاق‌خواب → پیکسل از (206,225,235) به (0,0,1) = خاموش شد (Mesh States روی کارت عمومی کار می‌کند)؛ ورود با admin → مستقیم تب «مدیریت» [selected]؛ تب نمونه‌کارها → ۴ پیش‌نمایش زنده + بج‌ها؛ دیالوگ جدید → انتخاب پروژه «آشپزخانه نمونه» → پیش‌نمایش زنده در دیالوگ → ذخیره → آیتم جدید در لندینگ زنده رندر شد → سپس حذف شد؛ موبایل ۳۹۰px تک‌ستونه سالم؛ curl: POST بدون محتوا 400 فارسی، POST با صحنه 201، PATCH خالی‌کردن صحنه بدون تصویر 400، حذف ok؛ tsc و eslint بدون خطا؛ dev.log بدون خطا

Stage Summary:
- جریان جدید ورود: بازدیدکننده لندینگ عمومی را می‌بیند؛ مدیر با رمز admin از نوبار → مستقیماً بخش مدیریت (نه صفحه پروژه‌ها)؛ پروژه‌ها/نمونه‌کارها با یک کلیک در دسترس‌اند
- نمونه‌کارها حالا «مدل سه‌بعدی زنده»اند: کارت لندینگ خودش می‌چرخد، با درگ می‌چرخد، درب‌ها باز/بسته و چراغ‌ها روشن/خاموش می‌شوند؛ عکس فقط fallback است
- قرارداد: GET /api/portfolio عمومی roomSpec/sceneState پارس‌شده می‌دهد؛ POST/PATCH حداقل «تصویر یا صحنه» می‌خواهند؛ منبع صحنه = انتخاب از پروژه‌های مدیر در دیالوگ نمونه‌کار
- فایل‌ها: schema.prisma، api/portfolio (هر دو route)، _lib/portfolio.ts، lib/api.ts، three/portfolio-scene.tsx (جدید)، home/site-landing.tsx، home/portfolio-manager.tsx، home/home-view.tsx (یک‌خطی ورود)، scripts/seed-portfolio-3d.ts (یک‌بارمصرف)
---
Task ID: 10
Agent: orchestrator (main)
Task: پشتیبانی از اتاق‌های غیرمستطیلی — دیوار کج و گوشه‌های بیشتر از ۴ (خواسته کاربر: «یه سری خونه ها هست که دیوارش از کج هستن و ۴ تا گوشه ای نیست» با نقاشی پلان پنج‌ضلعی)

Work Log:
- src/lib/polygon.ts (جدید): هندسه چندضلع مشترک سرور/کلاینت — Pt، rectangleOutline (ترتیب لبه‌ها back/right/front/left)، normalizeOutline تدافعی (۳..۱۲ نقطه، حذف نقاط نزدیک، winding مثبت، مساحت حداقلی)، signedAreaXZ/outlineBBox/outlineArea/pointInPolygon/polygonCentroid/clampPointToOutline/edgeFrame (نرمال داخلی/بیرونی + angleY)/getRoomOutline/hasCustomOutline/clampPositionToRoom
- scene-types.ts: RoomSpec.outline? (پلان چندضلعی متریک)، WindowSpec/DoorwaySpec.wallIndex? (اندیس لبه برای دیوار کج)، WALL_NAME_EDGE، placeAtEdge (جانمایی روی لبه i با نرمال داخلی) در کنار placeAtWall قدیمی
- room.tsx (بازنویسی): یک مسیر رندر یکپارچه — getRoomOutline همیشه چندضلع می‌دهد (مستطیل = حالت خاص)؛ کف/سقف ShapeGeometry با تضمین winding CCW (ShapeUtils.area)، دیوار = صفحه FrontSide رو به داخل برای هر لبه (dollhouse حفظ شد)، قرنیز دنبال‌کننده لبه‌ها، پنجره/درب روی لبه با wallIndex یا «نزدیک‌ترین لبه به جهت نام دیوار» (هوشمند برای چندضلع، همان قدیمی برای مستطیل)، نور خورشید از بیرونِ لبه پنجره اصلی
- reconstruct/route.ts: پرامپت v3.1 — قانون ۶ جدید NON-RECTANGULAR ROOMS (outline [x,z] متریک + wallIndex برای لبه‌های کج)، FLOORPLAN_PROMPT استخراج outline footprint، MERGE_PROMPT قاعده outline (نقشه = ground truth)، normalizeAnalysis پارس outline + بازمحاسبه widthM/depthM از bbox + wallIndex پنجره/درب/آیتم‌ها، buildObject جانمایی روی لبه کج با placeAtEdge (fallback نام دیوار)
- editor-store: setRoomSpec + setRoomOutline (bbox → widthM/depthM، null = بازگشت مستطیل، outline موقت نامعتبر نادیده) + clamp خودکار داخل چندضلع در addObject/addGenerated/addObjects
- room-plan-panel.tsx (جدید): ویرایشگر پلان SVG دوبعدی — درگ گوشه (۵سانت خوشه، viewBox منجمد حین درگ)، «+» درج گوشه روی هر دیوار (تا ۱۲)، «×» حذف گوشه (حداقل ۳)، «مستطیل» ریست، نمایش عرض×عمق/مساحت/تعداد دیوار با ارقام فارسی
- editor-view: پنل پلان در حالت بدون انتخاب + دکمه PencilRuler در هدر (دیالوگ پلان)؛ saveProject حالا roomSpec را هم ذخیره می‌کند؛ clamp موقعیت (درگ/کیبورد/AI/drop) با clampPositionToRoom
- viewer-view: clampPos مهمان ویرایشگر داخل چندضلع؛ page.tsx: key برای EditorView/ViewerView (رفع باگ ناوبری ویرایشگر→ویرایشگر که پروژه قبلی را نگه می‌داشت)
- portfolio-scene: normalizeRoomSpec عبور outline + bbox؛ normalizeSceneObjects تضمین id (رفع هشدار React key در کارت زنده)
- scene-types: ensureObjectIds — تضمین id آبجکت‌های فاقد شناسه در لود ویرایشگر/ویوئر (داده API/قدیمی)
- تست E2E مرورگر: پروژه پنج‌ضلعی با API ساخته شد → رندر ۵دیواره با دیوار کج دقیقاً مطابق نقاشی کاربر؛ درگ گوشه در پلان → عمق ۳٫۴→۴٫۱ زنده در 3D + «ذخیره شد» + ماندگار بعد از رفرش؛ درج گوشه (۵→۶ضلعی)؛ ریست مستطیل؛ درب/پنجره روی لبه درست (دراب بدون wallIndex → نزدیک‌ترین لبه)؛ لندینگ با کارت زنده پنج‌ضلعی + ویوئر مشتری (نمای داخل، چراغ روشن)؛ رگرسیون کامل مستطیل (پروژه‌های «عباس»/«حال» — پنجره و درب سر جای خود)؛ موبایل ۳۹۰px سالم
- رفع باگ‌های جانبی: هشدار React key (آبجکت بدون id در نمونه‌کار/ویوئر/ویرایشگر)، ناوبری ویرایشگر→ویرایشگر (key در page.tsx)

Stage Summary:
- اتاق دیگر لزوماً ۴دیواره نیست: RoomSpec.outline (۳..۱۲ گوشه [x,z] متریک) همه‌جا پشتیبانی می‌شود — رندر، بازسازی AI (تشخیص دیوار کج از عکس/نقشه)، ویرایش دستی پلان (درگ گوشه/درج/حذف)، clamp آبجکت‌ها، ویوئر مشتری، نمونه‌کار زنده، GLB
- قرارداد: outline نبود = مستطیل (رفتار قبل ۱۰۰٪ حفظ شد)؛ widthM/depthM همیشه bbox پلان؛ پنجره/درب/آیتم روی دیوار کج با wallIndex (لبه i از نقطه i تا i+1)؛ نام دیوار بدون wallIndex → نزدیک‌ترین لبه به جهت آن
- فایل‌ها: polygon.ts و room-plan-panel.tsx جدید؛ scene-types/room/editor-store/editor-view/viewer-view/portfolio-scene/reconstruct/page تغییر
- دمو نگه‌داری‌شده: پروژه و نمونه‌کار «آشپزخانه پنج‌ضلعی — دیوار کج» در لندینگ برای نمایش قابلیت

---
Task ID: 11-b
Agent: general-purpose (admin UI)
Task: فرم کامل پروژه (مشتری/قرارداد/مالی/زمان‌بندی) + تطبیق خودکار پوشه مشتری + بج‌های مرحله/مبلغ/قرارداد روی کارت پروژه + فیلد شماره پوشه + دکمه «ویرایش مدل» نمونه‌کار

Work Log:
- خواندن worklog، api.ts، crm.ts، format.ts، image-utils.ts، home-view.tsx (کامل) و portfolio-manager.tsx
- ساخت src/components/home/project-form-dialog.tsx:
  • ProjectFormDialog جایگزین CrmDialog — بخش‌های «مشتری»، «قرارداد و مالی»، «زمان‌بندی» با گرید ۲ ستونه، hint «همه فیلدها اختیاری هستند»، max-w-lg و اسکرول عمودی
  • فیلدها: نام پروژه (فقط باName)، نام مشتری، شماره‌های تماس (ltr، maxLength 60)، مکان اجرا، مرحله پیشرفت (Select پنج مرحله‌ای، پیش‌فرض visit)، مبلغ قرارداد (عدد، ltr، پیش‌نمایش formatToman)، تاریخ قرارداد (date ساده ↔ ISO با T12:00:00)، عکس قرارداد و فاکتور (آپلود با fileToResizedDataUrl 1100/0.75 + پیش‌نمایش + حذف)، سه datetime بازدید/اجرا/اتمام
  • export های قرارداد: ProjectFormSave، ProjectFormInitial، ResolvedCustomerFolder، resolveCustomerFolder(name, phone) — یک فراخوانی api.createFolder که سرور با dedupe نام، پوشه موجود را برمی‌گرداند (existed)
- home-view.tsx — FolderBar: حذف کامل CrmDialog؛ «پروژه جدید» → ProjectFormDialog؛ در mutationFn تطبیق خودکار پوشه مشتری با resolveCustomerFolder و ارسال همه فیلدهای CRM؛ toast «پروژه در پوشه مشتری «X» ثبت شد» یا «پوشه جدید مشتری ساخته شد»؛ ناوبری به /editor/<id>؛ خطای پوشه‌بندی پروژه را متوقف نمی‌کند
- home-view.tsx — UploadCard: بخش Collapsible «اطلاعات مشتری و مرحله (اختیاری)» با نام مشتری/شماره تماس (sm:grid-cols-2) و Select مرحله؛ هر دو مسیر reconstruct و startSample پوشه مشتری را resolve/می‌سازند و clientName/clientPhone/stage را به createProject می‌دهند؛ invalidate ['folders'] و toast ساخت/استفاده مجدد پوشه؛ prop folderId برای حالت بدون نام مشتری حفظ شد
- home-view.tsx — ProjectCard: بج مرحله پیشرفت (کلاس badge/dot از stageInfo، کلیک = باز شدن فرم)، بج‌های outline «مبلغ: …» و «قرارداد: …»، بج‌های قابل‌کلیک «قرارداد 📎» (Paperclip) و «فاکتور» (FileText) با ImagePreviewDialog جدید؛ DropdownMenuSub «مرحله پیشرفت» با ۵ مرحله (Check روی فعلی + نقطه رنگی) → patchProject(stage)؛ ویرایش با ProjectFormDialog («مشخصات پروژه — …») و saveCrm که همه فیلدهای جدید را patch می‌کند
- home-view.tsx — FolderDialog: فیلد اختیاری «شماره تماس مشتری» (ltr) و onSave(name, phone)؛ ساخت پوشه با api.createFolder(name, phone)؛ تغییر نام مثل قبل فقط نام؛ tooltip شماره روی چیپ پوشه (title)
- portfolio-manager.tsx: دکمه Rotate3d «ویرایش مدل سه‌بعدی» در ManagerCard (کنار Pencil، disabled وقتی صحنه زنده نیست، title + aria-label) و دکمه «ویرایش این مدل» در ItemDialog کنار پیش‌نمایش صحنه — هر دو window.location.hash = '/editor/pf/<id>'
- بررسی نهایی: bunx eslint (بدون هیچ warning) و bunx tsc — هر دو برای فایل‌های این تسک پاک؛ خطاهای باقی‌مانده tsc فقط در examples/، skills/ و src/components/editor (فایل عامل دیگر در حال ویرایش)

Stage Summary:
- فرم واحد و کامل پروژه (مشتری + قرارداد/مالی + زمان‌بندی + عکس قرارداد/فاکتور) در project-form-dialog.tsx جایگزین CrmDialog شد
- پوشه مشتری به‌صورت خودکار از نام مشتری resolve/ساخته می‌شود (یک فراخوانی createFolder، سرور dedupe می‌کند) در هر سه مسیر: پروژه جدید، بازسازی AI و فضای نمونه
- کارت پروژه بج‌های مرحله/مبلغ/تاریخ قرارداد/پیوست‌ها + تغییر سریع مرحله از منو را دارد؛ پوشه‌ها شماره تماس دارند؛ نمونه‌کارهای دارای مدل زنده دکمه «ویرایش مدل» به /editor/pf/:id دارند
---
Task ID: 12
Agent: general-purpose (editor)
Task: اسنپ دیوار (سُرخوردن کابینت روی دیوار حین درگ) + ویرایش مدل نمونه‌کار از ویرایشگر (/editor/pf/:id) + برجسته‌سازی «ساخت با متن» (قطعه و کل فضا) + بازگردانی پنل «نما و بازشوها» (رنگ‌ها/ارتفاع/پنجره و درب)

Work Log:
- wall-snap.ts (جدید، ریاضی محض بدون وابستگی three تا استور هم ایمپورت کند): WALL_SNAP_TYPES (base/wall/tall/shelf/fridge/stove/washer/dishwasher/microwave/hood/tv) + isWallSnapType؛ WallDragState {edgeIndex,inset,y,halfW}؛ beginWallDrag (نزدیک‌ترین لبه با فاصله نقطه→پاره‌خط و clamp به سر نزدیک‌تر، inset=(d/2+0.02)، halfW=w/2، y قفل)؛ applyWallDrag (پروجکشن خام گیزموت روی خط لبه، محدود |t|<=len/2-halfW-0.05، inset از نرمال داخلی، rotationY=edge.angleY رو به داخل — همان قرارداد EdgeGroup در room.tsx)؛ snapNewObject (دراپ/افزودن روی نزدیک‌ترین لبه؛ پیش‌فرض inset=0.32 و تلویزیون نازک)؛ nearestEdgeIndex عمومی
- editor-scene: prop جدید wallSnapEnabled؛ SelectionTransform حالا spec/objects/wallSnap می‌گیرد — در mouseDown وضعیت درگ (لبه/inset/y/halfW) از موقعیت همان لحظه گروه قفل می‌شود و در هر onObjectChange موقعیت خام گیزموت با applyWallDrag بازنویسی می‌شود (position.set + rotation.y) → گیزموت عملاً آبجکت را روی دیوار سُر می‌دهد؛ ارتفاع حین سُرخوردن ثابت؛ listener سراسری keydown/keyup برای Alt (ref) — حین نگه‌داشتن Alt اسنپ آن فریم رد می‌شود + blur برای ریست؛ translationSnap 0.05 حفظ شد؛ تغییر گروه از مسیر ref (targetGroupRef) انجام می‌شود تا با قاعده react-hooks/immutability سازگار باشد؛ wallSnapEnabled=false دقیقاً رفتار قبلی
- editor-store: addObject پارامتر اختیاری rotationY گرفت؛ replaceScene(roomSpec, objects) جدید — beginAction برای undo، ensureObjectIds + clampPositionToRoom تک‌تک، پوشش دفاعی فیلدهای roomSpec خروجی AI، selectedIds خالی؛ findFreeSpot برای WALL_ROW_TYPES وقتی outline سفارشی هست نتیجه را با snapNewObject روی نزدیک‌ترین لبه می‌کشد (رفع افتادن ردیف سخت‌کد بیرون چندضلعی)
- editor-view: onMoved حالا rotationY را هم از g.rotation.y (۳ رقم گرد) همگام می‌کند تا چرخش اسنپ در استور/ذخیره بماند؛ handlePlace بعد از clamp اگر isWallSnapType → snapNewObject با پارامترهای کاتالوگ و addObject با rotationY؛ addFromCatalog هم همین‌طور (چسبیدن دقیق حتی در مستطیل)؛ دکمه Magnet در تولبار (پیش‌فرض روشن، title «چسبیدن کابینت به دیوار (با نگه‌داشتن Alt موقتاً آزاد)»)
- page.tsx: Route جدید {view:'editor-pf'; portfolioId} — '/editor/pf/<id>' قبل از '/editor/' پارس می‌شود؛ رندر <EditorView key={'pf-'+id} portfolioId={id} />
- editor-view حالت نمونه‌کار: props {projectId?, portfolioId?}؛ useQuery ['portfolio-item', id] با api.getPortfolioItem (پاسخ {item} با title/roomSpec/sceneState پارس‌شده)؛ loadProject با id/title؛ ذخیره خودکار ۱۴۰۰ms در حالت نمونه‌کار → api.updatePortfolioItem(id, {roomSpec, sceneState:{objects}}) + تصویر از glRef.toDataURL('image/jpeg', 0.6) برای تازه‌ماندن عکس fallback؛ rename با onBlur → updatePortfolioItem({title}) و invalidate کوئری؛ 401 → همان OwnerLoginInline (هر دو کوئری پوشش داده شد)؛ خطا → «نمونه‌کار پیدا نشد»؛ دکمه انتشار و ShareDialog فقط در حالت پروژه؛ aria-label نام → «عنوان نمونه‌کار»؛ GLB/back/save status بدون تغییر
- «ساخت با متن»: دکمه Sparkles در تولبار → دیالوگ «ساخت با یک جمله» با Textarea + دو اکشن: «قطعه‌ای بساز» (generateObject مسیر قبلی) و «کل فضا را طراحی کن» (api.generateRoom → store.replaceScene) با Loader2 جدا برای هر کدام، یادداشت «فضای فعلی جایگزین می‌شود — با Ctrl+Z قابل بازگشت»، بستن/پاک‌کردن بعد از موفقیت؛ متن راهنمای پایین صحنه با «دکمه ساخت با متن: کابینت یا کل فضا را با یک جمله بسازید» توسعه یافت
- room-plan-panel بازنویسی با Tabs (dir rtl، TabsList h-8): تب «پلان» همان ویرایشگر SVG قبلی (بدون تغییر رفتار)؛ تب جدید «نما و بازشوها»: رنگ دیوار/کف/سقف (input color) + اسلایدر ارتفاع اتاق 2.4..3.5 گام 0.05 → setRoomSpec مستقیم از استور؛ لیست پنجره‌ها/درب‌ها با حذف (Trash2)، افزودن «+ پنجره» (back/0/sillY 0.9/1.2×1.2) و «+ درب» (front/0/0.95×2.05)، ویرایش هر آیتم با Select دیوار (پشت/راست/جلو/چپ + «لبه N» برای پلان‌های چندضلعی، wallIndex+wall با هم ست می‌شوند) و Inputهای عددی offsetX/sillY/width/height در ScrollArea؛ چون وضعیت از استور می‌آید در پنل کناری و دیالوگ پلان هر دو کار می‌کند
- scene-types: WALL_NAME_FA (پشت/جلو/چپ/راست) اضافه شد (فقط export جدید)؛ polygon.ts دست نخورد (هلپر فاصله پاره‌خط محلی در wall-snap پیاده شد)
- تست ریاضی با bun: سُر خوردن روی دیوار پشت (0,0,-1.38) rot=0، دیوار راست x=1.68 rot=-π/2، قفل‌شدن y کابینت دیواری، فاصله دقیق 0.32 از لبه کج پنج‌ضلعی + rotationY=atan2 داخلی، clamp انتهای لبه به 1.55، تلویزیون inset=0.05 — همه مطابق انتظار
- eslint (page/editor/wall-snap/editor-scene/store/polygon/scene-types) و tsc بدون خطا در src (فقط ۴ خطای قدیمی examples/ و skills/ خارج از src که مربوط به این تسک نیست)

Stage Summary:
- قرارداد اسنپ دیوار: درگ انواع دیواری = سُرخوردن روی دیوار (لبه در شروع درگ قفل، y ثابت، آبجکت همیشه flush با inset=d/2+0.02 و رو به داخل)؛ Alt=آزاد موقت؛ دکمه Magnet=خاموش/روشن کل قابلیت؛ خروجی applyWallDrag: {position:[x,y,z], rotationY} — rotationY=edge.angleY (همان کنوانسیون room.tsx)
- قرارداد مسیر نمونه‌کار: '#/editor/pf/<portfolioId>' → ویرایشگر با load از GET /api/portfolio/:id و ذخیره خودکار PATCH همان آیتم (roomSpec/sceneState/image)؛ انتشار/اشتراک فقط برای پروژه‌هاست؛ عنوان با blur پچ می‌شود
- APIهای استور: addObject(type, position, label?, rotationY?)؛ replaceScene(roomSpec, objects) (undo-friendly)؛ findFreeSpot با snap لبه در پلان غیرمستطیلی؛ EditorScene prop جدید: wallSnapEnabled (required)
- فایل‌ها: three/wall-snap.ts (جدید)، three/editor-scene.tsx، editor/editor-view.tsx، editor/room-plan-panel.tsx، store/editor-store.ts، app/page.tsx، lib/scene-types.ts (+WALL_NAME_FA) — home/*، api/*، lib/api.ts، بقیه three/* دست‌نخورده
---
Task ID: 13
Agent: general-purpose (3D realism)
Task: ارتقای واقع‌گرایی رندر سه‌بعدی — پاسخ به «الان بیشتر شبیه انیمیشنه… حرفه‌ای‌تر مثل 3Dهای دیگر» — بافت پروسیجرال، سایه نرم PCSS، محیط استودیویی PBR، تون‌مپینگ ACES و متریال‌های فیزیکی

Work Log:
- سه فایل کمکی جدید: three/textures.ts (کارخانه بافت CanvasTexture بدون هیچ فایل تصویری — کف پارکت 512px با تخته‌های 64px و لرزش hue/lightness ±6% و درز تیره و گره چوب و درز عمودی انتهای تخته، گچ دیوار 256px با نویز تک‌پیکسلی ±3% و کمانه ماله + bumpMap خاکستری جدا، گرانیت رویه با ۴۵۰ نقطه و ۳ رگه بزیه، کاشی 4×4 با بند #d9d4c8 برای پشت سینک آینده، رگه چوب عمودی سینوسی برای درب کابینت/مبلمان؛ همه با کش Map بر کلید نوع+رنگ → تغییر رنگ = بافت تازه، گارد SSR «typeof document === 'undefined' → null»، SRGBColorSpace برای map و خطی برای bump، RepeatWrapping و anisotropy 4؛ به‌علاوه cloneWithRepeat برای repeat مستقل هر مش با source مشترک (آپلود GPU یک‌بار) و shadeHex) و three/scene-quality.tsx (SoftShadows size22/samples12/focus0.7 + Environment resolution128/frames1 با ۴ Lightformer استودیویی: پنل سقفی گرم 2.2، دو پنل جانبی سرد 0.6، بازتاب کف گرم 0.3 — فقط environment map، پس‌زمینه دست‌نخورده؛ + applyToneMapping = ACESFilmic با exposure 1.12)
- هر سه Canvas (editor/viewer/portfolio): onCreated اضافه شد → gl.toneMapping ACESFilmic + exposure 1.12 و setClearColor به '#cdc6ba'؛ preserveDrawingBuffer و antialias و dprها (editor [1,2] با glRef، portfolio [1,1.5]) دست‌نخورده → تامب‌نیل toDataURL سالم می‌ماند
- SceneEnvironment (مشترک هر سه صحنه): ambient 0.5→0.35، hemisphere 0.35→0.3، directional سایه‌انداز 0.85 حذف شد و جایگزین fill بدون سایه 0.5 گرم + ریم 0.15؛ SceneQuality داخل همین کامپوننت → هر سه صحنه خودکار PCSS+محیط دارند
- قرارداد سایه: دقیقاً «یک نور سایه‌انداز در هر صحنه» = خورشید RoomMesh — room.tsx خورشید castShadow گرفت با shadow-mapSize 2048، bias -0.0004، normalBias 0.02 و قاب دوربین سایه ±8؛ castShadow از pointLight لوستر (decor.tsx) حذف شد (قبلاً نور دومِ سایه‌انداز بود)
- room.tsx: کف = پارکت پروسیجرال با repeat (bbox/1.2m) و roughness 0.85→0.55 و envMapIntensity 0.6 (fallback رنگی در SSR)؛ دیوارها = گچ پروسیجرال به‌ازای هر لبه با repeat (len/1.5, h/1.5) + bumpMap با bumpScale 0.015 و roughness 0.9؛ قرنیز roughness 0.5 و envMapIntensity 0.4؛ شیشه پنجره: استاندارد شفاف opacity 0.3 + roughness 0.05 + metalness 0 + envMapIntensity 1.2 + emissive #b8d9ea با شدت 0.35 — عمداً transmission物理ی نرفتم تا شیشه در هیچ شرایطی سیاه نشود (باگ B کاربر)؛ قاب/میله/طاقچه roughness 0.5
- cabinet.tsx: درب/کشو = meshPhysical با رگه چوب + clearcoat 0.55 و clearcoatRoughness 0.35 و roughness 0.4 و envMapIntensity 0.7؛ قاب دور شیشه هم رگه‌دار شد؛ شیشه درب کابینت = استاندارد شفاف 0.28 + envMapIntensity 1.3 + emissive #a8c8d8 خیلی ملایم 0.12 (هرگز سیاه)؛ بدنه = رگه چوب تیره‌شده (shadeHex -18%) با roughness 0.55؛ رویه = گرانیت صیقلی roughness 0.25 و envMapIntensity 0.9؛ قفسه‌ها رگه‌دار؛ دستگیره‌ها استیل #c9c9cf با metalness 0.95 و roughness 0.28 و envMapIntensity 1.4 (HANDLE_STEEL مشترک)؛ RoundedBox عمداً اعمال نشد تا منطق لولا/انیمیشن دست نخورد
- appliance.tsx: یخچال استیل واقعی (بدنه 0.7/0.3 env 1.2، درب‌ها کمی روشن‌تر 0.28/0.7 env 1.25)؛ HingedDoor پارامتر metalness/roughness گرفت؛ اجاق 0.6/0.35 و صفحه شیشه‌ای roughness 0.15؛ هود 0.6/0.35؛ لباسشویی/ظرفشویی 0.5/0.35؛ همه دستگیره‌های STEEL → STEEL_MAT (0.9/0.25/env 1.3)
- furniture.tsx: تلویزیون روشن = emissive #cfe6f5 با شدت 1.6 و بیزل 0.3/0.4؛ مبل/تخت پارچه‌ای‌تر (roughness 0.95)؛ میز و صندلی رگه چوب گرفتن (roughness 0.5، env 0.5)
- decor.tsx: فرش مات کامل (roughness 1)، گلدان 0.6، کاسه لوستر metalness 0.4
- کارایی: بافت فقط یک‌بار به‌ازای هر رنگ تولید و کش می‌شود؛ کلون‌ها source مشترک دارند؛ ContactShadows عمداً اضافه نشد (سایه دوبل + هزینه)؛ Environment frames=1 ارزان؛ SoftShadows پچ یک‌باره شیدر
- تست: bun -e با استاب document — تولید هر ۵ نوع بافت، کش یکسان (a===b)، SRGB برای map و خطی برای bump، کلون repeat صحیح و source مشترک، گارد SSR null — همه سبز؛ bunx eslint روی هر ۱۰ فایل = صفر مشکل؛ bunx tsc = فقط ۴ خطای قدیمی examples/ و skills/ خارج از src

Stage Summary:
- صحنه‌ها از «فلت/انیمیشنی» به حس رندر حرفه‌ای رفتند: سایه نرم PCSS از خورشید جهت‌دار هر اتاق + بازتاب‌های استودیویی روی فلز/شیشه/رویه + تون‌مپینگ فیلمیک + بافت‌های کاملاً پروسیجرال (پارکت، گچ، گرانیت، رگه چوب) بدون هیچ asset خارجی
- قراردادها: فقط یک نور سایه‌انداز در هر صحنه (خورشید room.tsx)؛ SceneQuality داخل SceneEnvironment است و هر سه Canvas خودکار می‌گیرند؛ بافت‌ها client-only با گارد SSR و fallback رنگی؛ رنگ‌ها ورودی بافت‌اند پس تغییر رنگ از پنل = بافت تازه از کش
- فایل‌ها: three/textures.ts (جدید)، three/scene-quality.tsx (جدید)، three/editor-scene.tsx (فقط SceneEnvironment + onCreated — منطق درگ/اسنپ تسک ۱۲ دست نخورد)، three/viewer-scene.tsx و three/portfolio-scene.tsx (فقط onCreated)، three/room.tsx، three/cabinet.tsx، three/appliance.tsx، three/furniture.tsx، three/decor.tsx — هیچ فایل خارج از سه فایل‌های مجاز تغییر نکرد
- tileTexture (کاشی 4×4) آماده استفاده برای پشت‌سینک آینده است (هنوز جایی رندر نمی‌شود چون backsplash سطح اتاق منطق عمومی ندارد)
