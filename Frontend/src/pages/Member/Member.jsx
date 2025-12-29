import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  AppBar,
  Box,
  Typography,
  Button,
  Grid,
  Divider,
  IconButton,
  Card,
  CardContent,
  Chip,
  Tooltip,
} from "@mui/material";
import { FaGithub, FaDiscord } from "react-icons/fa";
import SidebarSection from "../../components/SidebarSection";
import FilterPanel from "../../components/FilterPanel";
import { Loader, ErrorMessage } from "../../components/Loader";
import PaginationBar from "../../components/PaginationBar";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import headerImage from "../../assets/header-background.png";
import DetailedCard from "../../components/DetailedCard";

const BASE_API = process.env.REACT_APP_BASE_API;

/* ---------------------------------------------------------
      UPDATED NORMALIZATION (EXACTLY LIKE HOME PAGE)
---------------------------------------------------------- */
function normalizeContributor(response) {
  if (!response || !response.user) return null;

  const user = response.user;
  const org = response.organization || {};

  const roleMap = {
    R001: "Admin",
    R002: "ProgramCoordinator",
    R003: "OrgManager",
    R004: "Developer",
    R005: "Mentor",
  };

  return {
    name: user.name || "Unknown User",
    organization: org.name || "",
    orgType: org.type || "Unknown",
    phoneNumber: user.phoneNumber || "",
    primaryEmail: user.primaryEmail || "",
    isVerified: user.isverified || false,
    type: user.source || "unknown",
    role: user.roleId || "",
    userType: roleMap[user.roleId] || "Unknown",
    roleId: user.roleId || "",
    githubUrl: user.githubUrl || "",
    discordId: user.discordId || "",
    techStack: Array.isArray(user.techStack)
      ? user.techStack.map((t) => String(t).trim())
      : [],
    ranking: user.ranking || 0,
    rating: user.rating || 0,
    completedTasks: user.completedTasks || 0,
    prMerged: user.prMerged || 0,

    totalAssigned: response.totalAssigned || 0,
    ongoing: response.ongoing || 0,
    completionRate: response.totalAssigned
      ? Math.round((response.completedTasks / response.totalAssigned) * 100)
      : 0,

    projects: [],
  };
}

function normalizeProjects(projects) {
  if (!Array.isArray(projects)) return [];

  return projects.map((p) => ({
    projectId: p.project_id || "",
    projectName: p.projectName || "Untitled Project",
    description: p.description || "",
    githubUrl: p.githubUrl || "",
    status: p.status ? p.status.toLowerCase() : "unknown",
    isOpen: p.status && p.status.toLowerCase() === "ongoing",
    domain: Array.isArray(p.domain) ? p.domain : [],
    techStack: Array.isArray(p.techStack)
      ? p.techStack.map((t) => String(t).trim())
      : [],
    created_at: p.created_at
      ? new Date(p.created_at).toLocaleDateString()
      : "-",
  }));
}

