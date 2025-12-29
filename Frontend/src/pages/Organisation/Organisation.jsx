import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  AppBar,
  Box,
  Typography,
  Button,
  Grid,
  Chip,
  TextField,
  Divider,
  CircularProgress,
  Snackbar,
  Alert,
} from "@mui/material";
import orgimgfallback from "../../assets/org_logo_fallback.png";
import SidebarSection from "../../components/SidebarSection";
import FilterPanel from "../../components/FilterPanel";
import { Loader, ErrorMessage } from "../../components/Loader";
import PaginationBar from "../../components/PaginationBar";
import headerImage from "../../assets/header-background.png";
import DetailedCard from "../../components/DetailedCard";
import { uploadImageToMinio } from "../../utils/minioUpload";

const BASE_API = process.env.REACT_APP_BASE_API;

// --- Normalize TechStack
function normalizeTechStack(arr) {
  if (!Array.isArray(arr)) return [];
  return Array.from(
    new Set(
      arr
        .flatMap((raw) => String(raw).split(","))
        .map((tech) => tech.trim())
        .filter(Boolean)
    )
  );
}

// --- Simplified normalizeOrg (domain ALWAYS array)
function normalizeOrg(rawOrg) {
  if (!rawOrg) return null;

  return {
    id: rawOrg._id || "",
    orgId: rawOrg.orgId || rawOrg.org_id || "",
    orgName: rawOrg.orgName || "Untitled",
    description: rawOrg.description || "No description available",
    orgtype: rawOrg.orgtype || "Unknown",
    githubUrl: rawOrg.githubUrl || "",
    TechStack: normalizeTechStack(rawOrg.techStack || rawOrg.TechStack),
    contact: rawOrg.contact || "",
    domain:
      Array.isArray(rawOrg.domain) && rawOrg.domain.length > 0
        ? rawOrg.domain
        : ["General"], // <-- fallback
    ranking: rawOrg.ranking || 0,
    rating: rawOrg.rating || 0,
    source: rawOrg.source || "Unknown",
    created_at: rawOrg.created_at
      ? new Date(rawOrg.created_at).toLocaleDateString()
      : "-",
    orgLogo: rawOrg.orgLogo || orgimgfallback,
    website: rawOrg.website || "",
  };
}

// --- Normalize projects
function normalizeProjects(projects) {
  return (projects || []).map((p) => ({
    ...p,
    techStack: normalizeTechStack(p.techStack),
    created_at: p.created_at
      ? new Date(p.created_at).toLocaleDateString()
      : "-",
    description: p.description || "",
    source: p.source || "",
    status: p.status ? p.status.toLowerCase() : "unknown",
    isOpen: p.status && p.status.toLowerCase() === "ongoing",
    domain:
      Array.isArray(p.domain) && p.domain.length > 0 ? p.domain : ["General"], // <-- fallback
    complexity: p.complexity || "-",
    githubUrl: p.githubUrl || "",
    projectName: p.projectName || p.title || "Untitled Project",
  }));
}

