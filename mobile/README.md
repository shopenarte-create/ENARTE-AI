# ENARTE Mobile (Expo)

تطبيق موبايل داخلي لـ ENARTE يركز على المساعد الذكي وتجربة الإضاءة، متصل بسيرفر Railway.

## المتطلبات

- Node 20+
- تطبيق **Expo Go** على الأندرويد أو الآيفون للتجربة السريعة

## التشغيل

```bash
cd mobile
npm install
npm start
```

ثم امسح QR من Expo Go، أو:

```bash
npm run android
npm run ios
```

## متغيرات البيئة

انسخ `.env.example` إلى `.env` وعدّل عند الحاجة:

```bash
EXPO_PUBLIC_API_BASE_URL=https://enarte-ai-production.up.railway.app
EXPO_PUBLIC_STORE_URL=https://enarteshop.com
EXPO_PUBLIC_SHOP_DOMAIN=jb8xus-wn.myshopify.com
```

## الشاشات

- **الرئيسية:** دخول سريع للتسوق والمساعد
- **المتجر:** تصنيفات + بحث + شبكة منتجات
- **تفاصيل المنتج:** اختيار variant + إضافة للسلة
- **السلة:** تعديل الكميات + إتمام الشراء عبر Shopify Checkout
- **المساعد:** جلسات/رسائل/إجراءات ذكية + بطاقات منتجات (مع إضافة للسلة)
- **جرب الإضاءة:** رفع صورة غرفة عبر `/api/try-handoff` ثم متابعة التجربة

## API المتجر (على Railway)

```
GET /api/mobile/catalog?type=collections
GET /api/mobile/catalog?type=products&collection=chandeliers
GET /api/mobile/catalog?type=product&handle=...
```

## بناء داخلي (Android APK)

1. حساب Expo: `npx eas-cli login`
2. اربط المشروع: `npx eas-cli init` (مرة واحدة)
3. ابنِ نسخة داخلية:

```bash
npx eas-cli build --platform android --profile preview
```

لـ iOS استخدم Expo Go أولاً، ثم `eas build --platform ios --profile preview` عند توفر حساب Apple Developer.

## ملاحظات

- الشراء يتم عبر فتح متجر Shopify (ليس سلة داخل التطبيق في الـ MVP).
- التطبيق يخاطب Railway مباشرة (لا يعتمد على App Proxy).
