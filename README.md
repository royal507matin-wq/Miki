# MIKAZI AI

نسخه اول سایت خصوصی MIKAZI با:
- صفحه ورود با رمز مشترک
- طراحی اختصاصی دارک + آبی نئونی
- موشن، ذرات، نور و انیمیشن
- صفحه معرفی
- دکمه «شروع گفتگو»
- چت با OpenAI Responses API
- API Key فقط سمت سرور
- ذخیره تاریخچه چت در مرورگر هر کاربر با localStorage
- آماده برای Vercel و اجرای محلی با Node/Termux

## اجرای ساده روی گوشی با Termux

1) وارد پوشه پروژه شو:
cd ~/storage/downloads/MIKAZI_AI

2) نصب:
npm install

3) فایل `.env` بساز:
cp .env.example .env

4) فایل `.env` را باز کن و فقط API Key خودت را وارد کن:
nano .env

باید شبیه این باشد:
MIK_PASSWORD=MIKAZI310
OPENROUTER_API_KEY=کلید_تو
OPENROUTER_MODEL=openrouter/free

5) اجرا:
node server.js

بعد مرورگر را باز کن:
http://localhost:3000

## انتشار رایگان با لینک عمومی

این پروژه برای Vercel آماده شده است.

1) پروژه را در GitHub قرار بده.
2) در Vercel گزینه Add New Project را بزن و مخزن را انتخاب کن.
3) در Environment Variables این سه مورد را وارد کن:
MIK_PASSWORD = MIKAZI310
OPENROUTER_API_KEY = کلید API
OPENROUTER_MODEL = openrouter/free
4) Deploy را بزن.
5) Vercel یک لینک رایگان مثل `something.vercel.app` می‌دهد.

نکته امنیتی:
`.env` را هرگز داخل GitHub آپلود نکن. API Key فقط باید در Environment Variables سرور/Vercel باشد.

نکته هزینه:
خود سایت/هاست می‌تواند با پلن رایگان Vercel اجرا شود، اما استفاده از API هوش مصنوعی معمولاً هزینه مصرف API دارد.
