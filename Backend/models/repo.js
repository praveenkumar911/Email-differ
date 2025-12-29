import mongoose from "mongoose";

const repoSchema = new mongoose.Schema({
  repoId: { type: String, required: true, unique: true },
  repoName: { type: String, required: true },
  repoSlug: { type: String, required: true, unique: true },
  repoDescription: { type: String },
  repoUrl: { type: String, required: true },
  owner: { type: String },
  source: { type: String },
  projectIds: { type: [String], default: [] },
  domains: { type: [String], default: [] },
  totalProjects: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const Repo = mongoose.model("Repo", repoSchema);
export default Repo;
