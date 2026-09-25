import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  reauthenticateWithPopup,
  GoogleAuthProvider,
  signOut,
  User
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firestore directly as specified by Firebase Skill
export const db = (() => {
  const databaseId = (firebaseConfig as any).firestoreDatabaseId;
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      databaseId
    );
  } catch (error) {
    console.warn('Firestore offline cache unavailable; using standard Firestore client.', error);
    return getFirestore(app, databaseId);
  }
})();
export const auth = getAuth(app);

// Configure Google Provider with the narrow Drive scope used by this app.
const GOOGLE_DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope(GOOGLE_DRIVE_FILE_SCOPE);

// In-memory token cache for Google Workspace Drive API

let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string | null } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Request Google Drive access for an already authenticated Google user.
 * This keeps the Firebase session intact and only refreshes the Google OAuth
 * credential needed by the browser-side Drive API calls.
 */
export const connectGoogleDrive = async (): Promise<{ user: User; accessToken: string } | null> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    const result = await googleSignIn();
    if (!result?.accessToken) {
      throw new Error('Login Google berhasil, tetapi izin Google Drive belum diberikan.');
    }
    return { user: result.user, accessToken: result.accessToken };
  }

  try {
    isSigningIn = true;
    const result = await reauthenticateWithPopup(currentUser, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || null;

    if (!accessToken) {
      throw new Error('Izin Google Drive tidak menghasilkan access token.');
    }

    cachedAccessToken = accessToken;
    return { user: result.user, accessToken };
  } finally {
    isSigningIn = false;
  }
};

export const clearCachedAccessToken = () => {
  cachedAccessToken = null;
};

export const logout = async () => {
  await signOut(auth);
  clearCachedAccessToken();
};

// Error Handling according to Firebase Skill specification
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test on boot
export async function testConnection(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.warn('Firestore is running in offline mode.');
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Firestore connection check warning:', error);
    return false;
  }
}
