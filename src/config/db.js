import mongoose from 'mongoose';
import logger from './logger.js';

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pingable-dev');
    logger.info('MongoDB connected');
  } catch (err) {
    logger.fatal({ err }, 'MongoDB connection error');
    process.exit(1);
  }
}

export default connectDB;
