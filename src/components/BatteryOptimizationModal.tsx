import { useCallback, useEffect, useMemo, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { motion, AnimatePresence } from 'motion/react';
import { X, Settings, Clock, Bell, Check } from 'lucide-react';
import { PrayerAlarmService } from '@/services/PrayerAlarmService';
import SakeenahLineSpinner from '@/components/SakeenahLineSpinner';
import { PrayerNotificationsService } from '@/services/PrayerNotificationsService';

interface PermissionStep {
  id: 'notifications' | 'exactAlarm';
  title: string;
  description: string;
  icon: React.ReactNode;
}

export default function BatteryOptimizationModal({
  onDismiss,
}: {
  onDismiss: (refresh?: boolean) => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [needsNotifications, setNeedsNotifications] = useState(false);
  const [needsExactAlarm, setNeedsExactAlarm] = useState(false);
  const [notificationBlocked, setNotificationBlocked] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);

  const loadPermissionStatus = useCallback(async () => {
    try {
      const notificationStatus = await PrayerNotificationsService.getPermissionStatus();
      const canSchedule = await PrayerAlarmService.canScheduleExactAlarms();
      setNeedsNotifications(notificationStatus !== 'granted');
      setNotificationBlocked(notificationStatus === 'denied');
      setNeedsExactAlarm(!canSchedule);
      setStatusLoaded(true);
    } catch (error) {
      console.warn('Failed to load permission status:', error);
    }
  }, []);

  useEffect(() => {
    void loadPermissionStatus();
    let disposed = false;
    let listener: { remove: () => Promise<void> } | null = null;
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!disposed && isActive) void loadPermissionStatus();
    }).then((handle) => {
      if (disposed) void handle.remove();
      else listener = handle;
    }).catch((error) => {
      console.warn('Unable to observe permission settings return:', error);
    });
    return () => {
      disposed = true;
      if (listener) void listener.remove();
    };
  }, [loadPermissionStatus]);

  const steps = useMemo<PermissionStep[]>(() => {
    const required: PermissionStep[] = [];
    if (needsNotifications) {
      required.push({
        id: 'notifications',
        title: 'إشعارات الصلاة',
        description: 'نحتاج إذن الإشعارات حتى يصلك تذكير الصلاة وإشعار دخول الوقت. لن نرسل إشعارات خارج هذه الوظيفة.',
        icon: <Bell size={28} className="text-[#b88a4f]" />,
      });
    }
    if (needsExactAlarm) {
      required.push({
        id: 'exactAlarm',
        title: 'التنبيهات الدقيقة',
        description: 'يحتاج أندرويد إذنًا خاصًا حتى يوقظ التطبيق عند وقت التذكير المحسوب بدقة، حتى أثناء النوم العميق.',
        icon: <Clock size={28} className="text-[#b88a4f]" />,
      });
    }
    return required;
  }, [needsExactAlarm, needsNotifications]);

  const currentRequiredStep = steps[currentStep];

  useEffect(() => {
    if (!statusLoaded) return;
    if (steps.length === 0) {
      onDismiss(true);
      return;
    }
    if (currentStep < 0 || currentStep >= steps.length) setCurrentStep(0);
  }, [currentStep, onDismiss, statusLoaded, steps.length]);

  const advanceAfterVerification = useCallback(async (stepId: PermissionStep['id']) => {
    await loadPermissionStatus();
    const status = stepId === 'notifications'
      ? await PrayerNotificationsService.getPermissionStatus()
      : null;
    const verified = stepId === 'notifications'
      ? status === 'granted'
      : await PrayerAlarmService.canScheduleExactAlarms();

    if (!verified) return;
    setCompletedSteps((previous) => new Set([...previous, stepId]));
    setCurrentStep((step) => step + 1);
  }, [loadPermissionStatus]);

  const handleCurrentStep = useCallback(async () => {
    if (!currentRequiredStep) return;
    setIsProcessing(true);
    try {
      if (currentRequiredStep.id === 'notifications') {
        if (notificationBlocked) {
          await PrayerAlarmService.openAppSettings();
        } else {
          await PrayerNotificationsService.requestPermission();
        }
      } else {
        await PrayerAlarmService.requestExactAlarmPermission();
      }
      await advanceAfterVerification(currentRequiredStep.id);
    } catch (error) {
      console.warn(`Permission step failed: ${currentRequiredStep.id}`, error);
    } finally {
      setIsProcessing(false);
    }
  }, [advanceAfterVerification, currentRequiredStep, notificationBlocked]);

  const handleLater = useCallback(() => {
    onDismiss(false);
  }, [onDismiss]);

  if (!currentRequiredStep) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end justify-center bg-black/30 backdrop-blur-sm"
        onClick={handleLater}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(event) => event.stopPropagation()}
          className="relative w-full max-w-[390px] overflow-hidden rounded-t-[32px] bg-[#fdfcfb] shadow-2xl"
        >
          <div className="flex justify-center pb-2 pt-3">
            <div className="h-1 w-10 rounded-full bg-[#e6dccf]" />
          </div>
          <div className="absolute left-4 top-4">
            <button
              onClick={handleLater}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e6dccf] bg-[#f7f2ea] text-[#7f6a55] transition-colors hover:bg-[#ece7de]"
              aria-label="إغلاق"
            >
              <X size={16} />
            </button>
          </div>

          <div className="px-6 pb-8 pt-4">
            <div className="mb-6 flex items-center justify-center gap-2">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentStep
                      ? 'w-6 bg-[#b88a4f]'
                      : index < currentStep
                        ? 'w-2 bg-[#2b1a10]'
                        : 'w-2 bg-[#e6dccf]'
                  }`}
                />
              ))}
            </div>

            <div className="mb-6 flex justify-center">
              <div className="cut-crystal-panel flex h-20 w-20 items-center justify-center rounded-[24px] shadow-md">
                {completedSteps.has(currentRequiredStep.id) ? (
                  <Check size={36} className="text-[#2b1a10]" strokeWidth={2.5} />
                ) : (
                  currentRequiredStep.icon
                )}
              </div>
            </div>

            <h2 className="mb-3 text-center text-[22px] font-display font-black text-[#2b1a10]">
              {currentRequiredStep.title}
            </h2>
            <p className="mx-auto mb-8 max-w-[320px] text-center text-[14px] font-bold leading-relaxed text-[#7f6a55]">
              {currentRequiredStep.description}
            </p>

            <button
              onClick={handleCurrentStep}
              disabled={isProcessing}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-[20px] bg-[#2b1a10] text-[15px] font-black text-[#fff9f1] shadow-md transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              {isProcessing ? (
                <SakeenahLineSpinner size={20} color="#fff9f1" label="جارٍ التنفيذ" />
              ) : (
                <>
                  {currentRequiredStep.id === 'notifications' && notificationBlocked ? <Settings size={18} /> : <Settings size={18} />}
                  <span>{currentRequiredStep.id === 'notifications' && notificationBlocked ? 'افتح إعدادات التطبيق' : 'تفعيل الآن'}</span>
                </>
              )}
            </button>

            <div className="mt-4 text-center">
              <button
                onClick={handleLater}
                className="text-[13px] font-bold text-[#b88a4f] underline transition-colors hover:text-[#deab65]"
              >
                لاحقاً
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
