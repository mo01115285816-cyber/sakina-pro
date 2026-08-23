import React, { useState, useCallback, useMemo } from "react";
import { X, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Capacitor } from "@capacitor/core";
import type {
  PrayerSettingsId,
  SinglePrayerPreference,
  PrayerNotificationMode,
  MuezzinTrack,
  AllPrayersPreferences,
} from "@/types/prayer-settings";
import { UnsavedChangesModal } from "./UnsavedChangesModal";
import { MuezzinSelectorSection } from "./MuezzinSelectorSection";

interface PrayerSettingsScreenProps {
  prayerId: PrayerSettingsId;
  preferences: AllPrayersPreferences;
  onSave: (prefs: AllPrayersPreferences) => void;
  onClose: () => void;
  /** Secondary timings data kept for API compatibility with a4b380c. */
  fajrTime?: Date;
  maghribTime?: Date;
  sunriseTime?: Date;
  ishaTime?: Date;
}

const Switch = React.memo(function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative w-10 h-5.5 rounded-full p-0.5 transition-colors duration-300 focus:outline-none flex items-center shadow-inner cursor-pointer"
      style={{
        backgroundColor: checked ? "#b88a4f" : "#e6dccf",
        justifyContent: checked ? "flex-start" : "flex-end",
      }}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 500, damping: 28 }}
        className="w-4.5 h-4.5 rounded-full bg-white shadow-md border border-white"
      />
    </button>
  );
});

