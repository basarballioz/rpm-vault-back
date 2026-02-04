import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let firebaseApp = null;

export function initializeFirebase() {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    // Option 1: Service account JSON file
    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const serviceAccount = JSON.parse(
        readFileSync(resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH), 'utf-8')
      );
      
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      
      console.log('✅ Firebase Admin initialized with service account file');
    }
    // Option 2: Service account JSON string (for env variables)
    else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      
      console.log('✅ Firebase Admin initialized with service account env');
    }
    // Option 3: Individual credentials
    else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      
      console.log('✅ Firebase Admin initialized with individual credentials');
    } else {
      console.warn('⚠️  Firebase Admin not initialized - no credentials provided');
      console.warn('   Authentication endpoints will not work');
      return null;
    }

    return firebaseApp;
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error.message);
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
