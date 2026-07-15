# ENARTE Mobile (Expo)

تطبيق موبايل داخلي لـ ENARTE يركز على المساعد الذكي وتجربة الإضاءة، متصل بسيرفر Railway.

يستخدم **Expo SDK 54** ليتوافق مع Expo Go من متجر التطبيقات (Supported SDK: 54).

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

- **الرئيسية:** هوية ENARTE فاخرة + اختصارات للمتجر والتجربة والمساعد
- **المتجر:** تصنيفات + بحث + شبكة منتجات
- **تفاصيل المنتج:** اختيار variant + **جرّبها بغرفتك** + إضافة للسلة
- **السلة:** تعديل الكميات + **دفع داخل التطبيق** (WebView لـ Shopify Checkout)
- **المساعد:** جلسات/رسائل/إجراءات ذكية + بطاقات منتجات
- **جرب الإضاءة:** رفع صورة غرفة ثم فتح الاستوديو داخل التطبيق (بدون متصفح خارجي)

## بناء داخلي (Android APK)

1. حساب Expo: `npx eas-cli login`
2. اربط المشروع: `npx eas-cli init` (مرة واحدة)
3. ابنِ نسخة داخلية:

```bash
npx eas-cli build --platform android --profile preview
```

لـ iOS استخدم Expo Go أولاً، ثم `eas build --platform ios --profile preview` عند توفر حساب Apple Developer.

## API المتجر (على Railway)

```
GET /api/mobile/catalog?type=collections
GET /api/mobile/catalog?type=products&collection=chandeliers
GET /api/mobile/catalog?type=product&handle=...
```

## ملاحظات

- الدفع و«جرّبها بغرفتك» يتمان **داخل التطبيق** عبر WebView (بدون إجبار فتح المتصفح/الموقع).
- التطبيق يخاطب Railway مباشرة (لا يعتمد على App Proxy).