function Organisation() {
  const { orgId } = useParams();
  const navigate = useNavigate();

  const [org, setOrg] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [showOpenOnly, setShowOpenOnly] = useState(false);
  const [selectedTechs, setSelectedTechs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [openFilterSection, setOpenFilterSection] = useState(false);
  const [openTechSection, setOpenTechSection] = useState(false);
  const projectsPerPage = 10;

  // Editing
  const [isEditing, setIsEditing] = useState(false);
  const [tempOrgName, setTempOrgName] = useState("");
  const [tempDescription, setTempDescription] = useState("");
  const [tempDomain, setTempDomain] = useState("");
  const [tempOrgType, setTempOrgType] = useState("");
  const [tempWebsite, setTempWebsite] = useState("");
  const [tempOrgLogo, setTempOrgLogo] = useState(null);
  const [previewLogo, setPreviewLogo] = useState("");

  const detailedContainerRef = useRef(null);
  const scrollToTop = () => {
    if (detailedContainerRef.current) {
      detailedContainerRef.current.scrollTop = 0;
    }
  };

  useEffect(() => {
    scrollToTop();
  }, [currentPage, selectedTechs, showOpenOnly]);

  // Snackbar Toast
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const handleCloseToast = () => {
    setToast((prev) => ({ ...prev, open: false }));
  };

  // User Auth
  const userData = JSON.parse(localStorage.getItem("authData")) || {};
  const { orgId: userOrgId, permissions = [], roleId, token } = userData;

  const allowedRoles = ["R002", "R003", "R005"];

  const canEdit =
    permissions.includes("P003") &&
    allowedRoles.includes(roleId) &&
    (roleId === "R002" || userOrgId === org?.orgId);

  // ---------------- Fetch Org ----------------
  useEffect(() => {
    setLoading(true);
    setError("");

    fetch(`${BASE_API}/api/orgs/${orgId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        const normalized = normalizeOrg(json.org);
        setOrg(normalized);

        const projs = normalizeProjects(json.org?.projects);
        setProjects(projs);

        // Prefill edit fields
        setTempOrgName(normalized.orgName || "");
        setTempDescription(
          normalized.description === "No description available"
            ? ""
            : normalized.description
        );
        setTempDomain(
          normalized.domain.length === 1 && normalized.domain[0] === "General"
            ? ""
            : normalized.domain.join(", ")
        );
        setTempOrgType(
          normalized.orgtype === "Unknown" ? "" : normalized.orgtype
        );
        setTempWebsite(normalized.website || "");
        setPreviewLogo(
          normalized.orgLogo && normalized.orgLogo !== ""
            ? normalized.orgLogo
            : orgimgfallback
        );

        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Unknown error");
        setLoading(false);
      });

    setIsEditing(false);
  }, [orgId]);

  // ---------------- Filters ----------------
  const allProjectTechs = useMemo(() => {
    const all = projects.flatMap((p) => p.techStack);
    return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((proj) => {
      const allowOpen = !showOpenOnly || proj.isOpen;
      const allowTech =
        selectedTechs.length === 0 ||
        selectedTechs.every((t) => proj.techStack.includes(t));
      return allowOpen && allowTech;
    });
  }, [projects, showOpenOnly, selectedTechs]);

  const totalPages = Math.ceil(filteredProjects.length / projectsPerPage);
  const startIndex = (currentPage - 1) * projectsPerPage;
  const currentProjects = filteredProjects.slice(
    startIndex,
    startIndex + projectsPerPage
  );

  const handleOrgClick = () => {
    if (org?.website) {
      window.open(org.website, "_blank", "noopener,noreferrer");
    }
  };

  // ---------------- Editing Logic ----------------
  const handleEdit = () => setIsEditing(true);

  const handleDiscard = () => {
    setTempOrgName(org.orgName);
    setTempDescription(
      org.description === "No description available" ? "" : org.description
    );
    setTempDomain(org.domain[0] === "General" ? "" : org.domain.join(", "));
    setTempOrgType(org.orgtype === "Unknown" ? "" : org.orgtype);

    setTempWebsite(org.website || "");

    setTempOrgLogo(null);
    setPreviewLogo(
      org.orgLogo && org.orgLogo !== "" ? org.orgLogo : orgimgfallback
    );

    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      let uploadedLogoUrl = org.orgLogo;

      // 1. Upload directly to MinIO from frontend
      if (tempOrgLogo) {
        uploadedLogoUrl = await uploadImageToMinio(
          tempOrgLogo,
          tempOrgName.replace(/\s+/g, "_")
        );
      }

      const cleanDomain = tempDomain
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);

      const payload = {
        orgName: tempOrgName,
        domain: cleanDomain.length > 0 ? cleanDomain : [],
        orgtype: tempOrgType?.trim() || "Unknown",
        description: tempDescription?.trim() || null,
        website: tempWebsite?.trim() || null,
        orgLogo: uploadedLogoUrl || null,
      };

      const res = await fetch(`${BASE_API}/api/orgs/edit/${org.orgId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Update failed");

      setOrg((prev) => ({
        ...prev,
        ...payload,
        orgLogo: payload.orgLogo || orgimgfallback,
      }));

      setIsEditing(false);

      setToast({
        open: true,
        message: "Organisation updated successfully!",
        severity: "success",
      });
    } catch (err) {
      console.error(err);
      setToast({
        open: true,
        message: err.message || "Could not update organisation details.",
        severity: "error",
      });
    }
  };

  // ---------------- Loading/Error ----------------
  if (loading) return <Loader />;

  if (error)
    return (
      <Box
        sx={{
          p: 3,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
        }}
      >
        <ErrorMessage error={error} />
        <Button
          variant="contained"
          sx={{ mt: 2 }}
          onClick={() => navigate("/organisations")}
        >
          Back to Organisations
        </Button>
      </Box>
    );

  // ---------------- UI ----------------
  return (
    <>
      <title>Organisation - Badal</title>
      <Box sx={{ width: "100%", boxSizing: "border-box" }}>
        <AppBar
          position="static"
          sx={{
            height: 80,
            backgroundImage: `url(${headerImage})`,
            backgroundSize: "cover",
          }}
        >
          <Box
            sx={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              px: 2,
            }}
          >
            <Typography variant="mainHeading" sx={{ color: "#fff" }}>
              {org.orgName}
            </Typography>
          </Box>
        </AppBar>

        <Box
          sx={{
            p: { xs: 1, md: 3 },
          }}
        >
          {/* -------- ORG INFO -------- */}
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column-reverse", md: "row" },
              gap: 3,
              mb: 3,
            }}
          >
            {/* LEFT SIDE */}
            <Box sx={{ flexGrow: 1, width: { xs: "100%", md: "75%" } }}>
              {isEditing ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <TextField
                    label="Organisation Name"
                    fullWidth
                    value={tempOrgName}
                    onChange={(e) => setTempOrgName(e.target.value)}
                  />
                  <TextField
                    label="Description"
                    multiline
                    minRows={6}
                    fullWidth
                    value={tempDescription}
                    onChange={(e) => setTempDescription(e.target.value)}
                  />
                  <TextField
                    label="Domains (comma separated)"
                    fullWidth
                    value={tempDomain}
                    onChange={(e) => setTempDomain(e.target.value)}
                  />
                  <TextField
                    label="Org Type"
                    fullWidth
                    value={tempOrgType}
                    onChange={(e) => setTempOrgType(e.target.value)}
                  />
                  <TextField
                    label="Website"
                    fullWidth
                    value={tempWebsite}
                    onChange={(e) => setTempWebsite(e.target.value)}
                  />
                </Box>
              ) : (
                <>
                  <Typography variant="cardLabel">Description</Typography>
                  <Typography sx={{ mb: 2 }}>{org.description}</Typography>

                  <Typography variant="cardLabel">Domains</Typography>

                  <Box
                    sx={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 0.5,
                      alignItems: "center",
                      mb: 2,
                    }}
                  >
                    {org.domain.length > 0 ? (
                      <>
                        <Chip
                          label={org.domain[0]}
                          size="small"
                          variant="outlined"
                        />

                        {org.domain.length > 1 && (
                          <Chip
                            label={org.domain[1]}
                            size="small"
                            variant="outlined"
                          />
                        )}

                        {org.domain.length > 2 && (
                          <Chip
                            label={`+${org.domain.length - 2} more`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </>
                    ) : (
                      <Chip label="General" size="small" variant="outlined" />
                    )}
                  </Box>

                  <Typography variant="cardLabel">Org Type</Typography>
                  <Box
                    sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}
                  >
                    <Chip label={org.orgtype} size="small" variant="outlined" />
                  </Box>
                </>
              )}
            </Box>

            {/* RIGHT SIDE */}
            <Box
              sx={{
                width: { xs: "100%", md: "25%" },
                textAlign: "center",
                gap: 2,
              }}
            >
              <Box
                onClick={handleOrgClick}
                sx={{
                  height: 200,
                  backgroundColor: "var(--color-bg-pink)",
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mb: 2,
                  boxSizing: "border-box",
                  cursor: "pointer",
                  transition: "0.2s",
                  "&:hover": {
                    transform: "scale(1.01)",
                    boxShadow: "0 0 10px rgba(0,0,0,0.15)",
                  },
                }}
              >
                <img
                  src={
                    isEditing
                      ? previewLogo
                      : org.orgLogo && org.orgLogo !== ""
                      ? org.orgLogo
                      : orgimgfallback
                  }
                  alt="org logo"
                  style={{
                    width: "80%",
                    height: "80%",
                    borderRadius: 8,
                    objectFit: "contain",
                  }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                {isEditing && (
                  <Button variant="outlined" component="label">
                    Upload Organisation Logo
                    <input
                      type="file"
                      hidden
                      accept=".png,.jpg,.jpeg,.webp"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (!file) return;

                        // ✅ Image type validation
                        const allowedTypes = [
                          "image/png",
                          "image/jpeg",
                          "image/webp",
                        ];

                        if (!allowedTypes.includes(file.type)) {
                          setToast({
                            open: true,
                            message:
                              "Only PNG, JPG, and WEBP images are allowed.",
                            severity: "error",
                          });
                          return;
                        }

                        // ✅ Optional: size validation (2MB)
                        if (file.size > 2 * 1024 * 1024) {
                          setToast({
                            open: true,
                            message: "Image size must be under 2MB.",
                            severity: "error",
                          });
                          return;
                        }

                        // ✅ If valid → save & preview
                        setTempOrgLogo(file);
                        setPreviewLogo(URL.createObjectURL(file));
                      }}
                    />
                  </Button>
                )}
              </Box>

              {canEdit && !isEditing && (
                <Chip label="Edit organisation details" onClick={handleEdit} />
              )}

              {canEdit && isEditing && (
                <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
                  <Chip label="Save" color="success" onClick={handleSave} />
                  <Chip label="Discard" color="error" onClick={handleDiscard} />
                </Box>
              )}
            </Box>
          </Box>

          {/* -------- FILTERS + PROJECTS -------- */}
          <Grid
            container
            spacing={3}
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 4fr" },
            }}
          >
            {/* Left filters */}
            <Box>
              <Box
                sx={{
                  px: 1,
                  border: "2px solid #000",
                  borderRadius: "12px",
                  boxShadow: "3px 3px 0 #000",
                  maxHeight: "50vh",
                  overflow: "auto",
                  boxSizing: "border-box",
                  "&::-webkit-scrollbar": { display: "none" },
                  msOverflowStyle: "none",
                  scrollbarWidth: "none",
                }}
              >
                <Divider sx={{ my: 1 }} />

                <SidebarSection
                  title={<Typography>Filter Projects</Typography>}
                  open={openFilterSection}
                  toggleOpen={() => setOpenFilterSection(!openFilterSection)}
                >
                  <FilterPanel
                    switchFilters={[
                      {
                        label: "Open Tasks",
                        checked: showOpenOnly,
                        name: "open",
                      },
                    ]}
                    onSwitchChange={(name, value) => {
                      if (name === "open") setShowOpenOnly(value);
                      setCurrentPage(1);
                    }}
                  />
                </SidebarSection>

                <SidebarSection
                  title={<Typography>Tech Need</Typography>}
                  open={openTechSection}
                  toggleOpen={() => setOpenTechSection(!openTechSection)}
                >
                  <FilterPanel
                    switchFilters={allProjectTechs.map((tech) => ({
                      label: tech,
                      checked: selectedTechs.includes(tech),
                      name: tech,
                    }))}
                    onSwitchChange={(name, checked) => {
                      setSelectedTechs(
                        checked
                          ? [...selectedTechs, name]
                          : selectedTechs.filter((t) => t !== name)
                      );
                      setCurrentPage(1);
                    }}
                  />
                </SidebarSection>
              </Box>
            </Box>

            {/* Right Project List */}
            <Grid item xs={12} md={9}>
              <Box
                sx={{
                  flex: 1,
                  py: 2,
                  height: "calc(100vh - 150px)",
                  maxHeight: "calc(100vh - 150px)",
                  boxSizing: "border-box",
                  border: "2px solid #000",
                  borderRadius: "12px",
                  boxShadow: "3px 3px 0 #000",
                  overflowY: "hidden",
                  "&::-webkit-scrollbar": { display: "none" },
                  msOverflowStyle: "none",
                  scrollbarWidth: "none",
                  width: "100%",
                }}
              >
                <Typography
                  variant="tableTitle"
                  gutterBottom
                  sx={{ px: 2, display: "flex", alignItems: "center", gap: 1 }}
                >
                  Projects
                </Typography>
                <Box
                  sx={{
                    overflow: "auto",
                    boxSizing: "border-box",
                    "&::-webkit-scrollbar": { display: "none" },
                  }}
                >
                  {currentProjects.length === 0 ? (
                    <Box
                      sx={{
                        height: "100vh",
                        maxHeight: "calc(100vh - 260px)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        px: 2,
                      }}
                    >
                      <Typography variant="noticeText">
                        No Projects match the current filters. (Try resetting
                        your filters)
                      </Typography>
                    </Box>
                  ) : (
                    <Box
                      ref={detailedContainerRef}
                      sx={{
                        // height: "100vh",
                        maxHeight: "calc(100vh - 260px)",
                        overflow: "auto",
                        "&::-webkit-scrollbar": { display: "none" },
                        msOverflowStyle: "none",
                        scrollbarWidth: "none",
                        mx: 1,
                      }}
                    >
                      <DetailedCard
                        data={currentProjects}
                        renderConfig={(project) => ({
                          key: project._id || project.id,
                          title: project.projectName,
                          iconName: project.githubUrl ? "GitHub" : null,
                          secondaryLabel: "Creation Date:",
                          secondaryValue: project.created_at,
                          description: project.description,
                          items: [
                            {
                              label: "Domain:",
                              value: project.domain,
                              type: "chip",
                            },
                            {
                              label: "Complexity:",
                              value: project.complexity,
                              type: "chip",
                            },
                            {
                              label: "Tech Need:",
                              value: project.techStack,
                              type: "chip",
                            },
                            {
                              label: "Status:",
                              value: project.status,
                              type: "text",
                            },
                          ],
                          onClick: project.githubUrl
                            ? () =>
                                window.open(
                                  project.githubUrl,
                                  "_blank",
                                  "noopener,noreferrer"
                                )
                            : undefined,
                        })}
                      />
                    </Box>
                  )}
                </Box>
                <PaginationBar
                  totalPages={totalPages}
                  currentPage={currentPage}
                  onPageChange={(e, p) => setCurrentPage(p)}
                />
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Box>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseToast}
          severity={toast.severity}
          variant="filled"
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default Organisation;
