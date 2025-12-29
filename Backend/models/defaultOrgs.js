import mongoose from "mongoose";
import {ORGANIZATIONS,ORG_TYPE_MAPPINGS} from '../config/defalutOrgsConstants.js'

const defaultOrgsSchema = new mongoose.Schema({
  orgName: {
    type: String,
    required: true,
  },
  orgType: {
    type: String,
    required: true,
  },
});


const defaultOrgsCollection = mongoose.model('defaultOrgCollection', defaultOrgsSchema);

async function seedOrganizations() {
  try {
    // Check if the collection already has data
    const count = await defaultOrgsCollection.countDocuments();

    if (count > 0) {
      console.log('Data already exists');
      return;
    }

    // Prepare the organizations data
    const organizationsToSeed = ORGANIZATIONS.map((orgName) => {
      return {
        orgName,
        orgType: ORG_TYPE_MAPPINGS[orgName] || "Other", // Default to "Other" if no mapping is found
      };
    });

    // Insert into the database
    await defaultOrgsCollection.insertMany(organizationsToSeed);

    console.log('Organizations added successfully!');
  } catch (err) {
    console.error('Error adding organizations:', err);
  }
}


export { seedOrganizations, defaultOrgsCollection };
