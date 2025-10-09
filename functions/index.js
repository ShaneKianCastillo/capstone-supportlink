/* eslint-disable require-jsdoc, max-len */
const admin = require("firebase-admin");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions, logger } = require("firebase-functions/v2");
const { getMessaging } = require("firebase-admin/messaging");

admin.initializeApp();
setGlobalOptions({ region: "asia-southeast1" });

/**
 * Trigger: send push notifications to all Property Custodians
 * when a new asset request is created.
 */
exports.sendCustodianNotification = onDocumentCreated("assetRequests/{requestId}", async (event) => {
  const data = event.data?.data() || {};
  const db = admin.firestore();

  try {
    // Get all custodians
    const usersSnap = await db
      .collection("users")
      .where("role", "==", "Property Custodian")
      .get();

    if (usersSnap.empty) {
      logger.info("No custodians found for FCM notification.");
      return;
    }

    // Gather tokens
    const tokens = [];
    usersSnap.forEach((doc) => {
      const fcmTokens = doc.data().fcmTokens || {};
      tokens.push(...Object.keys(fcmTokens));
    });

    if (!tokens.length) {
      logger.info("No FCM tokens found.");
      return;
    }

    // Build payload
    const payload = {
      notification: {
        title: "New Asset Request",
        body: `${data.userName || "Someone"} requested ${data.assetName || "an asset"}.`,
        icon: "/icons/icon-192.png",
      },
      webpush: {
        fcmOptions: {
          link: "https://dct-supportlink.web.app/custodian", // adjust if needed
        },
      },
    };

    // Send
    const resp = await getMessaging().sendEachForMulticast({ tokens, ...payload });
    logger.info(`Sent ${resp.successCount} notifications; ${resp.failureCount} failed.`);
  } catch (err) {
    logger.error("FCM push send error:", err);
  }
});
