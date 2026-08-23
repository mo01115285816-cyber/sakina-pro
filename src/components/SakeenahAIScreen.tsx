import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Share as NativeShare } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import { getCurrentSession } from "@/services/auth-service";
import type { AuthUser } from "@/services/auth-service";
import {
  createSakeenahConversation,
  listSakeenahConversations,
  loadSakeenahMessages,
  type StoredConversation,
} from "@/services/sakeenah-ai-storage";
import {
  createSakeenahConversationShare,
  permanentlyDeleteSakeenahConversation,
  pinSakeenahConversation,
  revokeSakeenahConversationShare,
  renameSakeenahConversation,
  type ConversationShareResult,
} from "@/services/sakeenah-sharing";
import { supabaseKey, supabaseUrl } from "@/services/supabase-client";
import { trackAndroidUsageSignal } from "@/services/android-usage-signals";
import SakeenahLineSpinner from "@/components/SakeenahLineSpinner";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowUp,
  ChevronRight,
  MessageCirclePlus,
  PanelLeftOpen,
  X,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check,
  Copy,
  Pencil,
  ThumbsUp,
  ThumbsDown,
  MoreVertical,
  Pin,
  Share2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";


type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isNew?: boolean;
  isStreaming?: boolean;
};

type SakeenahAIScreenProps = {
  onBack: () => void;
  user: AuthUser;
  initialConversationId?: string | null;
  onInitialConversationConsumed?: () => void;
};

type WelcomeLine = {
  title: string;
  subtitle: string;
};

const welcomeLines: WelcomeLine[] = [
  { title: "ما الذي تحب أن تعرفه اليوم؟", subtitle: "اسأل بهدوء عن القرآن أو الأذكار أو أحكام العبادة." },
  { title: "كيف نعين قلبك اليوم؟", subtitle: "ابدأ بسؤال شرعي واضح، وسنمضي فيه خطوة خطوة." },
  { title: "في أي أمر شرعي نبدأ معًا؟", subtitle: "مساحة هادئة للتعلّم والتدبّر وحسن الفهم." },
];

const getInitialWelcomeLineIndex = () => {
  const previous = Number.parseInt(localStorage.getItem("sakeenah_ai_welcome_line_index") ?? "-1", 10);
  return Number.isInteger(previous) && previous >= 0
    ? (previous + 1) % welcomeLines.length
    : 0;
};

