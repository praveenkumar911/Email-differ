import pgPool from '../config/postgresconf.js';
import Project from '../models/projects.js';
import Orgs from '../models/orgs.js';
import Repo from "../models/repo.js";
import {User} from '../models/usercollection.js';
import { GoogleGenerativeAI } from "@google/generative-ai";



// ==========================
// BATCH CLEANING (MAIN FIX)
// ==========================
async function cleanBatchWithGemini(batch) {
  let attempts = 0;

  while (attempts < 5) {
    try {
      const prompt = `
You are a strict project metadata normalization engine.

INPUT:
${JSON.stringify(batch, null, 2)}

OUTPUT:
Return ONLY a VALID JSON ARRAY. No markdown, no backticks, no explanation.
The output array MUST be the same length as the input array.

Each item MUST follow EXACTLY this structure:
{
  "projectName": "",        
  "description": "",
  "techStack": [],
  "domain": [],
  "complexity": ""
}

======================
   STRICT RULES
======================

1) projectName
   - DO NOT modify it.
   - Return exactly the same text as the input's projectName.

2) description
   - Rewrite into a clean short 1–2 sentence summary.
   - Remove HTML tags, words like "strong", quotes, JSON blobs, and formatting junk.
   - NO nested JSON, NO bullet points, NO long paragraphs.

3) techStack
   - Extract ONLY REAL technology keywords.
   - REMOVE sentences like:
        "Experience with..."
        "Knowledge of..."
        "Understanding of..."
        "Familiarity with..."
   - REMOVE roles, responsibilities, soft skills, multi-line descriptions.
   - Keep only valid tech terms such as:
     ["python","java","javascript","typescript","nodejs",
      "react","angular","vue","go","kotlin","swift","php",
      "c++","c#","html","css","docker","kubernetes","aws",
      "gcp","azure","postgresql","mysql","mongodb","redis",
      "fastapi","django","flask","spring","express","graphql",
      "rest api","tensorflow","pytorch"]
   - Convert to lowercase.
   - Remove duplicates.
   - Output must be an array of clean skills.

4) domain
   - Convert domains into short category labels (1–3 words max).
   - Examples: ["healthcare","gis","frontend","backend","education","ai","hr"]
   - Remove formatting junk, long paragraphs, and weird strings.

5) complexity
   - Normalize to one of:
       ["easy","medium","hard","very easy","very hard"]
   - If input has noise like:
       "strongMediumstrong"
     → map to "medium".

6) NEVER output markdown, backticks, comments, text outside JSON.
7) Output must be a valid JSON array only.
`;


      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const response = await model.generateContent(prompt);
      let raw = response.response.text();

      // Clean formatting
      raw = raw.replace(/```json/gi, "")
               .replace(/```/g, "")
               .trim();

      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("Gemini did not return JSON array");

      return JSON.parse(match[0]);
    }

    catch (err) {
      console.log(`Batch AI failed (attempt ${attempts + 1}):`, err.message);

      // exponential backoff
      await new Promise(r => setTimeout(r, 2000 * (attempts + 1)));

      attempts++;
    }
  }

  console.log("⚠ Gemini unavailable — using fallback cleaner for batch");
  return batch.map(item => cleanLocally(item));
}




// Chunk array for batch processing (default 50)
function chunkArray(arr, size = 50) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}


// Extract owner/repo from any GitHub URL
function extractRepoSlug(url) {
  if (!url || !url.includes("github.com")) return null;
  url = url.split("?")[0].split("#")[0].replace(/\/+$/, "");

  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/i);
  if (!match) return null;

  return `${match[1].toLowerCase()}/${match[2].toLowerCase()}`;
}


// Generate incremental RepoId
async function generateRepoId() {
  const last = await Repo.findOne().sort({ repoId: -1 }).lean();
  if (!last) return "RE001";

  const num = parseInt(last.repoId.replace("RE", "")) + 1;
  return `RE${String(num).padStart(3, "0")}`;
}



