import { Capacitor } from "@capacitor/core";
import { getCurrentSession } from "./auth-service";

export type AndroidUsageSignalEvent =
  | "app_open"
  | "login_success"
  | "login_failed"
  | "conversation_started"
  | "sakina_request_success"
  | "sakina_request_failed"
  | "share_created"
  | "app_error";

export type AndroidUsageConnectionType = "wifi" | "cellular" | "offline";
export type AndroidUsageChannel = "production" | "beta" | "internal";

export interface AndroidUsageSignal {
  clientEventId: string;
  event: AndroidUsageSignalEvent;
  occurredAt: string;
  manufacturer: string;
  model: string;
  androidVersion: string;
  sdkVersion: string;
  appVersion: string;
  channel: AndroidUsageChannel;
  connectionType: AndroidUsageConnectionType;
  language: "ar" | "en";
  errorClass?: string;
}

export type AndroidUsageSignalTransport = (
  signal: AndroidUsageSignal,
) => Promise<void>;

/** Official production endpoint approved by the server team for Android telemetry. */
export const ANDROID_USAGE_SIGNALS_ENDPOINT =
  "https://sakeenah-console.vercel.app/api/telemetry/events";

interface CordovaDeviceInfo {
  manufacturer?: string;
  model?: string;
  version?: string;
  sdkVersion?: string;
}

declare global {
  interface Window {
    device?: CordovaDeviceInfo;
  }
}

let transport: AndroidUsageSignalTransport | null = null;
let appOpenSent = false;

function createClientEventId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (character) => {
      const random = Math.random() * 16;
      const value = character === "x" ? random : (random & 0x3) | 0x8;
      return Math.floor(value).toString(16);
    },
  );
}

function getConnectionType(): AndroidUsageConnectionType {
  if (typeof navigator === "undefined" || !navigator.onLine) return "offline";

  const connection = (
    navigator as Navigator & {
      connection?: { type?: string; effectiveType?: string };
    }
  ).connection;
  const type =
    `${connection?.type ?? connection?.effectiveType ?? ""}`.toLowerCase();

  if (type.includes("cell")) return "cellular";
  return "wifi";
}

function getChannel(): AndroidUsageChannel {
  const configured = String(import.meta.env.VITE_APP_CHANNEL ?? "")
    .trim()
    .toLowerCase();
  if (
    configured === "beta" ||
    configured === "internal" ||
    configured === "production"
  ) {
    return configured;
  }
  return import.meta.env.MODE === "production" ? "production" : "internal";
}

function readDeviceInfo(): Promise<CordovaDeviceInfo | undefined> {
  if (typeof window === "undefined") return Promise.resolve(undefined);
  if (
    window.device?.model ||
    window.device?.version ||
    window.device?.manufacturer
  ) {
    return Promise.resolve(window.device);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      document.removeEventListener("deviceready", finish);
      resolve(window.device);
    };
    const timeoutId = window.setTimeout(finish, 1500);
    document.addEventListener("deviceready", finish, { once: true });
  });
}

async function buildSignal(
  event: AndroidUsageSignalEvent,
  errorClass?: string,
): Promise<AndroidUsageSignal> {
  const device = await readDeviceInfo();
  const language =
    typeof navigator !== "undefined" &&
    navigator.language.toLowerCase().startsWith("ar")
      ? "ar"
      : "en";

  return {
    clientEventId: createClientEventId(),
    event,
    occurredAt: new Date().toISOString(),
    manufacturer: String(device?.manufacturer ?? "unknown").slice(0, 80),
    model: String(device?.model ?? "unknown").slice(0, 120),
    androidVersion: String(device?.version ?? "unknown").slice(0, 40),
    sdkVersion: String(device?.sdkVersion ?? "unknown").slice(0, 40),
    appVersion: String(import.meta.env.VITE_APP_VERSION ?? "2.0").slice(0, 40),
    channel: getChannel(),
    connectionType: getConnectionType(),
    language,
    ...(errorClass ? { errorClass: errorClass.slice(0, 60) } : {}),
  };
}

/**
 * Creates the approved Android transport using the existing Supabase session.
 * No user ID, session ID, conversation content, or secret is sent in the payload.
 */
export function createAndroidUsageSignalTransport(): AndroidUsageSignalTransport {
  return async (signal) => {
    const session = await getCurrentSession();
    const accessToken = session?.access_token;
    if (!accessToken) return;

    const response = await fetch(ANDROID_USAGE_SIGNALS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(signal),
    });

    if (!response.ok) {
      throw new Error(
        `Android telemetry request failed with status ${response.status}`,
      );
    }
  };
}

/** Registers the approved server transport. */
export function setAndroidUsageSignalTransport(
  nextTransport: AndroidUsageSignalTransport | null,
): void {
  transport = nextTransport;
}

export async function trackAndroidUsageSignal(
  event: AndroidUsageSignalEvent,
  errorClass?: string,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (event === "app_open") {
    if (appOpenSent) return;
    appOpenSent = true;
  }

  const signal = await buildSignal(event, errorClass);
  if (!transport) return;

  try {
    await transport(signal);
  } catch {
    // Analytics failures are best-effort and must never affect the app flow.
  }
}