export const PrayerSettingsScreen = React.memo(function PrayerSettingsScreen({
  prayerId,
  preferences,
  onSave,
  onClose,
}: PrayerSettingsScreenProps) {
  // Original a4b380c logic: edit the shared AllPrayersPreferences object and save via parent.
  const [localPrefs, setLocalPrefs] = useState<AllPrayersPreferences>(() =>
    Object.fromEntries(
      Object.entries(preferences).map(([key, pref]) => [key, { ...pref, enabled: true }]),
    ) as AllPrayersPreferences,
  );
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  const currentPrefs = localPrefs[prayerId];
  const prayerDisplayName = currentPrefs.prayerDisplayName;

  const isDirty = useMemo(
    () => JSON.stringify(localPrefs) !== JSON.stringify(preferences),
    [localPrefs, preferences],
  );

  const updatePref = useCallback(
    (updates: Partial<SinglePrayerPreference>) => {
      setLocalPrefs((prev) => ({
        ...prev,
        [prayerId]: { ...prev[prayerId], ...updates },
      }));
    },
    [prayerId],
  );

  const handleCloseAttempt = useCallback(() => {
    if (isDirty) {
      setShowUnsavedModal(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const handleSaveAndClose = useCallback(async () => {
    // Save to React state (existing behavior)
    onSave(localPrefs);

    // ═══════════════════════════════════════════════════════════════
    // SAVE TO NATIVE ANDROID SHARED PREFERENCES
    // This ensures AlarmReceiver can read the preferences
    // ═══════════════════════════════════════════════════════════════
    const isNative = Capacitor.isNativePlatform();
    if (isNative) {
      try {
        const { PrayerAlarmService } = await import("@/services/PrayerAlarmService");
        // Save all prayer preferences to native SharedPreferences
        for (const [key, pref] of Object.entries(localPrefs)) {
          await PrayerAlarmService.savePrayerPreference(
            key,
            pref.enabled,
            pref.mode
          );
        }
        console.log("Saved prayer preferences to native SharedPreferences");
      } catch (e) {
        console.warn("Failed to save prayer preferences to native:", e);
      }
    }

    onClose();
  }, [localPrefs, onSave, onClose]);

  const handleDiscardAndClose = useCallback(() => {
    setLocalPrefs(
      Object.fromEntries(
        Object.entries(preferences).map(([key, pref]) => [key, { ...pref, enabled: true }]),
      ) as AllPrayersPreferences,
    );
    setShowUnsavedModal(false);
    onClose();
  }, [preferences, onClose]);

  const handleSelectMode = useCallback(
    (mode: PrayerNotificationMode) => {
      updatePref({ mode });
    },
    [updatePref],
  );

  const handleSelectMuezzin = useCallback(
    (track: MuezzinTrack) => {
      updatePref({ selectedMuezzinId: track.id });
    },
    [updatePref],
  );

  const headerTitle = `${prayerDisplayName} الإعدادات`;

  const isMuezzinVisible =
    currentPrefs.mode === "azan_short" || currentPrefs.mode === "azan_full";

  return (
    <div
      dir="rtl"
      className="mx-auto w-full max-w-[390px] px-5 pt-24 pb-28 font-sans bg-[#ece7de] min-h-screen relative overflow-hidden"
    >
      {/* Background soft ambient shapes from Sakineh-2.0.0 design */}
      <div className="absolute top-[-20%] right-[-10%] w-[300px] h-[300px] bg-[#b88a4f]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[250px] h-[250px] bg-[#deab65]/5 rounded-full blur-[100px] pointer-events-none" />

      {/* ── FLOATING TOP HEADER ── */}
      <div className="fixed top-6 left-5 right-5 flex items-center justify-between z-45 pointer-events-none">
        <div className="cut-crystal-capsule px-5 h-10 rounded-full shadow-md flex items-center justify-center pointer-events-auto">
          <span className="text-[14.5px] font-bold text-[#2b1a10] whitespace-nowrap pt-0.5">
            {headerTitle}
          </span>
        </div>

        <button
          onClick={handleCloseAttempt}
          className="w-10 h-10 cut-crystal-capsule rounded-full flex items-center justify-center shadow-md text-[#2b1a10] active:scale-95 transition-all pointer-events-auto cursor-pointer"
          aria-label="إغلاق"
        >
          <X size={18} />
        </button>
      </div>

      <div className="relative z-10 flex flex-col gap-4">
        {/* ── ALWAYS-ON STATUS ── */}
        <div className="cut-crystal-panel rounded-[28px] p-5 shadow-md">
          <h3 className="text-[14.5px] font-bold text-[#2b1a10] leading-none">
            تذكيرات الصلاة مفعّلة دائمًا
          </h3>
          <p className="text-[11px] font-medium text-[#7f6a55] mt-1.5">
            ستظل سكينة تذكّرك بوقت صلاة {prayerDisplayName}.
          </p>
        </div>

        {/* ── PREFERENCES CARD: تفضيلات الإشعارات ── */}
        <div className="px-2 pt-1 transition-all duration-300">
          <h4 className="text-[13px] font-bold text-[#7f6a55] tracking-wide mr-1">
            تفضيلات التنبيه
          </h4>
        </div>
        <div className="cut-crystal-panel rounded-[28px] p-5 transition-all duration-300 shadow-md">
          <div className="flex flex-col divide-y divide-[#e6dccf]/30">
            <button
              type="button"
              onClick={() => handleSelectMode("beep")}
              className="w-full flex items-center justify-between py-3.5 text-right cursor-pointer group focus:outline-none"
            >
              <div className="flex-1 min-w-0 pr-1">
                <h5 className="text-[14px] font-bold text-[#2b1a10] group-hover:text-[#b88a4f] transition-colors">
                  نغمة التنبيه
                </h5>
                <p className="text-[11px] text-[#7f6a55] mt-1">
                  تشغيل نغمة قصيرة للتذكير.
                </p>
              </div>
              <div className="flex-shrink-0 pl-2">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    currentPrefs.mode === "beep"
                      ? "border-[#b88a4f] bg-[#b88a4f]"
                      : "border-[#e6dccf] bg-transparent"
                  }`}
                >
                  {currentPrefs.mode === "beep" && (
                    <Check size={12} className="text-white stroke-[3.5px]" />
                  )}
                </div>
              </div>
            </button>

            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => {
                  if (
                    currentPrefs.mode !== "azan_short" &&
                    currentPrefs.mode !== "azan_full"
                  ) {
                    handleSelectMode("azan_short");
                  }
                }}
                className="w-full flex items-center justify-between py-3.5 text-right cursor-pointer group focus:outline-none"
              >
                <div className="flex-1 min-w-0 pr-1">
                  <h5 className="text-[14px] font-bold text-[#2b1a10] group-hover:text-[#b88a4f] transition-colors">
                    صوت الأذان
                  </h5>
                  <p className="text-[11px] text-[#7f6a55] mt-1">
                    تشغيل صوت الأذان.
                  </p>
                </div>
                <div className="flex-shrink-0 pl-2">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                      currentPrefs.mode === "azan_short" ||
                      currentPrefs.mode === "azan_full"
                        ? "border-[#b88a4f] bg-[#b88a4f]"
                        : "border-[#e6dccf] bg-transparent"
                    }`}
                  >
                    {(currentPrefs.mode === "azan_short" ||
                      currentPrefs.mode === "azan_full") && (
                      <Check size={12} className="text-white stroke-[3.5px]" />
                    )}
                  </div>
                </div>
              </button>

              <AnimatePresence initial={false}>
                {(currentPrefs.mode === "azan_short" ||
                  currentPrefs.mode === "azan_full") && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="mr-3 pr-3 border-r-2 border-[#b88a4f]/20 py-2.5 mb-2.5 flex items-center justify-between bg-[#f7f2ea]/40 rounded-[16px] px-3.5">
                      <div className="text-right">
                        <h6 className="text-[13px] font-bold text-[#2b1a10]">
                          الأذان الكامل
                        </h6>
                        <p className="text-[10.5px] text-[#7f6a55] mt-0.5">
                          تشغيل صوت الأذان الكامل.
                        </p>
                      </div>
                      <Switch
                        checked={currentPrefs.mode === "azan_full"}
                        onChange={(val) =>
                          handleSelectMode(val ? "azan_full" : "azan_short")
                        }
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={() => handleSelectMode("vibrate_only")}
              className="w-full flex items-center justify-between py-3.5 text-right cursor-pointer group focus:outline-none"
            >
              <div className="flex-1 min-w-0 pr-1">
                <h5 className="text-[14px] font-bold text-[#2b1a10] group-hover:text-[#b88a4f] transition-colors">
                  اهتزاز فقط
                </h5>
                <p className="text-[11px] text-[#7f6a55] mt-1">
                  يهتز الجهاز عند وقت الصلاة دون صوت.
                </p>
              </div>
              <div className="flex-shrink-0 pl-2">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    currentPrefs.mode === "vibrate_only"
                      ? "border-[#b88a4f] bg-[#b88a4f]"
                      : "border-[#e6dccf] bg-transparent"
                  }`}
                >
                  {currentPrefs.mode === "vibrate_only" && (
                    <Check size={12} className="text-white stroke-[3.5px]" />
                  )}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelectMode("silent")}
              className="w-full flex items-center justify-between py-3.5 text-right cursor-pointer group focus:outline-none"
            >
              <div className="flex-1 min-w-0 pr-1">
                <h5 className="text-[14px] font-bold text-[#2b1a10] group-hover:text-[#b88a4f] transition-colors">
                  صامت
                </h5>
                <p className="text-[11px] text-[#7f6a55] mt-1">
                  لن يصدر صوت لأي إشعارات.
                </p>
              </div>
              <div className="flex-shrink-0 pl-2">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    currentPrefs.mode === "silent"
                      ? "border-[#b88a4f] bg-[#b88a4f]"
                      : "border-[#e6dccf] bg-transparent"
                  }`}
                >
                  {currentPrefs.mode === "silent" && (
                    <Check size={12} className="text-white stroke-[3.5px]" />
                  )}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* ── EXPANDABLE MUEZZIN SELECTION SECTION — original real list/download/preview logic ── */}
        <AnimatePresence>
          {isMuezzinVisible && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="overflow-hidden"
            >
              <MuezzinSelectorSection
                prayerKey={prayerId}
                selectedMuezzinId={currentPrefs.selectedMuezzinId}
                onSelect={handleSelectMuezzin}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── BOTTOM SAVE BAR ── */}
        <div className="pt-6">
          <button
            type="button"
            onClick={handleSaveAndClose}
            className="w-full h-13 bg-[#2b1a10] text-[#fff9f1] hover:brightness-110 active:scale-[0.99] transition-all text-[14.5px] font-bold rounded-[20px] shadow-md cursor-pointer flex items-center justify-center"
          >
            احفظ التغييرات
          </button>
        </div>
      </div>

      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onSaveAndClose={handleSaveAndClose}
        onDiscardAndClose={handleDiscardAndClose}
        onClose={() => setShowUnsavedModal(false)}
      />
    </div>
  );
});
