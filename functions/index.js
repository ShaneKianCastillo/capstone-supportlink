// functions/index.js
const admin = require("firebase-admin");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");

admin.initializeApp();
const db = admin.firestore();

exports.emailOnNewAssetRequest = onDocumentCreated(
  "assetRequests/{requestId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const r = snap.data();
    const requestId = event.params.requestId;

    // Find the Property Custodian user (by role)
    const usersSnap = await db
      .collection("users")
      .where("role", "==", "Property Custodian")
      .limit(1)
      .get();

    if (usersSnap.empty) {
      console.log("No Property Custodian user found; skipping email.");
      return;
    }

    const custodian = usersSnap.docs[0].data();
    const toEmail = custodian.email;
    if (!toEmail) {
      console.log("Custodian user has no email; skipping email.");
      return;
    }

    // Optionally enrich from users/{uid}
    let userName = r.userName || "—";
    let userDept = r.userDept || "—";
    if ((!r.userName || !r.userDept) && r.uid) {
      try {
        const uSnap = await db.doc(`users/${r.uid}`).get();
        if (uSnap.exists) {
          const u = uSnap.data() || {};
          userName = u.name || userName;
          userDept = u.department || userDept;
        }
      } catch (e) {
        console.warn("Failed to fetch requester profile:", e);
      }
    }

    const createdAt = r.serverTimeStamp?.toDate?.()?.toLocaleString?.() || "—";

    const html = `
      <div style="font-family:system-ui,Segoe UI,Roboto,Arial">
        <h2>New Asset Request</h2>
        <p><strong>From:</strong> ${userName}</p>
        <p><strong>Department:</strong> ${userDept}</p>
        <p><strong>Submitted:</strong> ${createdAt}</p>
        <hr/>
        <p><strong>Asset Name:</strong> ${r.assetName || "—"}</p>
        <p><strong>Reason:</strong> ${r.reason || "—"}</p>
        ${r.imageUrl ? `<p><strong>Image:</strong> <a href="${r.imageUrl}">View</a></p>` : ""}
        <p><strong>Request ID:</strong> ${requestId}</p>
      </div>
    `;

    // Write a mail doc that the SMTP Trigger Email extension will send
    await db.collection("mail").add({
      to: toEmail,
      message: { subject: "New Asset Request Submitted", html },
    });
  }
);
