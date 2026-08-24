# عقد إشارات استخدام Android في سكينة

هذا الملف يحدد الإشارات العامة وبيانات التوافق التي يجهزها تطبيق Android. لا ينشئ endpoint ولا جدولًا ولا RPC، ولا يغير أي نظام قائم. بعد اعتماد endpoint الخادمي الرسمي، يرسل التطبيق الإشارات عبر جلسة Supabase الحالية فقط وبصيغة العقد المحددة هنا.

## الإشارات

| الإشارة | المعنى |
| --- | --- |
| `app_open` | فتح تطبيق سكينة مرة واحدة لكل تشغيل للنسخة الحالية |
| `login_success` | نجاح المصادقة بصورة عامة |
| `login_failed` | فشل تسجيل الدخول بصورة عامة |
| `conversation_started` | إنشاء محادثة جديدة فعليًا |
| `sakina_request_success` | اكتمال طلب سكينة AI بنجاح |
| `sakina_request_failed` | فشل طلب سكينة AI |
| `share_created` | اكتمال إنشاء رابط مشاركة |
| `app_error` | خطأ تقني مصنف باسم النوع فقط |

## الحقول

```text
clientEventId (UUID عشوائي مستقل لكل إشارة)
event
occurredAt
manufacturer
model
androidVersion
sdkVersion
appVersion
channel
connectionType
language
errorClass (اختياري، اسم النوع فقط)
```

لا تحتوي الإشارة على البريد، الاسم، رقم الهاتف، User ID، Session ID، JWT، كلمة المرور، التوكنات، نصوص الرسائل، ردود سكينة AI، الصور، الصوت، الروابط الخاصة، رموز المشاركة، الموقع، IMEI، رقم الشريحة، الرقم التسلسلي، MAC address، Advertising ID، أو قائمة التطبيقات.

## حالة النقل

طبقة Android في `src/services/android-usage-signals.ts` ترفض الإرسال خارج Android، وتولد `clientEventId` عشوائيًا لكل إشارة، وتستخدم transport الرسمي المصادق إلى `https://sakeenah-console.vercel.app/api/telemetry/events`. يعتمد النقل على `getCurrentSession()` من عميل Supabase الحالي ويرسل Bearer JWT في رأس الطلب فقط؛ لا يدخل JWT أو أي معرف جلسة في جسم الإشارة. التكرار آمن لأن الخادم يعامل إعادة نفس `clientEventId` كإشارة مكررة مقبولة.

يجب أن يكون فشل الإشارات أو عدم وجود الإنترنت غير مؤثر في تسجيل الدخول أو المحادثات أو المشاركة أو أي تدفق قائم.
