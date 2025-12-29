import mongoose from "mongoose";

const orgsSchema = new mongoose.Schema({
    org_id: {
        type: String,
        required: true,
        unique: true
    },
    orgName: {
        type: String,
        required: true
    },
    orgLogo: {
        type: String,
        required: false
    },
    website: {
        type: String,
        required: false
    },
    description: {
        type: String,
        required: false
    },
    created_at: {   
        type: String,
        required: true
    },
    githubUrl: {
        type: String,
        required: false
    },
    contact:{
        type: String,
        required: false
    },
    orgtype:{
        type: String,
        required: false
    },
    domain: { type: [String], default: [] },
    techStack: { type: [String], default: [] },
    source:{
        type: String,
        required: false
    },
    ranking: Number,
    rating  : Number,
});

const Orgs = mongoose.model("Orgs", orgsSchema);

export default Orgs;