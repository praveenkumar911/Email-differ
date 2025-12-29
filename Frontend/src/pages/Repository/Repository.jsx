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
import PaginationBar from "../../components/PaginationBar";
import { Loader, ErrorMessage } from "../../components/Loader";
import headerImage from "../../assets/header-background.png";
import DetailedCard from "../../components/DetailedCard";

const BASE_API = process.env.REACT_APP_BASE_API;

function normalizeProjects(rawProjects) {
  return Array.isArray(rawProjects)
    ? rawProjects.map((p) => {
        const domain =
          Array.isArray(p.domain) && p.domain.length > 0
            ? p.domain
            : ["General"];

        return {
          project_id: p.project_id || p._id || "",
          key: p.project_id || p._id || "",
          projectName: p.projectName || "Untitled Project",
          description: p.description || "",
          githubUrl: p.githubUrl || "",
          domain,
          techStack: Array.isArray(p.techStack) ? p.techStack : [],
          status: p.status ? p.status.toLowerCase() : "unknown",
          isOpen: p.status && p.status.toLowerCase() === "ongoing",
          created_at: p.created_at
            ? new Date(p.created_at).toLocaleDateString()
            : "-",
          complexity: p.complexity || "N/A",
        };
      })
    : [];
}

function Repository() {
  const { repoId } = useParams();
  const navigate = useNavigate();

  const [repo, setRepo] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState("");
  const [tempDescription, setTempDescription] = useState("");
  const [tempDomains, setTempDomains] = useState("");

  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const [showOpenOnly, setShowOpenOnly] = useState(false);
  const [selectedTechs, setSelectedTechs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const projectsPerPage = 10;

  const [openFilters, setOpenFilters] = useState(false);
  const [openFiltersTech, setOpenFiltersTech] = useState(false);

  const detailedContainerRef = useRef(null);

  const scrollToTop = () => {
    if (detailedContainerRef.current) {
      detailedContainerRef.current.scrollTop = 0;
    }
  };

  useEffect(() => {
    scrollToTop();
  }, [currentPage, selectedTechs, showOpenOnly]);

  const userData = JSON.parse(localStorage.getItem("authData")) || {};
  const { orgId: userOrgId, token, permissions = [], roleId } = userData;

  const allowedRoles = ["R002", "R003", "R005"];
  const hasEditPermission = permissions.includes("P003");

  const canEditRepo =
    hasEditPermission &&
    allowedRoles.includes(roleId) &&
    (roleId === "R002" || repo?.organization?.org_id === userOrgId);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Helper to extract last 2 URL segments and join with "-"
    const getRepoSlugName = (url) => {
      if (!url) return "unknown-repo";
      try {
        const parts = new URL(url).pathname.split("/").filter(Boolean);
        const lastTwo = parts.slice(-2);
        return lastTwo.join("-");
      } catch (e) {
        return "unknown-repo";
      }
    };

    fetch(`${BASE_API}/api/projects/repo-stats/${encodeURIComponent(repoId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        const r = json.repo;

        const normalizedRepo = {
          id: r._id,
          repoId: r.repoId,
          name: r.repoName || "Untitled Repository",
          repoDescription: r.repoDescription || "",
          description: r.repoDescription || "",
          domains: Array.isArray(r.domains) ? r.domains : [],
          organization: r.organization || null,
          slugName: getRepoSlugName(r.repoUrl), //the new name that we derived from url
        };
        setRepo(normalizedRepo);
        setProjects(normalizeProjects(json.projects));

        setTempName(normalizedRepo.name);
        setTempDescription(
          normalizedRepo.repoDescription === "No description available"
            ? ""
            : normalizedRepo.repoDescription || ""
        );
        setTempDomains(
          normalizedRepo.domains.length === 1 &&
            normalizedRepo.domains[0] === "General"
            ? ""
            : normalizedRepo.domains.join(", ")
        );

        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load repository:", err);
        setError(err.message || "Failed to load repository");
        setLoading(false);
      });

    setIsEditing(false);
    setCurrentPage(1);
  }, [repoId]);

  const allRepoTechs = useMemo(() => {
    const techs = projects.flatMap((proj) =>
      Array.isArray(proj.techStack) ? proj.techStack : []
    );
    return Array.from(new Set(techs)).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const isOpenAllowed = !showOpenOnly || project.isOpen;

      const matchesTech =
        selectedTechs.length === 0 ||
        selectedTechs.every((tech) =>
          project.techStack
            .map((t) => t.toLowerCase())
            .includes(tech.toLowerCase())
        );

      return isOpenAllowed && matchesTech;
    });
  }, [projects, showOpenOnly, selectedTechs]);

  const totalPages = Math.ceil(filteredProjects.length / projectsPerPage);
  const startIndex = (currentPage - 1) * projectsPerPage;
  const currentProjects = filteredProjects.slice(
    startIndex,
    startIndex + projectsPerPage
  );

  const handleRepoOrgClick = () => {
    if (repo?.organization?.org_id) {
      navigate(`/organisation/${repo.organization.org_id}`);
    }
  };

  const handleEdit = () => {
    if (!canEditRepo) {
      setToast({
        open: true,
        message: "You do not have permission to edit this repository.",
        severity: "error",
      });
      return;
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!canEditRepo || saving) return;

    setSaving(true);

    const cleanDomains = tempDomains
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);

    const payload = {
      repoName: tempName.trim(),
      domains: cleanDomains.length > 0 ? cleanDomains : [],
      repoDescription:
        tempDescription.trim() === "" ? null : tempDescription.trim(),
    };

    try {
      const response = await fetch(
        `${BASE_API}/api/projects/edit/repo-stats/${encodeURIComponent(
          repoId
        )}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Failed to update repository");
      }

      setRepo((prev) => ({
        ...prev,
        name: payload.repoName,
        repoDescription: payload.repoDescription || "No description available",
        description: payload.repoDescription || "No description available",
        domains: payload.domains.length > 0 ? payload.domains : ["General"],
      }));

      setIsEditing(false);
      setToast({
        open: true,
        message: "Repository updated successfully!",
        severity: "success",
      });
    } catch (err) {
      console.error("Save failed:", err);
      setToast({
        open: true,
        message: err.message || "Failed to save changes",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setTempName(repo.name);
    setTempDescription(
      repo.repoDescription === "No description available"
        ? ""
        : repo.repoDescription || ""
    );
    setTempDomains(
      repo.domains.length === 1 && repo.domains[0] === "General"
        ? ""
        : repo.domains.join(", ")
    );
    setIsEditing(false);
  };

  const handleCloseToast = () => {
    setToast((prev) => ({ ...prev, open: false }));
  };

  if (loading) return <Loader />;
  if (error || !repo)
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
        <ErrorMessage error={error || "Repository not found"} />
        <Button
          variant="contained"
          sx={{ mt: 2 }}
          onClick={() => navigate("/projects")}
        >
          Back to Projects
        </Button>
      </Box>
    );

  return (
    <>
      <title>Repository - Badal</title>
      <Box sx={{ width: "100%", boxSizing: "border-box" }}>
        <AppBar
          position="static"
          sx={{
            height: 80,
            backgroundImage: `url(${headerImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <Box
            sx={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              px: 3,
            }}
          >
            <Typography variant="mainHeading" sx={{ color: "#fff" }}>
              {repo.slugName}
            </Typography>
          </Box>
        </AppBar>

        <Box
          sx={{
            p: { xs: 1, md: 3 },
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column-reverse", md: "row" },
              gap: 3,
              mb: 4,
            }}
          >
            <Box sx={{ flexGrow: 1, width: { xs: "100%", md: "70%" } }}>
              {isEditing ? (
                <Box
                  sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}
                >
                  <TextField
                    label="Repository Name"
                    fullWidth
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    disabled={saving}
                  />
                  <TextField
                    label="Description"
                    multiline
                    minRows={5}
                    fullWidth
                    value={tempDescription}
                    onChange={(e) => setTempDescription(e.target.value)}
                    disabled={saving}
                  />
                  <TextField
                    label="Domains (comma-separated)"
                    fullWidth
                    value={tempDomains}
                    onChange={(e) => setTempDomains(e.target.value)}
                    placeholder="e.g. AI, Cybersecurity, Backend"
                    disabled={saving}
                  />
                </Box>
              ) : (
                <>
                  <Typography variant="cardLabel">Description</Typography>
                  <Typography sx={{ mb: 2, whiteSpace: "pre-line" }}>
                    {repo.repoDescription || "No description provided"}
                  </Typography>
                  <Typography variant="cardLabel">Domains</Typography>
                  <Box
                    sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}
                  >
                    {repo.domains.length > 0 ? (
                      <>
                        {repo.domains.slice(0, 5).map((d, i) => (
                          <Chip
                            key={i}
                            label={d}
                            size="small"
                            variant="outlined"
                          />
                        ))}

                        {repo.domains.length > 5 && (
                          <Chip
                            label={`+${repo.domains.length - 5} more`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </>
                    ) : (
                      <Chip label="General" size="small" variant="outlined" />
                    )}
                  </Box>
                </>
              )}
            </Box>

            {/* Right: Org Image + Edit Controls (Same as Organisation page) */}
            {/* Right Column: Logo + Org Description + Edit */}
            <Box sx={{ width: { xs: "100%", md: "30%" }, textAlign: "center" }}>
              <Box
                onClick={handleRepoOrgClick}
                sx={{
                  height: 200,
                  backgroundColor: "var(--color-bg-pink)",
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  p: 2,
                  mb: 2,
                  gap: 2,
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
                  src={repo.organization?.orgLogo || orgimgfallback}
                  alt="org logo"
                  style={{
                    width: "40%",
                    maxWidth: 120,
                    borderRadius: 8,
                    objectFit: "contain",
                  }}
                />
                <Box
                  sx={{
                    textAlign: "left",
                    flexGrow: 1,
                    backgroundColor: "#fff",
                    borderRadius: 2,
                    p: 2,
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)",
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 5,
                      WebkitBoxOrient: "vertical",
                      lineHeight: 1.4,
                    }}
                  >
                    {repo?.organization?.description ||
                      "No organization description available"}
                  </Typography>
                </Box>
              </Box>

              {canEditRepo && !isEditing && (
                <Chip label="Edit repository details" onClick={handleEdit} />
              )}

              {canEditRepo && isEditing && (
                <Box
                  sx={{
                    display: "flex",
                    gap: 1,
                    justifyContent: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <Chip
                    label={saving ? "Saving..." : "Save"}
                    color="success"
                    onClick={handleSave}
                    clickable={!saving}
                    disabled={saving}
                    icon={
                      saving ? (
                        <CircularProgress size={14} color="inherit" />
                      ) : undefined
                    }
                  />
                  <Chip
                    label="Discard"
                    color="error"
                    onClick={handleDiscard}
                    clickable
                    disabled={saving}
                  />
                </Box>
              )}
            </Box>
          </Box>

          <Grid
            container
            spacing={3}
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 4fr" },
            }}
          >
            <Box>
              <Box
                sx={{
                  border: "2px solid #000",
                  borderRadius: "12px",
                  px: 1,
                  maxHeight: "60vh",
                  overflow: "auto",
                }}
              >
                <Divider sx={{ my: 1 }} />
                <SidebarSection
                  title={
                    <Typography variant="sideSectionTitle">
                      Filter Projects
                    </Typography>
                  }
                  open={openFilters}
                  toggleOpen={() => setOpenFilters(!openFilters)}
                >
                  <FilterPanel
                    switchFilters={[
                      {
                        label: "Open Projects Only",
                        checked: showOpenOnly,
                        name: "open",
                      },
                    ]}
                    onSwitchChange={(name, value) =>
                      name === "open" && setShowOpenOnly(value)
                    }
                  />
                </SidebarSection>
                <SidebarSection
                  title={
                    <Typography variant="sideSectionTitle">
                      Tech Need
                    </Typography>
                  }
                  open={openFiltersTech}
                  toggleOpen={() => setOpenFiltersTech(!openFiltersTech)}
                >
                  <FilterPanel
                    switchFilters={allRepoTechs.map((tech) => ({
                      label: tech,
                      checked: selectedTechs.includes(tech),
                      name: tech,
                    }))}
                    onSwitchChange={(name, checked) => {
                      setSelectedTechs((prev) =>
                        checked
                          ? [...prev, name]
                          : prev.filter((t) => t !== name)
                      );
                      setCurrentPage(1);
                    }}
                  />
                </SidebarSection>
              </Box>
            </Box>

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
                      // ref={detailedContainerRef}
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
                        renderConfig={(proj) => ({
                          key: proj.key,
                          title: proj.projectName,
                          iconName: proj.githubUrl ? "GitHub" : null,
                          secondaryLabel: "Creation Date:",
                          secondaryValue: proj.created_at,
                          description: proj.description,
                          items: [
                            {
                              label: "Domain:",
                              value: proj.domain,
                              type: "chip",
                            },
                            {
                              label: "Complexity:",
                              value: proj.complexity,
                              type: "chip",
                            },
                            {
                              label: "Tech Need:",
                              value: proj.techStack,
                              type: "chip",
                            },
                            {
                              label: "Status:",
                              value: proj.status,
                              type: "text",
                            },
                          ],
                          onClick: proj.githubUrl
                            ? () =>
                                window.open(
                                  proj.githubUrl,
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
                  onPageChange={(_, page) => setCurrentPage(page)}
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

export default Repository;
