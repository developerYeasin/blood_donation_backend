const db = require("../config/db");
const webpush = require("web-push");
require("dotenv").config();
const { Expo } = require("expo-server-sdk");

// Configure Web Push once
webpush.setVapidDetails(
  "mailto:yea13sin@mailinator.com",
  process.env.PUBLIC_VAPID_KEY,
  process.env.PRIVATE_VAPID_KEY
);

/**
 * Universal Notification Sender
 * @param {number} recipientId - Who gets the alert?
 * @param {string} title - Main header
 * @param {string} body - The message content
 * @param {string} type - 'like', 'comment', 'message', 'blood_request'
 * @param {number} referenceId - ID of the post/request/conversation
 * @param {string} clickUrl - Where to go when clicked (e.g., '/feed')
 */
// const sendNotification = async (
//   recipientId,
//   title,
//   body,
//   type,
//   referenceId,
//   clickUrl = "/"
// ) => {
//   try {
//     // 1. Save to Database (For the Notification Bell List)
//     await db.execute(
//       `INSERT INTO notifications (recipient_id, title, body, type, reference_id, is_read)
//              VALUES (?, ?, ?, ?, ?, FALSE)`,
//       [recipientId, title, body, type, referenceId]
//     );

//     // 2. Fetch User's Device Tokens (For Push)
//     const [devices] = await db.execute(
//       `SELECT web_push_subscription FROM user_devices WHERE user_id = ?`,
//       [recipientId]
//     );

//     const payload = JSON.stringify({ title, body, url: clickUrl });

//     for (const device of devices) {
//       console.log("device >> ", device);
//       if (!device.web_push_subscription) {
//         console.log(
//           `Skipping device with ID ${device.id}: No web push subscription.`
//         );
//         continue;
//       }

//       const sub = device.web_push_subscription;

//       console.log(
//         `Attempting to send notification to device ID: ${device.id}`,
//         sub,
//         payload
//       );

//       return await webpush.sendNotification(sub, payload);
//     }
//     console.log(`🔔 Notification sent to User ${recipientId}: ${title}`);
//   } catch (error) {
//     console.log(" error >> ", error);
//     console.error("Notification Service Error:", error.message);
//   }
// };

// 1. Configure Web Push
// webpush.setVapidDetails(
//     'mailto:admin@blooddonation.com',
//     process.env.PUBLIC_VAPID_KEY,
//     process.env.PRIVATE_VAPID_KEY
// );

// 2. Configure Expo (Mobile) Push
const expo = new Expo();

const sendNotification = async (
  recipientId,
  title,
  body,
  type,
  referenceId,
  clickUrl = "/"
) => {
  try {
    // 1. Save to Database (History)
    await db.execute(
      `INSERT INTO notifications (recipient_id, title, body, type, reference_id, is_read) 
       VALUES (?, ?, ?, ?, ?, FALSE)`,
      [recipientId, title, body, type, referenceId]
    );

    // 2. Fetch User's Device Tokens
    const [devices] = await db.execute(
      `SELECT device_type, web_push_subscription FROM user_devices WHERE user_id = ?`,
      [recipientId]
    );

    if (devices.length === 0) return;

    // 3. Loop through devices one by one
    for (const device of devices) {
      // Skip if no token
      if (!device.web_push_subscription) continue;

      // ===========================
      // SCENARIO A: WEB BROWSER
      // ===========================
      if (device.device_type === "web") {
        try {
          const sub = device.web_push_subscription;
          const payload = JSON.stringify({ title, body, url: clickUrl });

          console.log(`🌐 Sending Web Push to device...`);

          // We await here so it finishes before moving to the next device
          await webpush.sendNotification(sub, payload);
        } catch (err) {
          console.error("❌ Web Push Error:", err);
          // Optional: You can add logic here to delete invalid tokens from DB
        }
      }

      // ===========================
      // SCENARIO B: MOBILE APP (Expo)
      // ===========================
      else if (
        device.device_type === "android" ||
        device.device_type === "ios"
      ) {
        try {
          // Clean the token string (remove quotes if stored as JSON string)
          const token = device.web_push_subscription
            .toString()
            .replace(/"/g, "");

          if (!Expo.isExpoPushToken(token)) {
            console.error(`❌ Invalid Expo Push Token: ${token}`);
            continue;
          }

          // Construct the message object
          const messages = [
            {
              to: token,
              sound: "default",
              title: title,
              body: body,
              data: { url: clickUrl, type, referenceId },
            },
          ];

          console.log(`📱 Sending Mobile Push to device...`);

          // Send to Expo Server
          // Even for one message, Expo SDK expects an array or chunks
          const chunks = expo.chunkPushNotifications(messages);
          for (const chunk of chunks) {
            await expo.sendPushNotificationsAsync(chunk);
          }
        } catch (err) {
          console.error("❌ Mobile Push Error:", err);
        }
      }
    }

    console.log(`🔔 Notification process finished for User ${recipientId}`);
  } catch (error) {

    console.log("Notification Service Error:", error);
  }
};

module.exports = sendNotification;
