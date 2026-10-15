import mongoose from 'mongoose';
import 'dotenv/config';

export const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookable';

export async function connect() {
  await mongoose.connect(MONGO_URI);
  console.log(`[db] connected to ${MONGO_URI}`);
}
