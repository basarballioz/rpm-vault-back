import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let firebaseApp = null;

export function initializeFirebase() {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    // Option 1: Individual credentials (PRIORITY for Vercel)
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      console.log('Initializing Firebase with individual credentials...');
      console.log('   Project ID:', process.env.FIREBASE_PROJECT_ID);
      console.log('   Client Email:', process.env.FIREBASE_CLIENT_EMAIL);
      console.log('   Private Key length:', process.env.FIREBASE_PRIVATE_KEY?.length || 0);

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });

      console.log('Firebase Admin initialized with individual credentials');
    }
    // Option 2: Service account JSON string (for env variables)
    else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log('Initializing Firebase with service account env...');
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      console.log('Firebase Admin initialized with service account env');
    }
    // Option 3: Service account JSON file (only for local dev)
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      console.log('Initializing Firebase with service account file...');
      const serviceAccount = JSON.parse(
        readFileSync(resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH), 'utf-8')
      );

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      console.log('Firebase Admin initialized with service account file');
    } else {
      console.error('Firebase Admin not initialized - no credentials provided');
      console.error('   Required: FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY');
      console.error('   Or: FIREBASE_SERVICE_ACCOUNT');
      console.error('   Or: FIREBASE_SERVICE_ACCOUNT_PATH (local only)');
      return null;
    }

    return firebaseApp;
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error.message);
    console.error('   Stack:', error.stack);
    return null;
  }
}

export function getAuth() {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return firebaseApp ? admin.auth() : null;
}

export default admin;
