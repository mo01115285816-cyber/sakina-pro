import { useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowRight } from "lucide-react";
import SakeenahLineSpinner from "@/components/SakeenahLineSpinner";
import SakeenahAvatar from "@/components/SakeenahAvatar";
import {
  signInWithGoogle,
} from "@/services/auth-service";
import { trackAndroidUsageSignal } from "@/services/android-usage-signals";

type LegalView = "terms" | "privacy";

interface AuthScreenProps {
  onBack?: () => void;
  onAuthenticated?: (user: User) => void;
}

function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "تعذر تسجيل الدخول. حاول مرة أخرى.";
  if (normalized.includes("rate limit")) return "تم تجاوز عدد المحاولات المسموح بها مؤقتًا. حاول بعد قليل.";
  if (normalized.includes("supabase")) return "إعداد المصادقة غير مكتمل. راجع إعدادات الاتصال ثم حاول مرة أخرى.";
  return "تعذر إتمام العملية الآن. حاول مرة أخرى.";
}

export default function AuthScreen({ onBack, onAuthenticated }: AuthScreenProps) {
  const [legalView, setLegalView] = useState<LegalView | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch (authError) {
      void trackAndroidUsageSignal("login_failed", authError instanceof Error ? authError.name : "google_auth_error");
      setError(authErrorMessage(authError));
      setGoogleLoading(false);
    }
  };

  if (legalView) {
    return <LegalDocument view={legalView} onBack={() => setLegalView(null)} />;
  }

  return (
    <main dir="rtl" className="relative min-h-[100dvh] overflow-hidden bg-[#ece7de] text-[#2b1a10]">
      {/* خلفية ambient */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-36 -top-40 h-[420px] w-[420px] rounded-full bg-[#d8b27b]/18 blur-3xl" />
        <div className="absolute -bottom-52 -left-36 h-[500px] w-[500px] rounded-full bg-[#b9a58e]/16 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.03] [background-image:radial-gradient(#2b1a10_0.6px,transparent_0.6px)] [background-size:18px_18px]" />
      </div>

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[440px] flex-col items-center px-5 pb-5 pt-4 sm:px-7 sm:pb-8 sm:pt-5">
        {/* Header */}
        <header className="flex h-10 w-full items-center justify-between">
          <div className="cut-crystal-capsule flex h-10 items-center justify-center px-5 shadow-md">
            <span className="pt-0.5 font-display text-[17px] font-black text-[#2b1a10]">سَكِينَة</span>
          </div>
          <button
            type="button"
            onClick={onBack}
            disabled={!onBack}
            aria-label="رجوع"
            className="cut-crystal-capsule grid h-10 w-10 place-items-center text-[#2b1a10] shadow-md transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88a4f]/45 disabled:cursor-default disabled:opacity-0"
          >
            <ArrowRight size={20} strokeWidth={1.8} className="mr-0.5" />
          </button>
        </header>

        {/* مجسم سكينة — Hero Position */}
        <div className="mt-8 flex justify-center">
          <SakeenahAvatar animation="idle" size={240} />
        </div>

        {/* العنوان */}
        <section className="mt-6 text-center">
          <p className="font-sans text-[12px] font-bold text-[#8a6a3d]">طمأنينة في كل يوم</p>
          <h1 className="mt-1 font-display text-[28px] font-black leading-[1.15] tracking-tight text-[#2b1a10]">
            أهلًا بك في سكينة
          </h1>
        </section>

        {/* خطأ */}
        {error && (
          <p role="alert" className="mt-5 w-full rounded-full border border-[#a66969]/25 bg-[#a66969]/10 px-4 py-2 text-center text-[11px] font-bold leading-5 text-[#7d3f3f]">
            {error}
          </p>
        )}

        {/* زر Google — الطريقة الوحيدة */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="cut-crystal-capsule mt-6 flex h-12 w-full max-w-[320px] items-center justify-center gap-3 rounded-full bg-[#f7f2ea]/70 px-5 text-[14px] font-black text-[#2b1a10] shadow-[0_10px_28px_-12px_rgba(43,26,16,0.35)] transition-[transform,background-color,box-shadow] duration-200 hover:bg-[#fffdf9] hover:shadow-[0_14px_32px_-12px_rgba(43,26,16,0.42)] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88a4f]/45 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {googleLoading ? (
            <SakeenahLineSpinner size={20} color="#b88a4f" label="جارٍ فتح Google" />
          ) : (
            <GoogleIcon />
          )}
          المتابعة باستخدام Google
        </button>

        {/* Footer */}
        <footer className="mt-auto pt-6 text-center text-[10px] leading-5 text-[#8a7d70]">
          بتسجيل الدخول، أنت توافق على{" "}
          <button type="button" onClick={() => setLegalView("terms")} className="underline underline-offset-2">الشروط</button>
          {" "}و{" "}
          <button type="button" onClick={() => setLegalView("privacy")} className="underline underline-offset-2">سياسة الخصوصية</button>
        </footer>
      </div>
    </main>
  );
}

