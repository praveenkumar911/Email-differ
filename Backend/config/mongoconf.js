import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config(); 

const mongoURI = process.env.MONGO_URI;

export const connectDB = async () => {
  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error(' MongoDB connection error:', err.message);
    process.exit(1); // Exit process if DB connection fails
  }
};
