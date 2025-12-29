import mongoose from "mongoose";

const projectsSchema = new mongoose.Schema({
  project_id: { type: String, required: true, unique: true },
  projectName: { type: String },
  githubUrl: { type: String },
  complexity: { type: String, enum: ["low", "medium", "high"], default: "medium" },
  description: { type: String },
  assignedTo: { type: [String], default: [] },
  created_at: { type: Date },
  repoId: { type: String, default: null },
  domain: { type: [String], default: [] },
  owner: { type: String },
  techStack: { type: [String], default: [] },
  source: { type: String },
  mentors: { type: [String], default: [] },
  status: {
    type: String,
    enum: ["ongoing", "prMerged", "completed"],
    default: "ongoing"
  }
});

const Project = mongoose.model("Project", projectsSchema);
export default Project;