// ==========================================
//              MASTER SYNC
// ==========================================
export async function syncProjectsData() {
  try {
    console.log("Sync Started...");

    // -----------------------------
    // Load Postgres Data
    // -----------------------------
    const dmp = await pgPool.query(`
      SELECT 
        issue_id,
        name,
        url,
        product,
        project_category,
        mentors,
        reqd_skills,
        organization,
        status,
        created_at,
        api_endpoint_url,
        complexity
      FROM dmp_tickets
    `);

    const community = await pgPool.query(`
      SELECT 
        id,
        link,
        org_id,
        title,
        description,
        technology,
        domain,
        status,
        created_at,
        complexity
      FROM issues
    `);

    // -----------------------------
    // ORG MAPPING
    // -----------------------------
    const orgDocs = await Orgs.find({}).lean();
    const orgMap = {};
    for (const o of orgDocs) {
      if (o.orgName) orgMap[o.orgName.trim().toLowerCase()] = o.org_id;
    }

    // -----------------------------
    // PREPARE RAW LIST FOR BATCH AI
    // -----------------------------
    let rawList = [];

    // DMP
    for (const row of dmp.rows) {
      rawList.push({
        id: `P${row.issue_id}`,
        projectName: row.name,
        description: row.product,
        techStack: row.reqd_skills,
        domain: row.project_category,
        complexity: row.complexity || "medium",
        source: "DMP",
        row
      });
    }

    // Community
    for (const row of community.rows) {
      rawList.push({
        id: `P${row.id}`,
        projectName: row.title,
        description: row.description,
        techStack: row.technology,
        domain: row.domain,
        complexity: row.complexity || "medium",
        source: "Community",
        row
      });
    }

    console.log("Total projects to clean:", rawList.length);


    // -----------------------------
    // BATCH CLEANING
    // -----------------------------
    const batches = chunkArray(rawList, 50);
    let cleanedList = [];

    for (const batch of batches) {
      console.log(`Cleaning batch of ${batch.length}...`);
      const cleaned = await cleanBatchWithGemini(batch);
      cleanedList.push(...cleaned);
    }

    // -----------------------------
    // MERGE CLEANED DATA + SAVE
    // -----------------------------
    const repoCache = {};
    const OPS = [];

    async function getOrCreateRepo(githubUrl, source) {
      const slug = extractRepoSlug(githubUrl);
      if (!slug) return null;

      if (repoCache[slug]) return repoCache[slug];

      let repo = await Repo.findOne({ repoSlug: slug });
      if (!repo) {
        const repoId = await generateRepoId();
        repo = await Repo.create({
          repoId,
          repoSlug: slug,
          repoName: slug.split("/")[1],
          repoUrl: `https://github.com/${slug}`,
          source,
          totalProjects: 0
        });
      }

      repoCache[slug] = repo.repoId;
      return repo.repoId;
    }


    for (let i = 0; i < cleanedList.length; i++) {
      const clean = cleanedList[i];
      const orig = rawList[i];
      const row = orig.row;

      // Construct GitHub URL
      let githubUrl = "";
      if (orig.source === "DMP") {
        if (row.url && row.url.includes("github.com")) githubUrl = row.url;
        else if (row.api_endpoint_url?.includes("api.github.com/repos")) {
          githubUrl = row.api_endpoint_url.replace("api.github.com/repos", "github.com");
        }
      } else {
        githubUrl = row.link;
      }

      if (!githubUrl) continue;

      const repoId = await getOrCreateRepo(githubUrl, orig.source);
      const owner =
        orig.source === "DMP"
          ? orgMap[row.organization?.trim()?.toLowerCase()] || "ORG_UNKNOWN"
          : row.org_id ? `ORG${row.org_id}` : "ORG_UNKNOWN";

      const doc = {
        project_id: orig.id,
        ...clean,
        created_at: row.created_at ? new Date(row.created_at) : null,
        mentors: Array.isArray(row.mentors) ? row.mentors : [],
        status: row.status || "open",
        githubUrl,
        repoId,
        owner,
        source: orig.source,
        assignedTo: []
      };

      OPS.push({
        updateOne: {
          filter: { project_id: orig.id },
          update: { $set: doc },
          upsert: true
        }
      });
    }

    // SAVE ALL
    const result = await Project.bulkWrite(OPS, { ordered: false });

    // Update repo counts
    for (const slug in repoCache) {
      const repoId = repoCache[slug];
      const count = await Project.countDocuments({ repoId });
      await Repo.updateOne({ repoId }, { $set: { totalProjects: count } });
    }

    return {
      success: true,
      message: "FULL CLEAN + AI BATCH SYNC COMPLETED",
      inserted: result.upsertedCount,
      updated: result.modifiedCount
    };

  } catch (err) {
    console.error("SYNC ERROR:", err);
    return { success: false, error: err.message };
  }
}


