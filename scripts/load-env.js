// Loads .env as the very first thing the seeder does.
// ESM evaluates imports top-to-bottom, so importing this module before any
// seed-data module guarantees process.env (e.g. GNS3_VYOS_TEMPLATE) is
// populated by the time those modules read it.
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });
