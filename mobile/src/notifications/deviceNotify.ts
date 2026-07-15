/**
 * Device notification helpers.
 * Expo Go on Android (SDK 53+) removed remote push and shows a red error banner
 * if expo-notifications push APIs / module usage trips that path.
 * In Expo Go we only keep the in-app inbox — no native notification calls.
 */
import Constants from "expo-constants";
import { Platform } from "react-native";

export const isExpoGo = Constants.appOwnership === "expo";

/** Native system toasts/banners — disabled in Expo Go to avoid the red push-error banner. */
export function canUseNativeNotifications() {
  return !isExpoGo;
}

export async function requestDevicePermission(): Promise<boolean> {
  if (!canUseNativeNotifications()) return false;
  try {
    const Notifications = await import("expo-notifications");
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("enarte-offers", {
        name: "عروض ومنتجات ENARTE",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 180, 120, 180],
        lightColor: "#c4a35a",
      });
    }
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== "granted") {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }
    return status === "granted";
  } catch {
    return false;
  }
}

export async function getDevicePermissionGranted(): Promise<boolean | null> {
  if (!canUseNativeNotifications()) return false;
  try {
    const Notifications = await import("expo-notifications");
    const permission = await Notifications.getPermissionsAsync();
    return permission.status === "granted";
  } catch {
    return false;
  }
}

export async function presentLocalNotification(
  title: string,
  body: string,
  data: Record<string, unknown> = {},
) {
  if (!canUseNativeNotifications()) return;
  try {
    const Notifications = await import("expo-notifications");
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    } catch {
      // ignore
    }
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("enarte-offers", {
        name: "عروض ومنتجات ENARTE",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 180, 120, 180],
        lightColor: "#c4a35a",
      });
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        ...(Platform.OS === "android" ? { channelId: "enarte-offers" } : {}),
      },
      trigger: null,
    });
  } catch {
    // Never crash the app for notification failures.
  }
}
