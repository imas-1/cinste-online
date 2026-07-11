import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { tokens, title, body } = req.body || {};
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      res.status(400).json({ error: "Lipsesc token-urile" });
      return;
    }

    const message = {
      notification: { title: title || "Caietul de cinste", body: body || "" },
      tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    res.status(200).json({ success: true, successCount: response.successCount, failureCount: response.failureCount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
