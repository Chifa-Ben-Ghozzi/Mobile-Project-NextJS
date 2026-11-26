
import {
  sendNotification,
  setVapidDetails,
  type PushSubscription,
} from "web-push";

import { database } from "./db";

let vapidDetailsConfigured = false;

function configureVapidDetails() {
  if (vapidDetailsConfigured) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("Web push is not configured. Set both VAPID keys in the environment.");
  }

  setVapidDetails(
    "mailto:rideshareapp.mail@gmail.com",
    publicKey,
    privateKey
  );
  vapidDetailsConfigured = true;
}

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: string
): Promise<boolean> {
  try {
    configureVapidDetails();
    await sendNotification(subscription, payload);
    return true;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "statusCode" in error &&
      error.statusCode === 410
    ) {
      return false;
    }

    throw error;
  }
}

export async function sendImmediateNotification(
  userId: string,
  title: string,
  body: string
): Promise<void> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data: subscriptionData, error: subscriptionError } =
    await database
      .collection("push_subscriptions")
      .select("id, subscription, enabled, last_used")
      .eq("user_id", userId)
      .eq("enabled", true)
      .gte("last_used", oneWeekAgo.toISOString())
      .order("last_used", { ascending: false });

  if (subscriptionError) {
    throw subscriptionError;
  }

  if (subscriptionData && subscriptionData.length > 0) {
    const payload = JSON.stringify({ title, body });
    const expiredSubscriptions: string[] = [];

    await Promise.all(
      subscriptionData.map(async (sub) => {
        const subscription =
          typeof sub.subscription === "string"
            ? JSON.parse(sub.subscription)
            : sub.subscription;

        const success = await sendPushNotification(
          subscription,
          payload
        );

        if (!success) {
          expiredSubscriptions.push(sub.id);
        }
      })
    );

    // Remove expired subscriptions
    if (expiredSubscriptions.length > 0) {
      await database
        .collection("push_subscriptions")
        .delete()
        .in("id", expiredSubscriptions);
    }
  }
}
