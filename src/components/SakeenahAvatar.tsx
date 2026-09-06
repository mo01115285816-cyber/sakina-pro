import { useEffect, useRef, useCallback, useState } from "react";

/**
 * SakeenahAvatar — مكون مجسم سكينة
 *
 * يحمّل مجسم سكينة (sakeenah-avatar.html) في iframe واحد ويحتفظ به محمّلاً.
 * تبديل الحركة رخيص جداً (مجرد postMessage)، لكن إنشاء الـ iframe مكلف.
 *
 * الاستخدام:
 *   <SakeenahAvatar animation="idle" size={240} />
 *   <SakeenahAvatar animation="thinking" size={32} />
 *
 * Props:
 *   animation: 'idle' | 'thinking' | 'happy' | ...
 *   size: الحجم بالبكسل (مربع)
 *   className: classes إضافية
 */

interface SakeenahAvatarProps {
  animation?: string;
  size?: number;
  className?: string;
}

// مثال واحد فقط لكل الصفحة (Single Instance Rule)
let globalIframeRef: HTMLIFrameElement | null = null;
let globalCurrentAnimation = "idle";

export function setSakeenahAnimation(anim: string) {
  globalCurrentAnimation = anim;
  if (globalIframeRef?.contentWindow) {
    try {
      globalIframeRef.contentWindow.postMessage({ anim }, "*");
    } catch {
      // iframe قد لا يكون جاهزاً بعد — تجاهل بصمت
    }
  }
}

export default function SakeenahAvatar({
  animation = "idle",
  size = 240,
  className = "",
}: SakeenahAvatarProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);

  // تحديث الـ global ref
  useEffect(() => {
    globalIframeRef = iframeRef.current;
    return () => {
      if (globalIframeRef === iframeRef.current) {
        globalIframeRef = null;
      }
    };
  }, []);

  // إرسال الحركة عند تغييرها
  useEffect(() => {
    if (loaded && iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage({ anim: animation }, "*");
      } catch {
        // تجاهل
      }
    }
    globalCurrentAnimation = animation;
  }, [animation, loaded]);

  // استقبال رسائل من الـ iframe (للdebugging لو احتجنا)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.sakeenahReady) {
        setLoaded(true);
        // أرسل الحركة الحالية بعد جاهزية الـ iframe
        if (iframeRef.current?.contentWindow) {
          try {
            iframeRef.current.contentWindow.postMessage({ anim: globalCurrentAnimation }, "*");
          } catch {
            // تجاهل
          }
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // بناء URL للـ iframe
  const avatarUrl = `${import.meta.env.BASE_URL || "./"}sakeenah-avatar.html`;

  return (
    <iframe
      ref={iframeRef}
      src={avatarUrl}
      title="مجسم سكينة"
      width={size}
      height={size}
      frameBorder={0}
      scrolling="no"
      className={`pointer-events-none select-none ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        border: "none",
        background: "transparent",
        display: "block",
        overflow: "hidden",
      }}
      onLoad={() => {
        setLoaded(true);
        // أرسل الحركة الأولية بعد تحميل الـ iframe
        if (iframeRef.current?.contentWindow) {
          try {
            iframeRef.current.contentWindow.postMessage({ anim: animation }, "*");
          } catch {
            // تجاهل
          }
        }
      }}
      allow="transparent"
    />
  );
}
