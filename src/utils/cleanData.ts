/**
 * Recursively removes all keys whose values are undefined so Firestore WriteBatch/setDoc/updateDoc
 * will never fail with "Function WriteBatch.set() called with invalid data. Unsupported field value: undefined"
 */
export function cleanFirestoreData<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => (typeof item === 'object' && item !== null ? cleanFirestoreData(item) : item)) as unknown as T;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        result[key] = cleanFirestoreData(value);
      }
    }
    return result as T;
  }
  return data;
}
