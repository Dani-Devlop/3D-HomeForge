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
