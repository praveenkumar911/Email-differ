import mongoose from "mongoose";


const ngoSchema = new mongoose.Schema({
    ngo_id: {
        type: String,
        required: true,
        unique: true
    },
    ngoName: {
        type: String,
        required: true
    },
    ngoLogo: {
        type: String,
        required: false
    },
    domain: {
        type: String,
        required: false
    },
    description: {
        type: String,
        required: false
    },
    projectName: {
        type: String,
        required: false
    },
    contact: {
        type: String,
        required: false
    },
    officeAddress: {
        type: String,
        required: false
    },
    created_at: {
        type: String,
        required: true
    },
    verified: {
        type: Boolean,
        required: false,
        default: false
    }
});

const ngoCollection = mongoose.model("ngoCollection", ngoSchema);

export default ngoCollection;