function LegalDocument({ view, onBack }: { view: LegalView; onBack: () => void }) {
  const isTerms = view === "terms";

  return (
    <main dir="rtl" className="min-h-[100dvh] overflow-y-auto bg-[#ece7de] text-[#2b1a10]">
      <div className="mx-auto min-h-[100dvh] w-full max-w-[440px] px-5 pb-10 pt-5 sm:px-7">
        <header className="flex items-center justify-between">
          <div className="cut-crystal-capsule flex h-10 items-center justify-center px-5 shadow-md">
            <span className="pt-0.5 font-display text-[17px] font-black text-[#2b1a10]">سَكِينَة</span>
          </div>
          <button type="button" onClick={onBack} aria-label="رجوع" className="cut-crystal-capsule grid h-10 w-10 place-items-center text-[#2b1a10] shadow-md transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88a4f]/45">
            <ArrowRight size={20} strokeWidth={1.8} className="mr-0.5" />
          </button>
        </header>

        <section className="mt-9 text-right">
          <p className="text-[12px] font-bold text-[#8a6a3d]">سكينة · وضوح وطمأنينة</p>
          <h1 className="mt-2 font-display text-[30px] font-black leading-tight text-[#2b1a10]">{isTerms ? "شروط الاستخدام" : "سياسة الخصوصية"}</h1>
          <p className="mt-3 text-[13px] leading-7 text-[#6f6257]">آخر تحديث: ١٦ أغسطس ٢٠٢٦</p>
        </section>

        <article className="mt-7 space-y-6 text-[14px] leading-8 text-[#4f443a]">
          {isTerms ? <TermsContent /> : <PrivacyContent />}
        </article>
      </div>
    </main>
  );
}

function TermsContent() {
  return (
    <>
      <LegalSection title="مرحبًا بك في سكينة" text="سكينة تطبيق إسلامي صُمم ليكون رفيقًا هادئًا في القرآن والأذكار ومواقيت الصلاة. باستخدام التطبيق، تقرأ هذه الشروط وتوافق على الالتزام بها." />
      <LegalSection title="الاستخدام المسؤول" text="تستخدم سكينة باحترام ولغرض شخصي مشروع. لا يجوز العبث بالخدمة، أو محاولة الوصول إلى حسابات الآخرين، أو تعطيل التطبيق، أو استخدامه لإرسال محتوى مؤذٍ أو مسيء أو مخالف للأنظمة." />
      <LegalSection title="المحتوى الإسلامي" text="المحتوى المعروض وُضع للتذكير والمساعدة اليومية، ولا يغني عن سؤال أهل العلم الموثوقين في المسائل الشرعية الخاصة. مواقيت الصلاة حسابات مساعدة وقد تحتاج إلى مراجعة إعدادات بلدك أو الجهة المحلية المعتمدة." />
      <LegalSection title="الحساب وتسجيل الدخول" text="عند تسجيل الدخول عبر Google، تطبق كذلك شروط Google المتعلقة بحسابك." />
      <LegalSection title="احترام الناس وحسن المعاملة" text="نؤمن أن التقنية التي تخدم الطمأنينة يجب أن تُستخدم بأدب. نرفض الإساءة والتنمر والتحريض وانتهاك خصوصية الآخرين، ونحتفظ بحق حماية الخدمة من أي استخدام يضر بالمستخدمين." />
      <LegalSection title="التحديثات والتوافر" text="قد نطوّر المحتوى أو الواجهة أو نحدّث هذه الشروط لتحسين سكينة. سنعرض النسخة الأحدث داخل التطبيق، وقد تتوقف بعض الوظائف مؤقتًا بسبب الصيانة أو اعتمادها على خدمات خارجية." />
      <LegalSection title="التواصل" text="إذا لاحظت مشكلة في الحساب أو السلوك أو المحتوى، استخدم قناة التواصل الرسمية المرتبطة بالمشروع عند توفرها، واذكر التفاصيل الضرورية فقط دون إرسال كلمات السر أو رموز الدخول." />
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <LegalSection title="خصوصيتك أولًا" text="صُممت سكينة على مبدأ تقليل البيانات. لا نبيع بياناتك، ولا نستخدم معلومات الحساب لبناء ملفات إعلانية أو لتتبعك عبر تطبيقات أخرى." />
      <LegalSection title="ما الذي نحتاجه؟" text="عند إنشاء حساب عبر Google، يحتفظ نظام المصادقة بالبيانات اللازمة للحساب. نستخدمها لإتمام تسجيل الدخول وعرض حسابك داخل التطبيق." />
      <LegalSection title="الموقع وإعدادات الصلاة" text="قد يطلب التطبيق الموقع لتحديد المدينة ومواقيت الصلاة عند تفعيل تحديد الموقع. تُستخدم إعدادات المدينة والمواقيت لتشغيل الوظيفة المطلوبة، ولا نبيع سجل موقعك أو نستخدمه للإعلانات." />
      <LegalSection title="التخزين والأمان" text="تُحفظ جلسة الدخول عبر أدوات Supabase، ويستخدم Android التخزين الآمن المتاح في التطبيق." />
      <LegalSection title="ما لا نفعله" text="لا نبيع معلوماتك، ولا نؤجرها، ولا نشاركها لأغراض تسويقية. لا تطلب سكينة منك كلمات السر أو رموز Google عبر الرسائل. لا تضع أي بيانات حساسة داخل المحادثات أو الحقول غير المخصصة لها." />
      <LegalSection title="اختياراتك" text="يمكنك تسجيل الخروج من داخل التطبيق، كما يمكنك إيقاف إذن الموقع من إعدادات الهاتف." />
      <LegalSection title="تغييرات السياسة" text="إذا تغيّرت طريقة معالجة البيانات، سنحدّث هذه الصفحة داخل التطبيق ونوضح تاريخ التحديث. استمرارك في استخدام سكينة بعد التحديث يعني اطلاعك على النص الجديد." />
    </>
  );
}

function LegalSection({ title, text }: { title: string; text: string }) {
  return (
    <section>
      <h2 className="font-display text-[20px] font-black text-[#2b1a10]">{title}</h2>
      <p className="mt-2">{text}</p>
    </section>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.12A6.94 6.94 0 0 1 5.47 12c0-.74.13-1.45.36-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.96l3.66-2.84z" />
      <path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 1.5 14.97.5 12 .5 7.7.5 3.99 2.97 2.18 6.54l3.66 2.84C6.71 6.68 9.14 4.75 12 4.75z" />
    </svg>
  );
}
