import pgPool from '../config/postgresconf.js'; // Fixed import path
import Orgs from '../models/orgs.js'; // Added .js extension
import Project from '../models/projects.js'; // Added .js extension
import { User } from '../models/usercollection.js'; // Added .js extension
import { defaultOrgsCollection, seedOrganizations } from '../models/defaultOrgs.js';
import logger from '../logger.js';
import { Role } from '../models/usercollection.js';

async function syncOrgs() {
  try {
    const ops = [];

    // ── 1. DMP orgs (take precedence)
    const dmpRes = await pgPool.query(`
      SELECT id, name, created_at, description, link AS github_url
      FROM dmp_orgs
    `);

    for (const row of dmpRes.rows) {
      const rawId = String(row.id);
      const orgId = `ORG${rawId}`;
      const createdAt = row.created_at ? new Date(row.created_at).toISOString() : null;

      const doc = {
        org_id: orgId,
        orgName: row.name ?? null,
        description: row.description ?? null,
        created_at: createdAt,
        githubUrl: row.github_url ?? null,
        contact: null,
        orgtype: null,
        domain: null,
        techStack: [],
        projects: [],
        ranking: 0,
        rating: 0,
        source: ["DMP"]   // ✅ ARRAY
      };

      ops.push({
        updateOne: {
          filter: { org_id: orgId },
          update: { $setOnInsert: doc },  // ✅ existing data NOT touched
          upsert: true
        }
      });
    }

    // ── 2. Community orgs
    const communityRes = await pgPool.query(`
      SELECT id, name FROM community_orgs
    `);

    for (const row of communityRes.rows) {
      const rawId = String(row.id);
      const orgId = `ORG${rawId}`;

      const doc = {
        org_id: orgId,
        orgName: row.name ?? null,
        description: null,
        created_at: null,
        githubUrl: null,
        contact: null,
        orgtype: null,
        domain: null,
        techStack: [],
        projects: [],
        ranking: 0,
        rating: 0,
        source: ["Community"]   // ✅ ARRAY
      };

      ops.push({
        updateOne: {
          filter: { org_id: orgId },
          update: { $setOnInsert: doc },  // ✅ existing data NOT touched
          upsert: true
        }
      });
    }

    // ── 3. Execute once
    if (ops.length) {
      const result = await Orgs.bulkWrite(ops, { ordered: false });
      console.log(
        `Orgs sync → ${result.upsertedCount} inserted, ${result.modifiedCount} updated`
      );
    }

    return { success: true, message: 'Orgs synchronization completed' };
  } catch (error) {
    console.error('Error syncing orgs:', error);
    return { success: false, error: error.message };
  }
}
// ========================= GET ALL ORGS =========================
// ========================= GET ALL ORGS =========================
export const getAllOrgs = async (req, res) => {
  try {
    const orgs = await Orgs.find({}).lean();
    const projects = await Project.find({}).select("owner status").lean();

    const techSkills = {
      dmp: { skills: [] },
      community: { skills: [] }
    };

    const domainGroups = {
      dmp: { domains: [] },
      community: { domains: [] }
    };

    // -------- NORMALIZE SOURCE ----------
    const normalizeSources = (src) => {
      let arr = [];

      if (Array.isArray(src)) arr = src;
      else if (typeof src === "string") arr = src.split(",");

      return arr
        .map(s => s.trim().toLowerCase())
        .filter(s => s === "dmp" || s === "community");
    };

    orgs.forEach(org => {
      const sources = normalizeSources(org.source);
      const finalSources = sources.length ? sources : ["community"];

      finalSources.forEach(source => {

        // ---- TECH STACK ----
        if (Array.isArray(org.techStack)) {
          org.techStack.forEach(s => {
            const skill = s?.toLowerCase();
            if (skill && !techSkills[source].skills.includes(skill)) {
              techSkills[source].skills.push(skill);
            }
          });
        }

        // ---- DOMAINS ----
        let domainList = [];
        if (Array.isArray(org.domain)) domainList = org.domain;
        else if (typeof org.domain === "string") {
          domainList = org.domain.split(",").map(d => d.trim());
        }

        domainList.forEach(d => {
          const dom = d?.toLowerCase();
          if (dom && !domainGroups[source].domains.includes(dom)) {
            domainGroups[source].domains.push(dom);
          }
        });
      });
    });

    // ---- PROJECT SUMMARY ----
    const orgProjectMap = {};

    projects.forEach(p => {
      const owner = p.owner || "ORG_UNKNOWN";
      const status = (p.status || "inactive").toLowerCase(); // open | closed | inactive

      if (!orgProjectMap[owner]) orgProjectMap[owner] = [];
      orgProjectMap[owner].push(status);
    });

    const updatedOrgs = orgs.map(org => {
      const orgId = org.org_id;
      const statuses = orgProjectMap[orgId] || [];

      const open = statuses.filter(s => s === "open").length;
      const closed = statuses.filter(s => s === "closed").length;
      const inactive = statuses.filter(s => s === "inactive").length;

      let projectStatus = "inactive";
      if (open > 0) projectStatus = "open";
      else if (closed === statuses.length && closed > 0) projectStatus = "closed";
      else if (inactive > 0) projectStatus = "inactive";

      return {
        ...org,
        projectStatus,
        totalProjects: statuses.length,
        openCount: open,
        closedCount: closed,
        inactiveCount: inactive
      };
    });

    return res.json({
      success: true,
      totalOrgs: updatedOrgs.length,
      techSkills: {
        dmp: techSkills.dmp,
        community: techSkills.community
      },
      domains: {
        dmp: domainGroups.dmp,
        community: domainGroups.community
      },
      orgs: updatedOrgs
    });

  } catch (e) {
    console.error("Error in getAllOrgs:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
};



// ========================= GET ORG BY ID =========================
export const getOrgById = async (req, res) => {
  try {
    const { orgId } = req.params;

    // -------- FIND ORG --------
    const org = await Orgs.findOne({ org_id: orgId }).lean();
    if (!org) {
      return res.status(404).json({
        success: false,
        message: `Org with ID ${orgId} not found`
      });
    }

    // -------- FIND PROJECTS --------
    const projects = await Project.find({ owner: orgId }).lean();

    // -------- COUNTERS --------
    let openTasks = 0;
    let closedTasks = 0;
    let inactiveTasks = 0;

    // -------- NORMALIZE SOURCE (ORG) --------
    const normalizeSource = (src) => {
      if (Array.isArray(src)) return src.map(s => s.trim());
      if (typeof src === "string") return src.split(",").map(s => s.trim());
      return [];
    };

    // -------- PROCESS PROJECTS --------
    const processedProjects = projects.map(p => {
      // strict normalize
      let status = (p.status || "").toString().trim().toLowerCase();

      // enforce enum
      if (status !== "open" && status !== "closed" && status !== "inactive") {
        status = "inactive"; // safety fallback
      }

      // ---- COUNTERS ----
      if (status === "open") openTasks++;
      else if (status === "closed") closedTasks++;
      else inactiveTasks++;

      return {
        ...p,
        status
      };
    });

    // -------- FINAL RESPONSE --------
    const result = {
      success: true,

      org: {
        ...org,
        source: normalizeSource(org.source),

        openTasks,
        closedTasks,
        inactiveTasks,

        projects: processedProjects.map(p => ({
          project_id: p.project_id,
          projectName: p.projectName,
          status: p.status,          // ✅ open | closed | inactive
          source: p.source,
          githubUrl: p.githubUrl,
          created_at: p.created_at,
          description: p.description,
          techStack: p.techStack,
          assignedTo: p.assignedTo,
          domain: p.domain,
          complexity: p.complexity
        }))
      },

      totalProjects: processedProjects.length,

      statusSummary: {
        open: openTasks,
        closed: closedTasks,
        inactive: inactiveTasks
      }
    };

    return res.json(result);

  } catch (error) {
    console.error("getOrgById error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};







export const editOrg = async (req, res) => {
  try {
    const { orgId } = req.params; // Example: ORG96

    if (!orgId) {
      return res.status(400).json({
        success: false,
        error: "orgId is required"
      });
    }

    // List of fields allowed to update (all except org_id & created_at)
    const allowedFields = [
      "orgName",
      "orgLogo",
      "website",
      "description",
      "githubUrl",
      "contact",
      "orgtype",
      "domain",
      "techStack",
      "source",
      "ranking",
      "rating"
    ];

    const updateFields = {};

    // Loop through allowed fields & add if present in req.body
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateFields[field] = req.body[field];
      }
    });

    // Normalize domain array if present
    if (updateFields.domain) {
      updateFields.domain = Array.isArray(updateFields.domain)
        ? updateFields.domain.map(d => d.trim().toLowerCase())
        : [String(updateFields.domain).trim().toLowerCase()];
    }

    // Normalize techStack array if present
    if (updateFields.techStack) {
      updateFields.techStack = Array.isArray(updateFields.techStack)
        ? updateFields.techStack.map(t => t.trim())
        : [String(updateFields.techStack).trim()];
    }

    // Update org
    const updated = await Orgs.findOneAndUpdate(
      { org_id: orgId },
      { $set: updateFields },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Org with ID ${orgId} not found`
      });
    }
    const userEmail = req.user?.primaryEmail;
    const userName = req.user?.name || 'User';

    if (userEmail) {
      try {
        const { subject, html } = generateEmailTemplate('edit-org', userName);
        await sendEmail(userEmail, subject, null, html);
      } catch (emailErr) {
        logger.warn('Organization edit email failed', {
          email: userEmail,
          error: emailErr.message,
          userId: req.user?.userId,
          orgId,
        });
        // Non-blocking: org still updates even if email fails
      }
    }

    logger.info("Organization updated successfully",{
      endpoint:req.originalUrl,
      method:req.method,
      sourceIp:req.ip,
      phoneNumber:req.user.phoneNumber,
      moreInfo:{
        updatedDetails:updateFields,
        userId:req.user.userId,
        
      }
    })

    return res.json({
      success: true,
      message: "Organization updated successfully",
      org: updated
    });

  } catch (error) {
    logger.error("Error While editing",{
      error: err.message,
      stack: err.stack,
      method:req.method,
      endpoint:req.originalUrl,
      moreInfo:{
        userId:req.user.userId,
      }
    })
    console.error("editOrg error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};


export const getOrgDevelopersbyuserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({ userId }).lean();
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    if (!["R002", "R003", "R005"].includes(user.roleId)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized. Only R002/R003/R005 can access this."
      });
    }

    const orgId = user.organization;

    // Fetch all projects under this org
    const orgProjects = await Project.find({ owner: orgId }).lean();

    // Fetch all developers in this org
    const developers = await User.find({
      organization: orgId,
      roleId: "R004"
    }).lean();

    const formatted = developers.map(dev => {
      // Filter projects assigned to this developer
      const assignedProjects = orgProjects.filter(
        p =>
          (p.assignedTo || []).includes(dev.userId) ||
          (dev.assignedTasks || []).includes(p.project_id)
      );

      // Count project statuses
      const completedTasks = assignedProjects.filter(
        p => (p.status || "").toLowerCase() === "completed"
      ).length;

      const prMergedTasks = assignedProjects.filter(
        p => (p.status || "").toLowerCase() === "prmerged"
      ).length;

      const ongoingTasks = assignedProjects.filter(
        p =>
          (p.status || "").toLowerCase() === "ongoing" ||
          (p.status || "").toLowerCase() === "open"
      ).length;

      return {
        ...dev,
        projectsAssigned: assignedProjects.length,
        completedTasks,
        prMergedTasks,
        ongoingTasks,
        // Optional: include project list if needed
      //  projects: assignedProjects
      };
    });

    return res.json({
      success: true,
      developers: formatted
    });

  } catch (err) {
    console.error("getOrgDevelopers error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};



export const getOrgMentorsbyuserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({ userId }).lean();
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (!["R002", "R003", "R005"].includes(user.roleId)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized. Only R002/R003/R005 can access this."
      });
    }

    const orgId = user.organization;

    // All org projects
    const orgProjects = await Project.find({ owner: orgId }).lean();

    // All mentors in org
    const mentors = await User.find({ organization: orgId, roleId: "R005" }).lean();

    const formatted = mentors.map(m => {
      // All projects where this mentor is involved
      const assignedProjects = orgProjects.filter(
        p =>
          (p.assignedTo || []).includes(m.userId) ||
          (m.assignedTasks || []).includes(p.project_id)
      );

      const projectsMentored = assignedProjects.length;

      // ---- Determine taskStatus ----
      let taskStatus = "none";

      if (projectsMentored > 0) {
        const statuses = assignedProjects.map(
          p => (p.status || "").toLowerCase()
        );

        const ongoing = statuses.some(s => s === "ongoing" || s === "open");
        const prMerged = statuses.some(s => s === "prmerged");
        const completed = statuses.every(s => s === "completed" || s === "closed");

        if (ongoing) taskStatus = "ongoing";
        else if (prMerged) taskStatus = "prMerged";
        else if (completed) taskStatus = "completed";
      }

      return {
        ...m,
      //  projects: assignedProjects,
        projectsMentored,
        taskStatus
      };
    });

    return res.json({
      success: true,
      mentors: formatted
    });

  } catch (err) {
    console.error("getOrgMentors:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
async function getRolesExcludingAdminAndCoordinator() {
  const roles = await Role.find(); 
  const filteredRoles = roles.filter(role => role.roleName !== "Admin" && role.roleName !== "ProgramCoordinator");
  return filteredRoles;
}
async function getDefaultAllOrgs(req, res) {
  try {
    
    const orgs = await defaultOrgsCollection.find();
    
    const roles = await getRolesExcludingAdminAndCoordinator();

    
    if (orgs.length === 0) {
      await seedOrganizations();  
      orgs = await DefaultOrgs.find(); 
     
    }

    // Return the organizations
    res.status(200).json({ organizations: orgs, roles: roles });
  } catch (err) {
    console.error('Error fetching organizations:', err);
    res.status(500).json({ message: 'Server error' });
  }
}


export async function searchOrgs(req, res) {
  try {
    const { q } = req.query;

    // If no query → return default orgs + "Other" option
    if (!q || q.trim() === "") {
      const defaults = await defaultOrgsCollection.find()
        .select("_id orgName orgType")
        .limit(20)
        .lean();

      const defaultResults = defaults.map(o => ({
        label: o.orgName,
        source: "default",
        orgRef: {
          type: "default",
          id: o._id.toString()
        },
        orgType: o.orgType || ""
      }));

      return res.status(200).json({ 
        results: [
          ...defaultResults,
          {
            label: "Other",
            source: "custom",
            orgRef: { type: "custom", id: null },
            orgType: ""
          }
        ]
      });
    }

    const regex = new RegExp(q.trim(), "i");   // case-insensitive search

    // 🔹 Search Orgs collection
    const orgs = await Orgs.find({
      orgName: { $regex: regex }
    })
    .select("org_id orgName orgtype")
    .limit(10)
    .lean();

    const orgResults = orgs.map(o => ({
      label: o.orgName,
      source: "orgs",
      orgRef: {
        type: "orgs",
        id: o.org_id
      },
      orgType: o.orgtype || ""
    }));

    // 🔹 Search default_orgs collection
    const defaults = await defaultOrgsCollection.find({
      orgName: { $regex: regex }
    })
    .select("_id orgName orgType")
    .limit(10)
    .lean();

    const defaultResults = defaults.map(o => ({
      label: o.orgName,
      source: "default",
      orgRef: {
        type: "default",
        id: o._id.toString()
      },
      orgType: o.orgType || ""
    }));

    // 🔹 Merge results + always add "Other" option
    return res.status(200).json({
      results: [
        ...orgResults,
        ...defaultResults,
        {
          label: "Other",
          source: "custom",
          orgRef: { type: "custom", id: null },
          orgType: ""
        }
      ]
    });

  } catch (err) {
    console.error("Error in searchOrgs:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
}

export default { syncOrgs, getAllOrgs, getOrgById, editOrg, getOrgDevelopersbyuserId, getOrgMentorsbyuserId ,getDefaultAllOrgs, searchOrgs};