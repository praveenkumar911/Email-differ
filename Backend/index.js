import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import projectRoutes from './routes/projects_routes.js'
import orgroutes from './routes/org_routes.js'
import userroutes from './routes/user_routes.js'
import cron from 'node-cron';
import { resendDeferredEmails } from './controllers/emailController.js';
import expireNeverOpened from './jobs/expireNeverOpened.js';
import expireStaleActivations from './jobs/expireStaleActivations.js';
import { admin } from "./config/firebaseAdmin.js";
import emailRoutes from './routes/emailRoutes.js';
import formRoutes from './routes/formRoutes.js';
import authRoutes from "./routes/auth.routes.js";
import discordRoutes from "./routes/discord_routes.js";

import EmailLog from './models/EmailLog.js';
import PartialUpdateData from './models/PartialUpdateData.js'; // ✅ Add import

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // ✅ Increase limit for large Firebase tokens
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Connect to MongoDB
connectDB();
// Sample POST route
app.get('/', (_, res) => {
    res.json({ message: "Hello Badal API HERE" });
});



// Error handling middleware
app.use((err, req, res, next) => {
    // ✅ Handle JSON parsing errors specifically
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('❌ JSON Parse Error:', err.message);
        console.error('Request body:', req.body);
        return res.status(400).json({ 
            error: 'Invalid JSON format in request body',
            message: 'Please check your request data format'
        });
    }
    
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.use('/api/email', emailRoutes);
app.use('/api/form', formRoutes);
app.use("/api/auth", authRoutes);

app.use('/api',projectRoutes)
app.use('/api',orgroutes)
app.use('/api',userroutes)
app.use("/api/discord", discordRoutes);


// 1️⃣ Stale activations: clean up every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('🧹 Production: Checking for stale activations...');
  try {
    await expireStaleActivations();
  } catch (err) {
    console.error('❌ Failed:', err.message);
  }
});

// 2️⃣ 24h-old unopened tokens: run once daily
cron.schedule('0 2 * * *', expireNeverOpened); 
// → Every day at 2:00 AM (low traffic time)

// 3️⃣ Deferred emails: send every 15 minutes (changed for testing)
cron.schedule('*/15 * * * *', async () => {
  console.log('📨 Production: Resending deferred emails (every 15 minutes)...');
  try {
    await resendDeferredEmails();
  } catch (err) {
    console.error('❌ resendDeferredEmails failed:', err?.message || err);
  }
});

// 4️⃣ Cleanup expired opt-out tokens: run daily at 3 AM
cron.schedule('0 3 * * *', async () => {
  console.log('🗑️ Production: Cleaning opt-out tokens...');
  // await cleanupOptOutTokens();
});

// 5️⃣ Cleanup old EmailLog records: run weekly on Sunday at 4 AM
cron.schedule('0 4 * * 0', async () => {
  console.log('🧹 Production: Cleaning old EmailLog records...');
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days ago
    
    // ✅ Only delete logs that were either used or never activated
    const result = await EmailLog.deleteMany({
      $and: [
        { sentAt: { $lt: cutoffDate } },
        { 
          $or: [
            { usedAt: { $exists: true, $ne: null } }, // Used tokens
            { activatedAt: null } // Never opened
          ]
        }
      ]
    });
    
    console.log(`✅ Deleted ${result.deletedCount} EmailLog records older than 90 days`);
  } catch (err) {
    console.error('❌ EmailLog cleanup failed:', err.message);
  }
});

// 6️⃣ Cleanup old PartialUpdateData: run daily at 5 AM
cron.schedule('0 5 * * *', async () => {
  console.log('🗑️ Production: Cleaning orphaned PartialUpdateData...');
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days old
    
    const result = await PartialUpdateData.deleteMany({
      lastSavedAt: { $lt: cutoffDate }
    });
    
    console.log(`✅ Deleted ${result.deletedCount} orphaned PartialUpdateData records`);
  } catch (err) {
    console.error('❌ PartialUpdateData cleanup failed:', err.message);
  }
});

// Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
