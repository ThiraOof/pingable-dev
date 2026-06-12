import mongoose from 'mongoose';

const BASE = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017';

/**
 * Connect mongoose to a throwaway test database (one DB per test file so
 * parallel files can't clash). Returns true when connected, false when no
 * MongoDB is reachable — callers skip their DB suites in that case (CI always
 * provides a mongod service, so a skip only happens on a dev box without one).
 */
export async function connectTestDb(dbName) {
  try {
    await mongoose.connect(`${BASE.replace(/\/+$/, '')}/${dbName}`, {
      serverSelectionTimeoutMS: 2000,
    });
    await mongoose.connection.dropDatabase(); // start every run clean
    return true;
  } catch {
    // eslint-disable-next-line no-console
    console.warn(`[tests] MongoDB not reachable at ${BASE} — skipping DB-backed tests (${dbName})`);
    return false;
  }
}

export async function disconnectTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect();
  }
}