/* ---------------------------------------------------------
      COMPONENT
---------------------------------------------------------- */
function Member() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [contributor, setContributor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [openTasksOnly, setOpenTasksOnly] = useState(false);
  const [statusFilters, setStatusFilters] = useState({});
  const [openFilterSection, setOpenFilterSection] = useState(false);
  const [openStatusSection, setOpenStatusSection] = useState(false);
  const [copiedContact, setCopiedContact] = useState(false);

  const projectsPerPage = 10;

  /* ---------------------------------------------------------
      UPDATED API CALL LOGIC (LIKE HOME)
---------------------------------------------------------- */
  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");

        // 1️⃣ Fetch contributor
        const infoRes = await fetch(
          `${BASE_API}/api/users/contributors/${userId}`
        );
        if (!infoRes.ok) throw new Error(`API error: ${infoRes.status}`);

        const infoJson = await infoRes.json();
        if (!infoJson.success || !infoJson.user)
          throw new Error("User not found");

        // Normalize like Home.jsx
        const normalizedContributor = normalizeContributor(infoJson);
        setContributor(normalizedContributor);

        // 2️⃣ Fetch projects
        const projRes = await fetch(`${BASE_API}/api/projects/user/${userId}`);
        if (!projRes.ok)
          throw new Error(`Projects API error: ${projRes.status}`);

        const projJson = await projRes.json();
        if (!projJson.success) throw new Error("Invalid projects response");

        const normalizedProjects = normalizeProjects(projJson.projects);

        // Inject into contributor
        setContributor((prev) => ({
          ...prev,
          projects: normalizedProjects,
        }));

        // Build status filters dynamically
        const rawStatuses = projJson.projects.map((p) => p.status);
        const statuses = [...new Set(rawStatuses.filter(Boolean))];

        const initial = {};
        statuses.forEach((s) => (initial[s.toLowerCase()] = false));
        setStatusFilters(initial);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  const detailedContainerRef = useRef(null);

  const scrollToTop = () => {
    if (detailedContainerRef.current) {
      detailedContainerRef.current.scrollTop = 0;
    }
  };

  useEffect(() => {
    scrollToTop();
  }, [
    currentPage,
    openTasksOnly,
    JSON.stringify(statusFilters),
    contributor?.projects,
  ]);

  /* ---------------------------------------------------------
      FILTER LOGIC
---------------------------------------------------------- */
  const availableStatuses = useMemo(
    () =>
      [
        ...new Set(
          contributor?.projects?.map((p) => p.status).filter(Boolean) || []
        ),
      ].sort(),
    [contributor?.projects]
  );

  const filteredProjects = useMemo(() => {
    if (!contributor?.projects) return [];

    return contributor.projects.filter((project) => {
      const matchesOpen = !openTasksOnly || project.isOpen;

      const activeStatuses = Object.entries(statusFilters).filter(
        ([_, isOn]) => isOn
      );

      const matchesStatus =
        activeStatuses.length === 0 ||
        activeStatuses.some(([status]) => status === project.status);

      return matchesOpen && matchesStatus;
    });
  }, [contributor?.projects, openTasksOnly, statusFilters]);

  const totalPages = Math.ceil(filteredProjects.length / projectsPerPage);
  const startIndex = (currentPage - 1) * projectsPerPage;
  const currentProjects = filteredProjects.slice(
    startIndex,
    startIndex + projectsPerPage
  );

  /* ---------------------------------------------------------
      HANDLERS
---------------------------------------------------------- */
  const handleStatusFilterChange = (status) => {
    setStatusFilters((prev) => ({
      ...prev,
      [status]: !prev[status],
    }));
    setCurrentPage(1);
  };

  const handleSwitchChange = (name, checked) => {
    if (name === "open") setOpenTasksOnly(checked);
    setCurrentPage(1);
  };

  const handleCopyContact = (contact) => {
    navigator.clipboard.writeText(contact);
    setCopiedContact(true);
    setTimeout(() => setCopiedContact(false), 1500);
  };

  const openLink = (url) => {
    if (url && url !== "#") window.open(url, "_blank");
  };

  /* ---------------------------------------------------------
      LOADING & ERROR
---------------------------------------------------------- */
  if (loading) return <Loader />;

  if (error || !contributor) {
    return (
      <Box
        sx={{
          p: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
        }}
      >
        <ErrorMessage error={error || "Member not found"} />
        <Button
          variant="contained"
          sx={{ mt: 2, width: "200px" }}
          onClick={() => navigate("/members")}
        >
          Back to Members
        </Button>
      </Box>
    );
  }

  /* ---------------------------------------------------------
      UI — **UNTOUCHED ORIGINAL LAYOUT**
---------------------------------------------------------- */
  return (
    <>
      <title>Member - Badal</title>

      <Box sx={{ width: "100%", minHeight: "100vh" }}>
        {/* HEADER */}
        <AppBar
          position="static"
          color="default"
          elevation={1}
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
              px: 2,
              display: "flex",
              alignItems: "center",
            }}
          >
            <Typography
              variant="mainHeading"
              sx={{ color: "var(--color-white)" }}
            >
              {contributor.name}
            </Typography>
          </Box>
        </AppBar>

        <Box sx={{ p: 3 }}>
          {/* ---- SUMMARY CARDS (UNTOUCHED) ---- */}
          <Grid
            container
            spacing={2}
            sx={{
              width: "100%",
              mb: 3,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            }}
          >
            {/* Member Info */}
            <Grid item xs={12} md={4}>
              <Card
                sx={{
                  height: "100%",
                  border: "2px solid #000",
                  borderRadius: "12px",
                  boxShadow: "3px 3px 0 #000",
                }}
              >
                <CardContent>
                  <Typography variant="cardLabel" sx={{ mb: 1 }}>
                    <strong>Affiliation:</strong> {contributor.organization}
                  </Typography>

                  {/* CONTACT */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                      flexWrap: "wrap",
                    }}
                  >
                    <Typography variant="cardLabel" sx={{ fontWeight: "bold" }}>
                      Contact:
                    </Typography>

                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        maxWidth: { xs: 160, md: 250 },
                        minWidth: { xs: 120, md: 160 },
                        flex: "1 1 160px",
                        overflow: "hidden",
                      }}
                    >
                      <Typography
                        variant="cardValue"
                        title={contributor.primaryEmail}
                        sx={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          mr: 1,
                        }}
                      >
                        {contributor.primaryEmail || "-"}
                      </Typography>

                      <Tooltip title={copiedContact ? "Copied!" : "Copy"} arrow>
                        <IconButton
                          size="small"
                          onClick={() =>
                            handleCopyContact(contributor.primaryEmail)
                          }
                        >
                          <ContentCopyIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>

                      {contributor.githubUrl && (
                        <IconButton
                          onClick={() => openLink(contributor.githubUrl)}
                          size="small"
                        >
                          <FaGithub style={{ fontSize: "1.2rem" }} />
                        </IconButton>
                      )}

                      {contributor.discordId && (
                        <IconButton
                          onClick={() =>
                            openLink(
                              `https://discord.com/users/${contributor.discordId}`
                            )
                          }
                          size="small"
                        >
                          <FaDiscord style={{ fontSize: "1.2rem" }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>

                  <Typography variant="cardLabel">
                    <strong>Type:</strong>{" "}
                    <Typography component="span" variant="cardValue">
                      {contributor.userType}
                    </Typography>
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Metrics */}
            <Grid item xs={12} md={4}>
              <Card
                sx={{
                  height: "100%",
                  border: "2px solid #000",
                  borderRadius: "12px",
                  boxShadow: "3px 3px 0 #000",
                }}
              >
                <CardContent
                  sx={{
                    height: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <Box textAlign="center">
                    <Typography variant="cardLabel">Completed Tasks</Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {contributor.completedTasks}
                    </Typography>
                  </Box>

                  <Divider orientation="vertical" flexItem />

                  <Box textAlign="center">
                    <Typography variant="cardLabel">PR Merged</Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {contributor.prMerged}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Skills */}
            <Grid item xs={12} md={4}>
              <Card
                sx={{
                  height: "100%",
                  border: "2px solid #000",
                  borderRadius: "12px",
                  boxShadow: "3px 3px 0 #000",
                }}
              >
                <CardContent>
                  <Typography variant="sectionTitle" gutterBottom>
                    Tech Skills
                  </Typography>

                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {contributor.techStack.length ? (
                      contributor.techStack.map((skill, index) => (
                        <Chip key={index} label={skill} size="small" />
                      ))
                    ) : (
                      <Typography variant="noticeText" color="text.secondary">
                        No skills listed
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* ---- PROJECTS + FILTERS (UNTOUCHED) ---- */}
          <Grid
            container
            spacing={3}
            sx={{
              width: "100%",
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 4fr" },
            }}
          >
            {/* Sidebar */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box
                sx={{
                  px: 1,
                  border: "2px solid #000",
                  borderRadius: "12px",
                  boxShadow: "3px 3px 0 #000",
                  maxHeight: "50vh",
                  overflow: "auto",
                  "&::-webkit-scrollbar": { display: "none" },
                }}
              >
                <Divider sx={{ my: 1 }} />

                {/* FILTER PROJECTS */}
                <SidebarSection
                  title={
                    <Typography variant="sideSectionTitle">
                      Filter Projects
                    </Typography>
                  }
                  open={openFilterSection}
                  toggleOpen={() => setOpenFilterSection(!openFilterSection)}
                >
                  <FilterPanel
                    switchFilters={[
                      {
                        label: (
                          <Typography variant="filterLabel">
                            Open Tasks Only
                          </Typography>
                        ),
                        checked: openTasksOnly,
                        name: "open",
                      },
                    ]}
                    onSwitchChange={handleSwitchChange}
                  />
                </SidebarSection>

                {/* STATUS FILTERS */}
                <SidebarSection
                  title={
                    <Typography variant="sideSectionTitle">
                      Task Status
                    </Typography>
                  }
                  open={openStatusSection}
                  toggleOpen={() => setOpenStatusSection(!openStatusSection)}
                >
                  <FilterPanel
                    switchFilters={availableStatuses.map((status) => ({
                      label: (
                        <Typography variant="filterLabel">
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </Typography>
                      ),
                      checked: statusFilters[status] || false,
                      name: status,
                    }))}
                    onSwitchChange={(name) => handleStatusFilterChange(name)}
                  />
                </SidebarSection>
              </Box>
            </Box>

            {/* PROJECT LIST — EXACT LAYOUT PRESERVED */}
            <Grid item xs={12} md={9}>
              <Box
                sx={{
                  flex: 1,
                  py: 2,
                  border: "2px solid #000",
                  borderRadius: "12px",
                  boxShadow: "3px 3px 0 #000",
                  overflowY: "hidden",
                  width: "100%",
                }}
              >
                <Typography variant="tableTitle" sx={{ px: 2 }}>
                  Projects
                </Typography>

                <Box
                  sx={{
                    p: 1,
                    overflow: "auto",
                    "&::-webkit-scrollbar": { display: "none" },
                  }}
                >
                  {currentProjects.length === 0 ? (
                    <Box
                      sx={{
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
                        maxHeight: "calc(100vh - 270px)",
                        overflow: "auto",
                        mx: 1,
                        "&::-webkit-scrollbar": { display: "none" },
                        msOverflowStyle: "none",
                        scrollbarWidth: "none",
                      }}
                    >
                      <DetailedCard
                        data={currentProjects}
                        renderConfig={(proj) => ({
                          key: proj.projectId,
                          iconName: proj.githubUrl ? "GitHub" : undefined,
                          title: proj.projectName,
                          secondaryLabel: "Creation Date:",
                          secondaryValue: proj.created_at,
                          description: proj.description || "-",
                          items: [
                            {
                              label: "Domain:",
                              value: proj.domain,
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
                            ? () => openLink(proj.githubUrl)
                            : undefined,
                        })}
                        gap={2}
                        showEmpty={false}
                        listSx={{ width: "100%" }}
                      />
                    </Box>
                  )}
                </Box>

                <PaginationBar
                  totalPages={totalPages}
                  currentPage={currentPage}
                  loading={loading}
                  onPageChange={(e, page) => setCurrentPage(page)}
                />
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </>
  );
}

export default Member;