async function getProjectsData(projectId = null) {
  try {
    const query = projectId ? { project_id: projectId } : {};
    const projects = await Project.find(query).lean();

    // Clean domain list
    const extractDomains = (domain) => {
      if (!domain) return [];
      if (Array.isArray(domain)) return domain.map(d => d.toLowerCase().trim());
      if (typeof domain === "string") {
        return domain
          .split(/[,;]+/)
          .map(d => d.toLowerCase().trim())
          .filter(Boolean);
      }
      return [];
    };

    // Clean & extract tech skills
    const extractSkills = (stack) => {
      if (!stack) return [];
      if (Array.isArray(stack)) stack = stack.join(',');
      if (typeof stack !== 'string') return [];

      return stack
        .replace(/[\n\\]/g, ',')
        .split(/[,;]/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(s =>
          s.toLowerCase()
            .replace(/["'()]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
        )
        .filter(clean =>
          clean.length > 1 &&
          !clean.includes('required') &&
          !clean.includes('skill') &&
          clean !== 'other'
        );
    };

    // Ensure project.domain is always cleaned
    projects.forEach(p => {
      p.domain = extractDomains(p.domain);
    });

    // Group by source
    const grouped = {};
    for (const p of projects) {
      const source = (p.source || 'UNKNOWN').trim();
      if (!grouped[source]) grouped[source] = [];
      grouped[source].push(p);
    }

    // Build techSkills and domains dynamically
    const techSkills = {};
    const domainsBlock = {};

    for (const [source, groupProjects] of Object.entries(grouped)) {
      // Collect skills
      const skillSet = new Set();
      const skillCount = {};

      // Collect domains
      const domainSet = new Set();
      const domainCount = {};

      groupProjects.forEach(p => {
        // Skills
        const skills = extractSkills(p.techStack);
        skills.forEach(skill => {
          skillSet.add(skill);
          skillCount[skill] = (skillCount[skill] || 0) + 1;
        });

        // Domains
        const doms = extractDomains(p.domain);
        doms.forEach(d => {
          domainSet.add(d);
          domainCount[d] = (domainCount[d] || 0) + 1;
        });
      });

      // Sort by most frequent
      const sortedSkills = [...skillSet].sort((a, b) => (skillCount[b] || 0) - (skillCount[a] || 0));
      const sortedDomains = [...domainSet].sort((a, b) => (domainCount[b] || 0) - (domainCount[a] || 0));

      // Assign dynamic blocks
      techSkills[source] = {
        summary: {
          totalProjects: groupProjects.length,
          uniqueSkills: sortedSkills.length
        },
        skills: sortedSkills
      };

      domainsBlock[source] = {
        summary: {
          totalProjects: groupProjects.length,
          uniqueDomains: sortedDomains.length
        },
        domains: sortedDomains
      };
    }

    // Global summary
    const allSkills = new Set();
    projects.forEach(p =>
      extractSkills(p.techStack).forEach(s => allSkills.add(s))
    );

    return {
      success: true,
      summary: {
        totalProjects: projects.length,
        uniqueSkills: allSkills.size,
        updatedAt: new Date()
      },

      techSkills,     // DMP: {skills...}, Community: {skills...}
      domains: domainsBlock, // DMP: {domains...}, Community: {domains...}

      data: projects  // projects now include cleaned domain[]
    };

  } catch (error) {
    console.error(error);
    return { success: false, error: error.message };
  }
}

export async function getRepoStats(req = null, res = null) {
  try {
    const repos = await Repo.find({}).lean();
    const projects = await Project.find({}).lean();

    // ---------- REPO STATS WITH NEW STATUS ----------
    const repoStats = repos.map(repo => {
      const repoProjects = projects.filter(p => p.repoId === repo.repoId);

      const statuses = repoProjects.map(
        p => (p.status || "").toLowerCase()
      );

      let repoStatus = "unknown";

      if (statuses.length) {
        if (statuses.every(s => s === "completed" || s==="closed" )) repoStatus = "completed";
        else if (statuses.some(s => s === "ongoing" || s==="open")) repoStatus = "ongoing";
        else if (statuses.some(s => s === "prmerged")) repoStatus = "prMerged";
      }

      const domains = [...new Set(repoProjects.flatMap(p => p.domain || []))];

      return {
        repoId: repo.repoId,
        repoName: repo.repoName,
        repoUrl: repo.repoUrl,
        source: repo.source,
        owner: repo.owner,
        status: repoStatus,
        noOfProjects: repoProjects.length,
        domains,
        projects: repoProjects,
        createdAt: repo.createdAt
      };
    });

    // ---------- GROUP PROJECTS BY SOURCE ----------
    const sourceGrouped = {};
    for (const p of projects) {
      const source = p.source || "Unknown";
      if (!sourceGrouped[source]) sourceGrouped[source] = [];
      sourceGrouped[source].push(p);
    }

    // ---------- techSkills + domains (DYNAMIC PER SOURCE) ----------
    const techSkills = {};
    const domainsBlock = {};

    Object.keys(sourceGrouped).forEach(source => {
      const projList = sourceGrouped[source];

      // skills
      const skills = projList.flatMap(p => p.techStack || []);
      const uniqueSkills = [...new Set(skills.map(s => s.toLowerCase()))];

      // domains
      const domains = projList.flatMap(p => p.domain || []);
      const uniqueDomains = [...new Set(domains.map(d => d.toLowerCase()))];

      techSkills[source] = { skills: uniqueSkills };
      domainsBlock[source] = { domains: uniqueDomains };
    });

    // ---------- GLOBAL SUMMARY ----------
    const allSkills = projects.flatMap(p => p.techStack || []);
    const uniqueGlobalSkills = [...new Set(allSkills.map(s => s.toLowerCase()))];

    const finalOutput = {
      success: true,

      summary: {
        totalProjects: projects.length,
        uniqueSkills: uniqueGlobalSkills.length,
        updatedAt: new Date()
      },

      // Organized by source (DMP, Community, etc.)
      techSkills,
      domains: domainsBlock,

      totalRepos: repoStats.length,
      repos: repoStats,
      updatedAt: new Date()
    };

    if (res) return res.json(finalOutput);
    return finalOutput;

  } catch (err) {
    console.error("getRepoStats error:", err);
    const errorOut = { success: false, error: err.message };
    if (res) return res.status(500).json(errorOut);
    return errorOut;
  }
}



export const getRepoById = async (req, res) => {
  try {
    const { repoId } = req.params;

    if (!repoId) {
      return res.status(400).json({
        success: false,
        error: "repoId is required"
      });
    }

    const repo = await Repo.findOne({ repoId }).lean();
    if (!repo) {
      return res.status(404).json({
        success: false,
        message: `Repo ${repoId} not found`
      });
    }

    // Fetch projects under this repo
    const projects = await Project.find({ repoId: repo.repoId }).lean();

    // Fetch org (if exists)
    const org = await Orgs.findOne({ org_id: repo.owner }).lean();

    return res.json({
      success: true,
      repo: {
        ...repo,
        totalProjects: projects.length,
        domains: [...new Set(projects.flatMap(p => p.domain || []))],
        organization: org || null
      },
      projects
    });

  } catch (err) {
    console.error("getRepoById Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

export const editRepoById = async (req, res) => {
  try {
    const { repoId } = req.params;
    const { repoName, repoUrl, source, domains,repoDescription } = req.body;

    if (!repoId) {
      return res.status(400).json({
        success: false,
        error: "repoId is required"
      });
    }

    const repo = await Repo.findOne({ repoId }).lean();
    if (!repo) {
      return res.status(404).json({
        success: false,
        message: `Repo ${repoId} not found`
      });
    }

    const updates = {};
    if (repoName) updates.repoName = repoName;
    if (repoUrl) updates.repoUrl = repoUrl;
    if (source) updates.source = source;
    if (domains) updates.domains = domains;
    if (repoDescription) updates.repoDescription = repoDescription;

    // Update repo
    await Repo.updateOne({ repoId }, { $set: updates });

    // Update all linked projects
    await Project.updateMany(
      { repoId },
      {
        $set: {
          source: source || repo.source,
          domain: domains || repo.domains
        }
      }
    );

    const updatedRepo = await Repo.findOne({ repoId }).lean();
    const updatedProjects = await Project.find({ repoId }).lean();
    logger.info("Repo Metadata updated successfully",{
      endpoint:req.originalUrl,
      sourceIp:req.ip,
      method:req.method,
      phoneNumber: req.user.phoneNumber,
      moreInfo:{
        userId: req.user.userId,
        updatedRepoDetails:updatedRepo,
        updatedProjects:updatedProjects
      }
      
    })
    return res.json({
      success: true,
      message: "Repo metadata updated successfully",
      repo: updatedRepo,
      projects: updatedProjects
    });

  } catch (err) {
    logger.error("Error while editing repo",{
      error: err.message,
      stack: err.stack,
      method:req.method,
      endpoint:req.originalUrl,
      moreInfo:{
        repoID:req.body.repoId,
        userId:req.user.userId,
        phoneNumber:req.user.phoneNumber
      }
    })
    console.error("editRepoById Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

export const getUserProjectsbyuserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({ userId }).lean();
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // DIRECTLY FETCH PROJECTS ASSIGNED TO THIS USER
    const assignedProjects = await Project.find({
      $or: [
        { assignedTo: userId },                       // array includes user
        { project_id: { $in: user.assignedTasks || [] } } // explicit task assignments
      ]
    }).lean();

    return res.json({
      success: true,
      userId,
      totalProjects: assignedProjects.length,
      projects: assignedProjects
    });

  } catch (err) {
    console.error("getUserProjects:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};





export default { syncProjectsData, getProjectsData , getRepoStats, getRepoById, editRepoById, getUserProjectsbyuserId };