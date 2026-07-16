import admin from "firebase-admin";

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY_B64
    ? Buffer.from(process.env.FIREBASE_PRIVATE_KEY_B64, "base64").toString("utf-8").trim() + "\n"
    : (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: (process.env.FIREBASE_PROJECT_ID || "").trim(),
      clientEmail: (process.env.FIREBASE_CLIENT_EMAIL || "").trim(),
      privateKey,
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

    console.log(`Notify: ${response.successCount} succes, ${response.failureCount} eșec din ${tokens.length} token-uri`);
    response.responses.forEach((r, i) => {
      if (!r.success) {
        console.log(`Token eșuat [${i}]: ${tokens[i].slice(0, 20)}... -> ${r.error?.code} ${r.error?.message}`);
      }
    });

    res.status(200).json({ success: true, successCount: response.successCount, failureCount: response.failureCount });
  } catch (e) {
    console.log("Notify eroare fatală:", e.message);
    res.status(500).json({ error: e.message });
  }
}
