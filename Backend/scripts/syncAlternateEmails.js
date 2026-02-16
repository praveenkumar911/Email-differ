/**
 * Migration Script: Sync alternateEmails from User to EmailUser
 * 
 * This script populates the alternateEmails field in the EmailUser collection
 * by fetching data from the User (usercollection) model.
 * 
 * Usage:
 *   node scripts/syncAlternateEmails.js
 * 
 * Run this:
 * - Once initially to populate existing EmailUser documents
 * - Periodically (weekly/monthly) or as a cron job to keep data in sync
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/usercollection.js';
import EmailUser from '../models/EmailUsers.js';

// Load environment variables
dotenv.config();

const syncAlternateEmails = async () => {
  try {
    console.log('🔄 Starting alternateEmails sync...');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/your-database';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Fetch all users from User collection
    const users = await User.find({ primaryEmail: { $exists: true } })
      .select('primaryEmail alternateEmails')
      .lean(); // Convert to plain JS objects for better performance

    console.log(`📋 Found ${users.length} users with primary emails`);

    let syncedCount = 0;
    let notFoundCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    // Process each user
    for (const user of users) {
      try {
        // Skip if no primary email
        if (!user.primaryEmail) {
          continue;
        }

        // Find corresponding EmailUser by primary email
        const emailUser = await EmailUser.findOne({ email: user.primaryEmail });

        if (!emailUser) {
          notFoundCount++;
          console.log(`⚠️  No EmailUser found for ${user.primaryEmail}`);
          continue;
        }

        // Check if alternateEmails need updating
        const currentAlternates = emailUser.alternateEmails || [];
        const newAlternates = user.alternateEmails || [];

        // Sort and compare arrays to see if update is needed
        const currentSorted = [...currentAlternates].sort();
        const newSorted = [...newAlternates].sort();

        const needsUpdate = JSON.stringify(currentSorted) !== JSON.stringify(newSorted);

        if (needsUpdate) {
          // Update EmailUser with new alternateEmails
          await EmailUser.updateOne(
            { _id: emailUser._id },
            { $set: { alternateEmails: newAlternates } }
          );
          
          updatedCount++;
          console.log(`✅ Updated ${user.primaryEmail} with ${newAlternates.length} alternate email(s)`);
        } else {
          syncedCount++;
        }

      } catch (err) {
        errorCount++;
        console.error(`❌ Error processing ${user.primaryEmail}:`, err.message);
      }
    }

    // Summary
    console.log('\n📊 Sync Summary:');
    console.log(`   ✅ Already synced: ${syncedCount}`);
    console.log(`   🔄 Updated: ${updatedCount}`);
    console.log(`   ⚠️  EmailUser not found: ${notFoundCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📋 Total processed: ${users.length}`);

    // Close connection
    await mongoose.connection.close();
    console.log('\n✅ Sync completed. Database connection closed.');

  } catch (err) {
    console.error('❌ Fatal error during sync:', err);
    process.exit(1);
  }
};

// Run the sync
syncAlternateEmails();
