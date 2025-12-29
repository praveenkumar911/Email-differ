// server/config/firebaseAdmin.js
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load firebase-admin dynamically. If it's not installed, export stubs and
// continue so the server can run without Firebase during development.
let admin = null;
try {
  const adminPkg = await import('firebase-admin');
  admin = adminPkg.default || adminPkg;
  console.log('✅ firebase-admin package loaded successfully.');
} catch (err) {
  console.warn('⚠️ firebase-admin package not found. Firebase Admin features will be disabled.');
}

// Helper function to find the service account key path
function getServiceAccountPath() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const envPath = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
    if (fs.existsSync(envPath)) {
      console.log(`📂 Using service account path from environment variable: ${envPath}`);
      return envPath;
    }
  }
  const local = path.join(__dirname, "serviceAccountKey.json");
  if (fs.existsSync(local)) {
    console.log(`📂 Found service account file locally: ${local}`);
    return local;
  }
  const parent = path.join(__dirname, "Backend/config/serviceAccountKey.json");
  if (fs.existsSync(parent)) {
    console.log(`📂 Found service account file in parent directory: ${parent}`);
    return parent;
  }
  throw new Error("❌ Firebase serviceAccountKey.json not found. Please check your configuration.");
}

// ---------------------------------------------------------------------------
//  Initialize Firebase Admin SDK
// ---------------------------------------------------------------------------
let auth = null;
if (admin) {
  if (!admin.apps.length) {
    try {
      const serviceAccountPath = getServiceAccountPath();
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
      });
      console.log('✅ Firebase Admin SDK initialized successfully.');
    } catch (err) {
      console.error(`❌ Failed to initialize Firebase Admin SDK: ${err.message}`);
    }
  } else {
    console.log('⚠️ Firebase Admin SDK is already initialized.');
  }
  auth = admin.auth();
} else {
  // Provide a minimal stub so other modules can import without crashing.
  auth = null;
  console.warn('⚠️ Firebase Admin not initialized — no auth available.');
}

// ---------------------------------------------------------------------------
//  Verify Firebase ID Token Helper (optional)
// ---------------------------------------------------------------------------
async function verifyFirebaseIdToken(idToken, expectedPhone) {
  if (!auth) {
    throw new Error("❌ Firebase Admin not initialized — missing credentials.");
  }

  try {
    const decoded = await auth.verifyIdToken(idToken, true);
    const phone = decoded.phone_number || null;

    if (!phone) {
      throw new Error("❌ Firebase token missing phone_number claim.");
    }

    const normalize = (num) =>
      num?.replace(/\s+/g, "").replace(/^00/, "+") || null;

    const match = expectedPhone
      ? normalize(phone) === normalize(expectedPhone)
      : true;

    console.log(`✅ Firebase token verified successfully. Phone match: ${match ? '✔️' : '❌'}`);

    return {
      valid: true,
      decoded,
      phone,
      isPhoneMatch: match,
      message: "Token verified successfully.",
    };
  } catch (err) {
    
    console.error(`❌ Firebase token verification failed: ${err.message}`);
    return {
      valid: false,
      message: err.message || "Invalid or expired Firebase token.",
    };
  }
}

// ---------------------------------------------------------------------------
//  Export Everything
// ---------------------------------------------------------------------------
export { admin, auth, verifyFirebaseIdToken };
