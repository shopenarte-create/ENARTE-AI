/**
 * Build Android APK via EAS (requires: npx eas-cli login).
 * Usage from mobile/: npm run build:apk
 */
console.log(`
ENARTE — بناء APK للتحميل المباشر
================================
1) سجّلوا الدخول:
   cd mobile
   npx eas-cli login

2) اربطوا المشروع (مرة واحدة):
   npx eas-cli init

3) ابنوا APK:
   npx eas-cli build --platform android --profile preview --non-interactive

4) بعد انتهاء البناء انسخوا رابط ملف .apk من لوحة Expo
   أو حمّلوه وارفعوه إلى:
   public/download/enarte.apk
   ثم انشروا على Railway.

5) الزر «تحميل التطبيق للأندرويد» على /app/install
   سيبدأ التنزيل مباشرة من:
   https://enarte-ai-production.up.railway.app/download/enarte.apk
`);