const CodeBlock = ({ children }: { children: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 overflow-hidden border border-[#e6dccf] bg-[#fdfcfb] rounded-[22px] shadow-sm text-left" style={{ direction: 'ltr' }}>
      <div className="flex items-center justify-between px-4 py-2 bg-[#f5ebd9] border-b border-[#e6dccf] text-[#7f6a55] select-none">
        <span className="text-[10px] font-mono font-bold tracking-wider">CODE / TEXT</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[#7f6a55] hover:text-[#b88a4f] transition-colors p-1 rounded-md cursor-pointer"
        >
          {copied ? <Check size={12} className="text-[#b88a4f]" /> : <Copy size={12} />}
          <span className="text-[10px] font-bold">{copied ? "Copied!" : "Copy"}</span>
        </button>
      </div>
      <pre className="p-4 overflow-x-auto font-mono text-[12.5px] text-[#2b1a10] leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
};

const markdownComponents = {
  h3: ({ children }: any) => (
    <h3 className="text-[16px] font-display font-display font-black text-[#2b1a10] mt-4 mb-2 text-right">
      {children}
    </h3>
  ),
  h4: ({ children }: any) => (
    <h4 className="text-[15px] font-display font-display font-black text-[#2b1a10] mt-3 mb-1 text-right">
      {children}
    </h4>
  ),
  p: ({ children }: any) => (
    <p 
      className="text-[14px] font-sans leading-relaxed text-[#2b1a10] mb-2 text-right break-words whitespace-pre-wrap"
      dir="auto"
      style={{ unicodeBidi: "plaintext" }}
    >
      {children}
    </p>
  ),
  strong: ({ children }: any) => (
    <strong className="font-display font-black text-[#2b1a10]">
      {children}
    </strong>
  ),
  a: ({ href, children }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      referrerPolicy="no-referrer"
      className="text-[#b88a4f] underline font-bold hover:text-[#deab65] transition-colors inline"
    >
      {children}
    </a>
  ),
  ul: ({ children }: any) => (
    <ul className="space-y-1.5 mb-3 list-none pr-1">
      {children}
    </ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal list-inside space-y-1.5 mb-3 pr-2 text-right">
      {children}
    </ol>
  ),
  li: ({ children, ordered }: any) => {
    if (ordered) {
      return (
        <li 
          className="text-[14px] font-sans leading-relaxed text-[#2b1a10] my-0.5 text-right inline-block w-full"
          dir="auto"
          style={{ unicodeBidi: "plaintext" }}
        >
          {children}
        </li>
      );
    }
    return (
      <li 
        className="flex items-start gap-2 text-[14px] font-sans leading-relaxed text-[#2b1a10] my-0.5"
        dir="auto"
        style={{ unicodeBidi: "plaintext" }}
      >
        <span className="text-[#b88a4f] mt-1.5 shrink-0 select-none text-[8px]">●</span>
        <span className="flex-1 text-right">{children}</span>
      </li>
    );
  },
  code: ({ className, children, ...props }: any) => {
    const isBlock = typeof children === 'string' && children.includes('\n');
    if (isBlock) {
      return <CodeBlock>{children}</CodeBlock>;
    }
    return (
      <code className="bg-[#f5ebd9] border border-[#e6dccf] rounded-lg px-1.5 py-0.5 mx-0.5 font-mono text-[12.5px] text-[#2b1a10]">
        {children}
      </code>
    );
  },
  blockquote: ({ children }: any) => (
    <blockquote className="border-r-4 border-[#b88a4f] pr-3 my-3 italic text-[#7f6a55] text-right bg-[#f7f2ea]/40 py-1 rounded-l-md">
      {children}
    </blockquote>
  ),
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-3 border border-[#e6dccf] rounded-xl">
      <table className="w-full text-right border-collapse text-[13px]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: any) => <thead className="bg-[#f7f2ea] text-[#2b1a10] font-display font-black">{children}</thead>,
  tbody: ({ children }: any) => <tbody className="divide-y divide-[#e6dccf]/60">{children}</tbody>,
  tr: ({ children }: any) => <tr className="hover:bg-white/40 transition-colors">{children}</tr>,
  th: ({ children }: any) => <th className="p-2.5 font-display font-black border-b border-[#e6dccf]">{children}</th>,
  td: ({ children }: any) => <td className="p-2.5 font-sans text-[#2b1a10]/90">{children}</td>,
};

const MarkdownRenderer = ({ content, animate = false, onComplete }: { content: string; animate?: boolean; onComplete?: () => void }) => {
  const [displayedText, setDisplayedText] = useState(animate ? "" : content);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!animate) {
      setDisplayedText(content);
      return;
    }

    const words = content.split(" ");
    let currentIdx = 0;
    
    setDisplayedText(words.slice(0, 1).join(" "));
    
    const interval = setInterval(() => {
      currentIdx++;
      if (currentIdx < words.length) {
        setDisplayedText(words.slice(0, currentIdx + 1).join(" "));
      } else {
        clearInterval(interval);
        onCompleteRef.current?.();
      }
    }, 35);

    return () => clearInterval(interval);
  }, [content, animate]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={markdownComponents as any}
    >
      {displayedText}
    </ReactMarkdown>
  );
};

// Clean Markdown and other non-spoken markers for high-quality Arabic Speech Synthesis
const cleanArabicTextForSpeech = (rawText: string) => {
  let text = rawText;
  
  // Strip code blocks completely
  text = text.replace(/```[\s\S]*?```/g, "");
  
  // Strip inline code
  text = text.replace(/`([^`]+)`/g, "$1");
  
  // Strip bold/italic markdown characters
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  
  // Strip markdown links [text](url) -> only keep text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  
  // Strip bullet points, list items symbols, headings
  text = text.replace(/^[#\-\*\+\●\s]+/gm, "");
  
  // Strip HTML tags if any
  text = text.replace(/<[^>]*>/g, "");
  
  // Trim spaces and normalize whitespace
  return text.trim();
};

export const SakeenahAIScreen = React.memo(function SakeenahAIScreen({ onBack, user, initialConversationId, onInitialConversationConsumed }: SakeenahAIScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, "like" | "dislike">>({});
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [copiedResponseId, setCopiedResponseId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isMultiline, setIsMultiline] = useState(false);
  const [longMsgs, setLongMsgs] = useState<Set<string>>(new Set());
  const [expandedMsgs, setExpandedMsgs] = useState<Set<string>>(new Set());
  const [welcomeLineIndex] = useState(getInitialWelcomeLineIndex);
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isConversationsLoading, setIsConversationsLoading] = useState(true);
  const [isConversationLoading, setIsConversationLoading] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [openConversationMenuId, setOpenConversationMenuId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<StoredConversation | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<StoredConversation | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [shareResult, setShareResult] = useState<{ conversation: StoredConversation; result: ConversationShareResult } | null>(null);

  useEffect(() => {
    localStorage.setItem("sakeenah_ai_welcome_line_index", String(welcomeLineIndex));
  }, [welcomeLineIndex]);

  const refreshConversations = useCallback(async () => {
    const next = await listSakeenahConversations();
    setConversations(next);
    return next;
  }, []);

  const openConversation = useCallback(async (conversationId: string) => {
    if (isLoading) return;
    setIsConversationLoading(true);
    setStorageError(null);
    try {
      const storedMessages = await loadSakeenahMessages(conversationId);
      setMessages(storedMessages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        isNew: false,
        isStreaming: false,
      })));
      setActiveConversationId(conversationId);
      setIsDrawerOpen(false);
      cancelEditingUserMessage();
    } catch (error) {
      console.error("Failed to load Sakeenah conversation", error);
      setStorageError("تعذر فتح هذه المحادثة حاليًا.");
    } finally {
      setIsConversationLoading(false);
    }
  }, [isLoading]);

  useEffect(() => {
    let cancelled = false;
    setIsConversationsLoading(true);
    setMessages([]);
    setActiveConversationId(null);
    void refreshConversations()
      .catch((error) => {
        console.error("Failed to load Sakeenah conversations", error);
        if (!cancelled) setStorageError("تعذر تحميل المحادثات المحفوظة.");
      })
      .finally(() => {
        if (!cancelled) setIsConversationsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshConversations]);

  useEffect(() => {
    if (!initialConversationId) return;
    void openConversation(initialConversationId)
      .then(() => onInitialConversationConsumed?.())
      .catch((error) => console.error("Failed to open forked Sakeenah conversation", error));
  }, [initialConversationId, onInitialConversationConsumed, openConversation]);

  const startNewConversation = useCallback(() => {
    if (isLoading) return;
    setMessages([]);
    setActiveConversationId(null);
    setStorageError(null);
    cancelEditingUserMessage();
    setIsDrawerOpen(false);
  }, [isLoading]);

  const handleDeleteConversation = useCallback(async (conversationId: string) => {
    if (isLoading || actionLoading) return;
    setActionLoading(true);
    try {
      await permanentlyDeleteSakeenahConversation(conversationId);
      const next = await refreshConversations();
      setDeleteTarget(null);
      setOpenConversationMenuId(null);
      setStorageError(null);
      if (activeConversationId === conversationId) {
        if (next[0]) await openConversation(next[0].id);
        else startNewConversation();
      }
    } catch (error) {
      console.error("Failed to delete Sakeenah conversation", error);
      setStorageError("تعذر حذف المحادثة نهائيًا حاليًا.");
    } finally {
      setActionLoading(false);
    }
  }, [actionLoading, activeConversationId, isLoading, openConversation, refreshConversations, startNewConversation]);

  const handleShareConversation = useCallback(async (conversation: StoredConversation) => {
    if (actionLoading) return;
    setActionLoading(true);
    setOpenConversationMenuId(null);
    setStorageError("جاري إنشاء رابط مشاركة متاح للجميع...");
    try {
      const result = await createSakeenahConversationShare(conversation.id);
      void trackAndroidUsageSignal("share_created");
      setShareResult({ conversation, result });
      setStorageError("تم إنشاء رابط المشاركة. يمكنك مشاركته الآن.");

      try {
        if (Capacitor.isNativePlatform()) {
          await NativeShare.share({
            title: conversation.title,
            text: `محادثة سكينة AI: ${conversation.title}`,
            url: result.url,
            dialogTitle: "مشاركة المحادثة",
          });
        } else if (typeof navigator.share === "function") {
          await navigator.share({
            title: conversation.title,
            text: `محادثة سكينة AI: ${conversation.title}`,
            url: result.url,
          });
        } else {
          await navigator.clipboard?.writeText(result.url);
        }
      } catch (shareError) {
        // إلغاء ورقة المشاركة الرسمية لا يعني فشل إنشاء الرابط؛ يبقى الرابط ظاهرًا في البطاقة.
        console.info("Share sheet closed", shareError);
      }
    } catch (error) {
      console.error("Failed to share Sakeenah conversation", error);
      setStorageError("تعذر إنشاء رابط المشاركة حاليًا. حاول مرة أخرى.");
    } finally {
      setActionLoading(false);
    }
  }, [actionLoading]);

  const handleRevokeShare = useCallback(async () => {
    if (!shareResult || actionLoading) return;
    setActionLoading(true);
    try {
      await revokeSakeenahConversationShare(shareResult.conversation.id);
      setShareResult(null);
      setStorageError("تم إلغاء رابط المشاركة.");
    } catch (error) {
      console.error("Failed to revoke Sakeenah conversation share", error);
      setStorageError("تعذر إلغاء رابط المشاركة حاليًا.");
    } finally {
      setActionLoading(false);
    }
  }, [actionLoading, shareResult]);

  const handlePinConversation = useCallback(async (conversation: StoredConversation) => {
    if (actionLoading) return;
    setActionLoading(true);
    setOpenConversationMenuId(null);
    try {
      const pinned = !conversation.pinnedAt;
      await pinSakeenahConversation(conversation.id, pinned);
      await refreshConversations();
      setStorageError(null);
    } catch (error) {
      console.error("Failed to pin Sakeenah conversation", error);
      setStorageError("تعذر تثبيت المحادثة حاليًا.");
    } finally {
      setActionLoading(false);
    }
  }, [actionLoading, refreshConversations]);

  const openRenameConversation = useCallback((conversation: StoredConversation) => {
    setOpenConversationMenuId(null);
    setRenameTarget(conversation);
    setRenameValue(conversation.title);
  }, []);

  const handleRenameConversation = useCallback(async () => {
    if (!renameTarget || !renameValue.trim() || actionLoading) return;
    setActionLoading(true);
    try {
      await renameSakeenahConversation(renameTarget.id, renameValue.trim());
      await refreshConversations();
      setRenameTarget(null);
      setRenameValue("");
      setStorageError(null);
    } catch (error) {
      console.error("Failed to rename Sakeenah conversation", error);
      setStorageError("تعذر إعادة تسمية المحادثة حاليًا.");
    } finally {
      setActionLoading(false);
    }
  }, [actionLoading, refreshConversations, renameTarget, renameValue]);

  const userName = useMemo(() => {
    const label = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "صديق سكينة").trim();
    return label.split(/\s+/)[0] || "صديق سكينة";
  }, [user]);


  // Auto-resize the textarea — professional scrollHeight approach
  const adjustTextareaHeight = useCallback(() => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    el.style.height = 'auto';
    const scrollH = el.scrollHeight;
    const newH = Math.max(38, Math.min(scrollH, 130));
    el.style.height = `${newH}px`;
    setIsMultiline(scrollH > 38 || inputValue.includes("\n"));
  }, [inputValue]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [adjustTextareaHeight]);

  // Auto-detect long messages
  useEffect(() => {
    const newLongMsgs = new Set<string>();
    messages.forEach(m => {
      if (m.role === 'user' && (m.content.length > 110 || m.content.split("\n").length > 3)) {
        newLongMsgs.add(m.id);
      }
    });
    setLongMsgs(newLongMsgs);
  }, [messages]);

  const toggleExpand = useCallback((msgId: string) => {
    setExpandedMsgs(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
      return next;
    });
  }, []);

  // Find the last assistant message index
  const lastAssistantMessageIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  }, [messages]);

  const lastUserMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i].id;
    }
    return null;
  }, [messages]);

  const hasStreamingAssistantMessage = useMemo(
    () => messages.some((message) => message.role === "assistant" && message.isStreaming),
    [messages]
  );

  // Copy helper
  const handleCopyMsgContent = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedResponseId(msgId);
    setTimeout(() => setCopiedResponseId(null), 2000);
  };

  // Text-To-Speech helper — fixed: waits for voices to load asynchronously
  const [ttsReady, setTtsReady] = useState(false);
  const [arabicVoice, setArabicVoice] = useState<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const synth = window.speechSynthesis;

    const loadVoices = () => {
      const voices = synth.getVoices();
      const ar = voices.find(v => v.lang.startsWith("ar")) || null;
      setArabicVoice(ar);
      setTtsReady(true);
    };

    // Chrome loads voices async
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }
    // Firefox & some browsers have voices ready immediately
    loadVoices();

    return () => { synth.onvoiceschanged = null; };
  }, []);

  const handleSpeech = useCallback((msgId: string, text: string) => {
    console.log('[TTS] === CLICK === msgId:', msgId, 'currentSpeaking:', speakingMsgId);

    const synth = window.speechSynthesis;
    if (!synth) {
      console.log('[TTS] FAIL: speechSynthesis not available');
      return;
    }
    console.log('[TTS] voices loaded:', synth.getVoices().length, 'speaking:', synth.speaking, 'pending:', synth.pending);

    // Toggle off if same message
    if (speakingMsgId === msgId) {
      console.log('[TTS] STOP requested');
      synth.cancel();
      setSpeakingMsgId(null);
      if (navigator.vibrate) navigator.vibrate(50);
      return;
    }

    // Clean text
    const clean = cleanArabicTextForSpeech(text);
    console.log('[TTS] cleaned text length:', clean.length, 'preview:', clean.substring(0, 60));
    if (!clean) {
      console.log('[TTS] FAIL: no text after cleaning');
      return;
    }

    // Cancel any current speech
    if (synth.speaking || synth.pending) {
      console.log('[TTS] cancelling current speech');
      synth.cancel();
    }

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'ar';
    utterance.rate = 0.9;
    utterance.volume = 1;
    if (arabicVoice) {
      utterance.voice = arabicVoice;
      console.log('[TTS] voice:', arabicVoice.name, arabicVoice.lang);
    } else {
      console.log('[TTS] WARNING: no Arabic voice available');
    }

    utterance.onstart = () => {
      console.log('[TTS] STARTED');
      setSpeakingMsgId(msgId);
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    };
    utterance.onend = () => {
      console.log('[TTS] ENDED');
      setSpeakingMsgId(null);
    };
    utterance.onerror = (e) => {
      console.error('[TTS] ERROR:', e);
      setSpeakingMsgId(null);
    };

    // CRITICAL FIX: use requestAnimationFrame instead of setTimeout
    // - Chrome: cancel() needs next frame before speak() works
    // - Safari: requestAnimationFrame stays within user gesture window (~5s)
    // - setTimeout would break Safari's user gesture requirement
    requestAnimationFrame(() => {
      console.log('[TTS] calling speak()');
      synth.speak(utterance);
      console.log('[TTS] speak() done - speaking:', synth.speaking, 'pending:', synth.pending);
    });
  }, [speakingMsgId, arabicVoice]);

  // Cancel speech on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Retry/Regenerate last message
  const handleRetry = () => {
    const userMsgs = messages.filter(msg => msg.role === "user");
    if (userMsgs.length > 0) {
      const lastUserText = userMsgs[userMsgs.length - 1].content;
      setMessages(prev => {
        const cleaned = [...prev];
        const lastAiIdx = cleaned.map(msg => msg.role).lastIndexOf("assistant");
        if (lastAiIdx !== -1) {
          cleaned.splice(lastAiIdx, 1);
        }
        return cleaned;
      });
      handleSendMessage(lastUserText);
    }
  };

  // Auto scroll to bottom of chat safely using direct container scrolling
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (text: string, replaceUserMessageId?: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const replaceIndex = replaceUserMessageId
      ? messages.findIndex((message) => message.id === replaceUserMessageId && message.role === "user")
      : -1;

    if (replaceUserMessageId && replaceIndex === -1) return;

    const userMsg: Message = {
      id: replaceUserMessageId || Math.random().toString(),
      role: "user",
      content: trimmed,
      timestamp: new Date()
    };

    const historyMessages = replaceUserMessageId
      ? [...messages.slice(0, replaceIndex), userMsg]
      : [...messages, userMsg];

    setMessages((prev) => {
      if (!replaceUserMessageId) return [...prev, userMsg];

      const currentIndex = prev.findIndex((message) => message.id === replaceUserMessageId && message.role === "user");
      return currentIndex === -1 ? prev : [...prev.slice(0, currentIndex), userMsg];
    });
    setInputValue("");
    setIsLoading(true);

    const aiMsgId = Math.random().toString();

    try {
      let conversationId = activeConversationId;
      if (!conversationId) {
        const created = await createSakeenahConversation(trimmed.slice(0, 56));
        void trackAndroidUsageSignal("conversation_started");
        conversationId = created.id;
        setActiveConversationId(created.id);
        setConversations((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      }

      const normalizedSupabaseUrl = supabaseUrl?.replace(/\/$/, "");
      if (!normalizedSupabaseUrl || !supabaseKey) {
        throw new Error("لم يتم إعداد اتصال Supabase لوظائف سَكِينَة AI.");
      }

      const session = await getCurrentSession();
      if (!session?.access_token) {
        throw new Error("يجب تسجيل الدخول أولًا لاستخدام سكينة AI.");
      }

      const res = await fetch(`${normalizedSupabaseUrl}/functions/v1/sakeenah-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ conversationId, message: trimmed, stream: true }),
      });

      if (!res.ok) {
        throw new Error("Failed to call Sakeenah AI");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      if (!reader) {
        throw new Error("Response body is not readable");
      }

      const aiMsg: Message = {
        id: aiMsgId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isNew: false,
        isStreaming: true
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsLoading(false);

      let accumulatedContent = "";
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          if (trimmedLine.startsWith("data: ")) {
            const dataStr = trimmedLine.slice(6);
            if (dataStr === "[DONE]") {
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.text) {
                accumulatedContent += parsed.text;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMsgId ? { ...msg, content: accumulatedContent } : msg
                  )
                );
              }
            } catch (e) {
              console.error("Error parsing stream chunk:", e, trimmedLine);
            }
          }
        }
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg
        )
      );
      setStorageError(null);
      void trackAndroidUsageSignal("sakina_request_success");
      await refreshConversations();

    } catch (error) {
      console.error("Sakeenah AI error:", error);
      void trackAndroidUsageSignal("sakina_request_failed", error instanceof Error ? error.name : "request_error");
      setMessages((prev) => {
        const index = prev.findIndex((m) => m.id === aiMsgId);
        if (index !== -1) {
          if (prev[index].content.trim()) {
            return prev.map((msg) =>
              msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg
            );
          } else {
            const cleaned = prev.filter((m) => m.id !== aiMsgId);
            const errorMsg: Message = {
              id: Math.random().toString(),
              role: "assistant",
              content: "عذراً، حدث خطأ أثناء بث الإجابة. يرجى المحاولة مرة أخرى.",
              timestamp: new Date()
            };
            return [...cleaned, errorMsg];
          }
        } else {
          const errorMsg: Message = {
            id: Math.random().toString(),
            role: "assistant",
            content: "عذراً، لم أتمكن من الاتصال بالخادم الشرعي حالياً. يرجى التأكد من اتصالك بالإنترنت والمحاولة مجدداً.",
            timestamp: new Date()
          };
          return [...prev, errorMsg];
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startEditingUserMessage = (message: Message) => {
    if (isLoading || message.id !== lastUserMessageId) return;
    setEditingMessageId(message.id);
    setEditingContent(message.content);
  };

  const cancelEditingUserMessage = () => {
    setEditingMessageId(null);
    setEditingContent("");
  };

  const confirmEditingUserMessage = () => {
    if (!editingMessageId) return;

    const originalMessage = messages.find((message) => message.id === editingMessageId && message.role === "user");
    if (!originalMessage || editingContent === originalMessage.content || !editingContent.trim()) return;

    const messageId = editingMessageId;
    cancelEditingUserMessage();
    void handleSendMessage(editingContent, messageId);
  };

  return (
    <div dir="rtl" className="mx-auto w-full max-w-[390px] px-5 pt-0 pb-4 font-sans bg-[#ece7de] h-screen relative flex flex-col overflow-hidden">
      
      {/* Background soft ambient shapes */}
      <div className="absolute top-[-20%] right-[-10%] w-[300px] h-[300px] bg-[#b88a4f]/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[250px] h-[250px] bg-[#deab65]/5 rounded-full blur-[100px] pointer-events-none" />
        {messages.length === 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[38vh] bg-gradient-to-t from-[#d8b27b]/55 via-[#d8b27b]/20 to-transparent"
            aria-hidden="true"
          />
        )}

      {/* ── FLOATING TOP HEADER ── */}
      <div className="absolute top-6 left-5 right-5 flex items-center justify-between z-[45] pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="w-10 h-10 cut-crystal-capsule rounded-full shadow-md text-[#2b1a10] hover:text-[#b88a4f] hover:border-[#b88a4f]/40 hover:bg-white flex items-center justify-center active:scale-[0.95] transition-all duration-300 cursor-pointer"
            aria-label="فتح المحادثات المحفوظة"
            title="المحادثات المحفوظة"
          >
            <PanelLeftOpen size={17} strokeWidth={2.2} />
          </button>
          <div className="cut-crystal-capsule px-5 h-10 rounded-full shadow-md flex items-center justify-center gap-1.5 transition-all duration-300">
            <span className="text-[14.5px] font-display font-black whitespace-nowrap pt-0.5">سَكِينَة AI</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={startNewConversation}
              className="w-10 h-10 cut-crystal-capsule rounded-full shadow-md text-[#7f6a55] hover:text-[#b88a4f] hover:border-[#b88a4f]/40 hover:bg-white flex items-center justify-center active:scale-[0.95] transition-all duration-300 cursor-pointer"
              aria-label="بدء محادثة جديدة"
              title="محادثة جديدة"
            >
              <MessageCirclePlus size={17} strokeWidth={2.1} />
            </button>
          )}
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 cut-crystal-capsule rounded-full shadow-md text-[#2b1a10] hover:text-[#b88a4f] hover:border-[#b88a4f]/40 hover:bg-white flex items-center justify-center active:scale-[0.95] transition-all duration-300 cursor-pointer"
            aria-label="رجوع"
          >
            <ChevronRight size={18} className="mr-0.5" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.button
              type="button"
              aria-label="إغلاق قائمة المحادثات"
              className="fixed inset-0 z-[55] bg-[#2b1a10]/18 backdrop-blur-[2px] cursor-default"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
            />
            <motion.aside
              dir="rtl"
              className="fixed inset-y-0 right-0 left-auto z-[60] flex w-[min(286px,calc(100vw-16px))] flex-col overflow-hidden rounded-l-[30px] rounded-r-none border border-r-0 border-white/45 shadow-[0_24px_70px_-20px_rgba(43,26,16,0.42)]"
              style={{
                background: "linear-gradient(145deg, rgba(255,255,255,0.28), rgba(184,138,79,0.18))",
                backdropFilter: "blur(28px) saturate(165%)",
                WebkitBackdropFilter: "blur(28px) saturate(165%)",
              }}
              initial={{ opacity: 0, x: 18, scale: 0.995 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 18, scale: 0.995 }}
              transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
            >
              <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#b88a4f]/15 px-4">
                <p className="text-[14px] font-display font-black text-[#2b1a10]">سَكِينَة AI</p>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#7f6a55] transition-colors hover:bg-white hover:text-[#2b1a10] active:scale-95 cursor-pointer"
                  aria-label="إغلاق قائمة المحادثات"
                >
                  <X size={16} />
                </button>
              </div>

              <button
                type="button"
                onClick={startNewConversation}
                className="mx-3 mt-3 flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[#b88a4f] px-4 text-[12px] font-display font-black text-[#fff9f1] shadow-sm transition-all hover:bg-[#a0753e] active:scale-[0.98] cursor-pointer"
              >
                <MessageCirclePlus size={16} />
                <span>محادثة جديدة</span>
              </button>

              <div className="flex-1 overflow-y-auto px-3 pb-4 pt-4 hide-scrollbar">
                {isConversationsLoading || isConversationLoading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-[12px] font-bold text-[#7f6a55]">
                    <SakeenahLineSpinner size={16} color="#b88a4f" label="جارٍ تحميل المحادثات" />
                    <span>جارٍ تحميل المحادثات</span>
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="px-5 py-10 text-center text-[12px] font-bold leading-6 text-[#7f6a55]">
                    لا توجد محادثات محفوظة بعد.
                    <br />ابدأ سؤالًا جديدًا وستظهر هنا.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className={`group relative flex items-center gap-1 rounded-[22px] border px-3 py-2 transition-all ${
                          conversation.id === activeConversationId
                            ? "border-[#b88a4f]/40 bg-[#f7f2ea] shadow-sm"
                            : "border-transparent hover:border-[#b88a4f]/20 hover:bg-[#f7f2ea]/70"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => void openConversation(conversation.id)}
                          className="min-w-0 flex-1 text-right cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5 truncate text-[12px] font-display font-black text-[#2b1a10]">
                            {conversation.pinnedAt && <Pin size={11} className="shrink-0 text-[#b88a4f]" aria-label="مثبتة" />}
                            <span className="truncate">{conversation.title}</span>
                          </span>
                          <span className="mt-1 block text-[10px] font-bold text-[#7f6a55]">
                            {conversation.lastMessageAt.toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenConversationMenuId((current) => current === conversation.id ? null : conversation.id);
                          }}
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all hover:bg-[#f5ebd9]/75 cursor-pointer ${conversation.pinnedAt ? "text-[#b88a4f]" : "text-[#7f6a55]/70 hover:text-[#2b1a10]"}`}
                          aria-label={`إجراءات ${conversation.title}`}
                          title="إجراءات المحادثة"
                        >
                          {conversation.pinnedAt ? <Pin size={15} fill="currentColor" /> : <MoreVertical size={16} />}
                        </button>
                        <AnimatePresence>
                          {openConversationMenuId === conversation.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.96, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.96, y: -4 }}
                              transition={{ duration: 0.12 }}
                              className="!absolute left-2 top-10 z-[70] w-[184px] cut-crystal-panel rounded-[20px] shadow-2xl overflow-hidden p-1.5"
                            >
                              <button type="button" onClick={() => void handleShareConversation(conversation)} className="flex h-9 w-full items-center gap-2 rounded-[14px] px-3 text-right text-[11px] font-bold text-[#2b1a10] transition hover:bg-[#f5ebd9] cursor-pointer">
                                <Share2 size={14} className="text-[#b88a4f]" />
                                <span>مشاركة المحادثة</span>
                              </button>
                              <button type="button" onClick={() => void handlePinConversation(conversation)} className="flex h-9 w-full items-center gap-2 rounded-[14px] px-3 text-right text-[11px] font-bold text-[#2b1a10] transition hover:bg-[#f5ebd9] cursor-pointer">
                                <Pin size={14} className={conversation.pinnedAt ? "fill-[#b88a4f] text-[#b88a4f]" : "text-[#b88a4f]"} />
                                <span>{conversation.pinnedAt ? "إلغاء التثبيت" : "تثبيت"}</span>
                              </button>
                              <button type="button" onClick={() => openRenameConversation(conversation)} className="flex h-9 w-full items-center gap-2 rounded-[14px] px-3 text-right text-[11px] font-bold text-[#2b1a10] transition hover:bg-[#f5ebd9] cursor-pointer">
                                <Pencil size={14} className="text-[#b88a4f]" />
                                <span>إعادة التسمية</span>
                              </button>
                              <button type="button" onClick={() => { setOpenConversationMenuId(null); setDeleteTarget(conversation); }} className="flex h-9 w-full items-center gap-2 rounded-[14px] px-3 text-right text-[11px] font-bold text-[#2b1a10] transition hover:bg-[#f5ebd9] cursor-pointer">
                                <Trash2 size={14} className="text-[#b88a4f]" />
                                <span>حذف</span>
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shareResult && (
          <motion.div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#2b1a10]/20 px-5 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div dir="rtl" className="cut-crystal-panel w-full max-w-[360px] rounded-[28px] p-5" initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[15px] font-display font-black text-[#2b1a10]">تم إنشاء رابط المشاركة</p>
                  <p className="mt-1 text-[11px] font-bold text-[#7f6a55]">يمكن لأي شخص يملك الرابط مشاهدة هذه المحادثة.</p>
                </div>
                <button type="button" onClick={() => setShareResult(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-[#7f6a55] hover:bg-[#f5ebd9] cursor-pointer" aria-label="إغلاق"><X size={16} /></button>
              </div>
              <div className="cut-crystal-panel mt-4 flex items-center gap-2 rounded-[18px] p-2">
                <input readOnly value={shareResult.result.url} className="min-w-0 flex-1 bg-transparent px-2 text-left text-[10px] font-bold text-[#2b1a10] outline-none" dir="ltr" aria-label="رابط مشاركة المحادثة" />
                <button type="button" onClick={() => void navigator.clipboard?.writeText(shareResult.result.url)} className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-[#b88a4f] px-3 text-[11px] font-black text-white hover:bg-[#a0753e] cursor-pointer"><Copy size={13} />نسخ</button>
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setShareResult(null)} className="h-10 flex-1 rounded-full border border-[#b88a4f]/25 text-[12px] font-black text-[#7f6a55] hover:bg-[#f5ebd9] cursor-pointer">تم</button>
                <button type="button" onClick={() => void handleRevokeShare()} disabled={actionLoading} className="h-10 flex-1 rounded-full border border-red-200 text-[11px] font-black text-red-700 hover:bg-red-50 disabled:opacity-50 cursor-pointer">إلغاء الرابط</button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {renameTarget && (
          <motion.div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#2b1a10]/20 px-5 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.form dir="rtl" onSubmit={(event) => { event.preventDefault(); void handleRenameConversation(); }} className="cut-crystal-panel w-full max-w-[360px] rounded-[28px] p-5" initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}>
              <p className="text-[16px] font-display font-black text-[#2b1a10]">إعادة تسمية المحادثة</p>
              <input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} maxLength={160} className="cut-crystal-input mt-4 h-11 w-full rounded-[18px] px-4 text-right text-[13px] font-bold text-[#2b1a10] outline-none focus:border-[#b88a4f]" aria-label="اسم المحادثة الجديد" />
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setRenameTarget(null)} className="h-10 flex-1 rounded-full border border-[#d8c9b8] text-[12px] font-black text-[#7f6a55] hover:bg-[#f5ebd9] cursor-pointer">إلغاء</button>
                <button type="submit" disabled={!renameValue.trim() || actionLoading} className="h-10 flex-1 rounded-full bg-[#b88a4f] text-[12px] font-black text-white disabled:opacity-50 cursor-pointer">حفظ</button>
              </div>
            </motion.form>
          </motion.div>
        )}
        {deleteTarget && (
          <motion.div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#2b1a10]/25 px-5 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div dir="rtl" className="cut-crystal-panel w-full max-w-[360px] rounded-[28px] p-5" initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}>
              <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8f3c35] to-[#6f2d29] text-white shadow-sm"><Trash2 size={18} /></div><div><p className="text-[16px] font-display font-black text-[#2b1a10]">حذف المحادثة نهائيًا؟</p><p className="mt-2 text-[12px] font-bold leading-6 text-[#7f6a55]">سيتم حذف المحادثة وجميع رسائلها ورابط مشاركتها نهائيًا. لا يمكن التراجع عن هذا الإجراء.</p></div></div>
              <div className="mt-5 flex gap-2"><button type="button" onClick={() => setDeleteTarget(null)} disabled={actionLoading} className="h-10 flex-1 rounded-full border border-[#d8c9b8] text-[12px] font-black text-[#7f6a55] hover:bg-[#f5ebd9] cursor-pointer">إلغاء</button><button type="button" onClick={() => void handleDeleteConversation(deleteTarget.id)} disabled={actionLoading} className="h-10 flex-1 rounded-full border border-[#8f3c35]/35 bg-gradient-to-br from-[#8f3c35] to-[#6f2d29] text-[12px] font-black text-white shadow-[0_10px_22px_-12px_rgba(111,45,41,0.9)] transition-[transform,filter] duration-150 hover:brightness-110 active:scale-[0.97] disabled:opacity-50 cursor-pointer">{actionLoading ? "جارٍ الحذف..." : "حذف نهائي"}</button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {storageError && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="fixed bottom-6 left-5 right-5 z-[120] mx-auto max-w-[360px] rounded-[20px] border border-white/45 bg-[#ece7de]/55 px-4 py-3 text-center text-[11px] font-black text-[#2b1a10] shadow-[0_18px_42px_rgba(43,26,16,0.24)] backdrop-blur-2xl"
          >
            {storageError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN CHAT AREA / EMPTY STATE ── */}
      <div className="flex-1 flex flex-col justify-between relative z-10 overflow-hidden">
        
        {messages.length === 0 ? (
          <div className="flex-1 overflow-hidden pt-24 pb-28">
            <AnimatePresence mode="wait">
              <motion.div
                key={welcomeLineIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="flex h-full flex-col items-center justify-center px-4 text-center"
              >
                <p className="text-[13px] font-bold text-[#8a6a3d]">أهلًا بك، {userName}</p>
                <h1 className="mt-3 max-w-[330px] font-display text-[29px] font-black leading-[1.25] text-[#2b1a10]">
                  {welcomeLines[welcomeLineIndex].title}
                </h1>
                <p className="mt-3 max-w-[285px] text-[13px] font-bold leading-7 text-[#7f6a55]">
                  {welcomeLines[welcomeLineIndex].subtitle}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          /* Active Chat Thread */
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-1 pt-24 pb-36 space-y-4 scrollbar-thin hide-scrollbar">
            {messages.map((m, idx) => {
              const isUser = m.role === "user";
              const isEditingThisMessage = isUser && editingMessageId === m.id;
              const canEditThisMessage = isUser && m.id === lastUserMessageId && !isLoading && !hasStreamingAssistantMessage;
              const hasEditedContent = isEditingThisMessage && editingContent !== m.content;
              const isEditingLongMessage = isEditingThisMessage && (
                longMsgs.has(m.id) || editingContent.length > 110 || editingContent.split("\n").length > 3
              );
              const isLastAI = !isUser && idx === lastAssistantMessageIndex && m.isNew !== true && m.isStreaming !== true;
              return (
                <div
                  key={m.id}
                  className="w-full"
                >
                  <div
                    className={isUser ? "mr-auto max-w-[85%]" : "w-full"}
                  >
                    {!isUser && (
                      <div className="flex items-center gap-1.5 mb-2 text-[11px] font-display font-black text-[#b88a4f] select-none">
                        <span>سكينة AI</span>
                      </div>
                    )}
                    
                    {isUser ? (
                      <>
                        <div className="relative text-right bg-gradient-to-br from-[#2b1a10] to-[#3f281a] text-[#fff9f1] border border-[#2b1a10]/20 rounded-[28px] shadow-md transition-all duration-300 overflow-hidden">
                          {isEditingThisMessage ? (
                            <textarea
                              autoFocus
                              rows={isEditingLongMessage ? 7 : 3}
                              value={editingContent}
                              onChange={(event) => setEditingContent(event.target.value)}
                              aria-label="تعديل رسالة المستخدم"
                              className={`w-full resize-none bg-transparent p-4 text-right text-[14px] font-sans font-bold leading-relaxed text-[#fff9f1] outline-none placeholder:text-white/50 ${
                                isEditingLongMessage
                                  ? "min-h-[156px] max-h-[180px] overflow-y-auto overscroll-contain scroll-smooth"
                                  : "min-h-[92px] max-h-[130px] overflow-y-auto"
                              }`}
                            />
                          ) : (
                            <>
                              <div className={`p-4 transition-all duration-300 ease-in-out ${
                                longMsgs.has(m.id) && !expandedMsgs.has(m.id) ? "max-h-[105px] overflow-hidden relative" : "max-h-none"
                              }`}>
                                <p className="font-sans text-[14px] leading-relaxed font-bold whitespace-pre-wrap break-words">
                                  {m.content}
                                </p>
                                {longMsgs.has(m.id) && !expandedMsgs.has(m.id) && (
                                  <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#2b1a10] via-[#2b1a10]/85 to-transparent pointer-events-none rounded-b-[28px]" />
                                )}
                              </div>
                              {longMsgs.has(m.id) && (
                                <div className={`flex items-center justify-start ${!expandedMsgs.has(m.id) ? "absolute bottom-2.5 left-2.5 z-10" : "px-4 pb-3 pt-0"}`}>
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(m.id)}
                                    className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 border border-white/25 flex items-center justify-center text-white cursor-pointer transition-all active:scale-90 shadow-md backdrop-blur-xs"
                                    title={expandedMsgs.has(m.id) ? "طي النص" : "توسيع النص"}
                                  >
                                    {expandedMsgs.has(m.id) ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {isEditingThisMessage ? (
                          <div dir="ltr" className="mt-2 flex items-center justify-start gap-3 px-1 text-[12px] font-bold">
                            <button
                              type="button"
                              disabled={!hasEditedContent || !editingContent.trim()}
                              onClick={confirmEditingUserMessage}
                              className={`inline-flex h-7 items-center justify-center rounded-full px-3 text-[12px] font-bold transition-all ${
                                hasEditedContent && editingContent.trim()
                                  ? "bg-[#b88a4f] text-[#fff9f1] shadow-sm hover:bg-[#a0753e] active:scale-95 cursor-pointer"
                                  : "bg-[#e6dccf]/60 text-[#7f6a55]/40 cursor-not-allowed"
                              }`}
                            >
                              تعديل
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditingUserMessage}
                              className="text-[#7f6a55] transition-colors hover:text-[#2b1a10] cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <div dir="ltr" className="mt-2 flex items-center justify-start gap-1">
                            {canEditThisMessage && (
                              <button
                                type="button"
                                onClick={() => startEditingUserMessage(m)}
                                className="inline-flex h-7 w-7 items-center justify-center text-[#7f6a55] transition-colors hover:text-[#b88a4f] active:scale-90 cursor-pointer"
                                title="تعديل الرسالة"
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleCopyMsgContent(m.id, m.content)}
                              className={`inline-flex h-7 w-7 items-center justify-center text-[#7f6a55] transition-colors hover:text-[#b88a4f] active:scale-90 cursor-pointer ${
                                copiedResponseId === m.id ? "text-emerald-600" : ""
                              }`}
                              title="نسخ الرسالة"
                            >
                              {copiedResponseId === m.id ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full text-right bg-transparent border-none shadow-none px-0 py-2 text-[#2b1a10]">
                        <div className="whitespace-pre-wrap">
                          {m.content.trim() === "" && m.isStreaming ? (
                        <div className="flex items-center gap-1.5 py-3 justify-start">
                          <span className="w-2 h-2 rounded-full bg-[#b88a4f] animate-bounce [animation-delay:-0.3s]"></span>
                          <span className="w-2 h-2 rounded-full bg-[#b88a4f] animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="w-2 h-2 rounded-full bg-[#b88a4f] animate-bounce"></span>
                        </div>
                      ) : (
                        <MarkdownRenderer 
                          content={m.content} 
                          animate={m.isNew && !m.isStreaming} 
                          onComplete={() => {
                            setMessages((prev) =>
                              prev.map((msg) => (msg.id === m.id ? { ...msg, isNew: false } : msg))
                            );
                          }} 
                        />
                          )}
                        </div>
                        {isLastAI && (
                          <div
                            dir="ltr"
                            className="mt-4 flex w-full items-center justify-end gap-2 border-t border-[#e6dccf]/40 pt-3 text-[#7f6a55] select-none"
                          >
                            {/* Explicit LTR flex direction keeps this group on the physical right side. */}
                            <button
                              type="button"
                              onClick={() => setFeedback(prev => ({ ...prev, [m.id]: prev[m.id] === 'dislike' ? undefined : 'dislike' }))}
                              className={`inline-flex h-7 w-7 items-center justify-center text-[#7f6a55] transition-all hover:text-red-500 active:scale-90 cursor-pointer ${
                                feedback[m.id] === 'dislike' ? 'text-red-600' : ''
                              }`}
                              title="لم يعجبني"
                            >
                              <ThumbsDown size={14} fill={feedback[m.id] === 'dislike' ? "currentColor" : "none"} />
                            </button>

                            <button
                              type="button"
                              onClick={() => setFeedback(prev => ({ ...prev, [m.id]: prev[m.id] === 'like' ? undefined : 'like' }))}
                              className={`inline-flex h-7 w-7 items-center justify-center text-[#7f6a55] transition-all hover:text-[#b88a4f] active:scale-90 cursor-pointer ${
                                feedback[m.id] === 'like' ? 'text-[#b88a4f]' : ''
                              }`}
                              title="أعجبني"
                            >
                              <ThumbsUp size={14} fill={feedback[m.id] === 'like' ? "currentColor" : "none"} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopyMsgContent(m.id, m.content)}
                              className={`inline-flex h-7 w-7 items-center justify-center text-[#7f6a55] transition-all hover:text-[#b88a4f] active:scale-90 cursor-pointer ${
                                copiedResponseId === m.id ? "text-emerald-600" : ""
                              }`}
                              title="نسخ الإجابة"
                            >
                              {copiedResponseId === m.id ? (
                                <Check size={14} className="text-emerald-600" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start w-full pr-1 py-2 pl-12">
                <div className="relative inline-flex items-center">
                  <span className="text-[14px] font-display font-bold text-[#7f6a55] select-none overflow-hidden">
                    <span className="inline-block animate-shimmer-text bg-gradient-to-r from-[#7f6a55] via-[#b88a4f] to-[#7f6a55] bg-[length:200%_100%] bg-clip-text text-transparent">
                      تفكير عميق
                    </span>
                  </span>
                  <span className="ml-1.5 flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-[#b88a4f] animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1 h-1 rounded-full bg-[#b88a4f] animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1 h-1 rounded-full bg-[#b88a4f] animate-bounce" />
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* ── BACKGROUND UNDER INPUT BAR ── */}
        <div
          className={`fixed inset-x-0 bottom-0 z-10 pointer-events-none h-28 ${
            messages.length === 0
              ? "bg-gradient-to-t from-[#d8b27b]/55 via-[#d8b27b]/20 to-transparent"
              : "bg-gradient-to-t from-[#ece7de] via-[#ece7de]/80 to-transparent"
          }`}
        />

        {/* ── FLOATING INPUT FIELD BAR ── */}
        <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center pointer-events-none px-4 pb-4">
          <div className="w-full max-w-[390px] pointer-events-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputValue);
              }}
              className="flex items-end gap-2 p-2 transition-shadow duration-300"
              style={{
                borderRadius: isMultiline ? '22px' : '9999px',
                overflow: 'hidden',
                background: 'linear-gradient(180deg, rgba(253,252,251,0.75) 0%, rgba(244,240,234,0.60) 100%)',
                backdropFilter: 'blur(26px) saturate(210%) contrast(99%) brightness(102%)',
                WebkitBackdropFilter: 'blur(26px) saturate(210%) contrast(99%) brightness(102%)',
                border: '1px solid rgba(43,26,16,0.09)',
                boxShadow: '0 16px 36px -12px rgba(43,26,16,0.14), 0 4px 10px -2px rgba(43,26,16,0.06), inset 0 1px 0 0 rgba(255,255,255,0.90), inset 0 -1px 0 0 rgba(43,26,16,0.05)',
                transition: 'border-radius 0.3s ease',
              }}
            >
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="اسأل عن أي أمر فقهي أو شرعي..."
                disabled={isLoading || editingMessageId !== null}
                rows={1}
                className="flex-1 min-h-[38px] text-right bg-transparent border-none outline-none px-3 py-2 text-[13.5px] font-sans font-bold text-[#2b1a10] placeholder-[#7f6a55]/60 disabled:opacity-50 resize-none max-h-[130px] overflow-y-auto leading-relaxed break-words"
              />
              
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="submit"
                disabled={!inputValue.trim() || isLoading || editingMessageId !== null}
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                  inputValue.trim() && !isLoading && editingMessageId === null
                    ? "bg-[#b88a4f] text-[#fff9f1] shadow-md hover:bg-[#a0753e] active:scale-90 cursor-pointer"
                    : "bg-[#e8dfd4]/60 text-[#7f6a55]/40 cursor-not-allowed"
                }`}
                aria-label="إرسال السؤال"
              >
                <ArrowUp size={15} strokeWidth={2.5} />
              </motion.button>
            </form>
            <div className="text-center mt-1.5 flex items-center justify-center gap-1 text-[10px] font-sans text-[#7f6a55]/80 font-bold">
              <AlertCircle size={10} className="text-[#b88a4f]" />
              <span>الإجابات تقتصر بدقة على القرآن الكريم والبخاري ومسلم.</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
});

export default SakeenahAIScreen;
