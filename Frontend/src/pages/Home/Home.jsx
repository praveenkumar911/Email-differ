import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  AppBar,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  CircularProgress,
} from "@mui/material";
import { FaGithub, FaDiscord } from "react-icons/fa";
import PaginationBar from "../../components/PaginationBar";
import SidebarSection from "../../components/SidebarSection";
import FilterPanel from "../../components/FilterPanel";
import { useAuth } from "../../context/AuthContext";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import Tooltip from "@mui/material/Tooltip";
import headerImage from "../../assets/header-background.png";
import DetailedCard from "../../components/DetailedCard";
import StatPair from "../../components/StatPair";

const BASE_API = process.env.REACT_APP_BASE_API;

// ---- Helpers and StarRating as in Member.jsx ----
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
  };
}

function normalizeProjects(projects) {
  if (!Array.isArray(projects)) return [];

  return projects.map((p) => ({
    projectId: p.project_id || "",
    title: p.projectName || "Untitled Project",
    description: p.description || "",
    githubUrl: p.githubUrl || "",
    status: p.status ? p.status.toLowerCase() : "unknown",
    isOpen: p.status && p.status.toLowerCase() === "ongoing",
    created_at: p.created_at
      ? new Date(p.created_at).toLocaleDateString()
      : "-",
    domain: Array.isArray(p.domain) ? p.domain : [],
    techStack: Array.isArray(p.techStack)
      ? p.techStack.map((t) => String(t).trim())
      : [],
    complexity: p.complexity || "",
    owner: p.owner || "",
  }));
}

const StarRating = ({ rating }) => {
  const stars = 5;
  const filledStars =
    rating >= 4 ? 5 : rating >= 3 ? 4 : rating >= 2 ? 3 : rating >= 1 ? 2 : 1;

  return (
    <Box>
      {[...Array(stars)].map((_, i) => (
        <span
          key={i}
          style={{
            color: i < filledStars ? "#fbc02d" : "#e0e0e0",
            fontSize: "1.5rem",
          }}
        >
          ★
        </span>
      ))}
    </Box>
  );
};

const PAGE_SIZE = 3;

const Home = () => {
  // Auth
  const { user: { token, userId: USER_ID } = {} } = useAuth();
  const API_BASE = `${BASE_API}/api/users/contributors`;

  // Contributor & project state
  const [contributor, setContributor] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sidebar filter UI state
  const [openTasksOnly, setOpenTasksOnly] = useState(false);
  const [statusFilters, setStatusFilters] = useState({});
  const [openFilterSection, setOpenFilterSection] = useState(false);
  const [openStatusSection, setOpenStatusSection] = useState(false);
  const [copiedContact, setCopiedContact] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);

  // Fetch contributor on mount
  useEffect(() => {
    if (!USER_ID) {
      setLoading(false);
      setError("Please log in to view your profile.");
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        // 1️⃣ Fetch Contributor Details
        const contributorRes = await fetch(`${API_BASE}/${USER_ID}`, {
          headers,
        });
        if (!contributorRes.ok)
          throw new Error(`HTTP ${contributorRes.status}`);

        const contributorJson = await contributorRes.json();
        if (!contributorJson.success || !contributorJson.user)
          throw new Error("Invalid contributor response");

        const normalizedContributor = normalizeContributor(contributorJson);
        setContributor(normalizedContributor);

        // 2️⃣ Fetch Projects
        const projectRes = await fetch(
          `${BASE_API}/api/projects/user/${USER_ID}`,
          { headers }
        );
        if (!projectRes.ok) throw new Error(`HTTP ${projectRes.status}`);

        const projectJson = await projectRes.json();
        if (!projectJson.success) throw new Error("Invalid projects response");

        const normalizedProjects = normalizeProjects(projectJson.projects);
        setProjects(normalizedProjects);

        // Setup status filters
        const statuses = [
          ...new Set(normalizedProjects.map((p) => p.status).filter(Boolean)),
        ];

        const initialFilters = {};
        statuses.forEach((status) => {
          initialFilters[status] = false;
        });

        setStatusFilters(initialFilters);
      } catch (e) {
        setError(e.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [USER_ID, token]);

  // Scroll container reference
  const detailedContainerRef = useRef(null);

  const scrollToTop = () => {
    if (detailedContainerRef.current) {
      detailedContainerRef.current.scrollTop = 0;
    }
  };

  // Sidebar filter logic (pure and memoized)
  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter((project) => {
      const matchesOpen = !openTasksOnly || project.isOpen;
      const activeStatuses = Object.entries(statusFilters).filter(
        ([_, active]) => active
      );
      const matchesStatus =
        activeStatuses.length === 0 ||
        activeStatuses.some(([status]) => project.status === status);
      return matchesOpen && matchesStatus;
    });
  }, [projects, openTasksOnly, statusFilters]);

  useEffect(() => {
    scrollToTop();
  }, [page, openTasksOnly, JSON.stringify(statusFilters), projects]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredProjects.length / PAGE_SIZE);
  const pageItems = filteredProjects.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  // Handlers
  const handleFilterSwitch = (name, checked) => {
    if (name === "open") setOpenTasksOnly(checked);
    setPage(1);
  };

  const handleStatusFilterChange = (name) => {
    setStatusFilters((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
    setPage(1);
  };

  const handleCopyContact = (contact) => {
    navigator.clipboard.writeText(contact);
    setCopiedContact(true);
    setTimeout(() => setCopiedContact(false), 1500);
  };

  const openLink = (url) => {
    if (url && url !== "#") window.open(url, "_blank", "noopener,noreferrer");
  };

  // Project stats
  const completedCount = projects.filter(
    (p) => p.status === "Completed"
  ).length;
  const openCount = projects.filter(
    (p) => p.status.toLowerCase() === "open" || p.status === "Open"
  ).length;

  // ----- Render -----
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
        <Typography variant="noticeText" ml={2}>
          Loading profile...
        </Typography>
      </Box>
    );
  }
  if (error || !contributor) {
    return (
      <Typography variant="noticeText" color="error" align="center" py={4}>
        {error || "Profile not found"}
      </Typography>
    );
  }

  return (
    <>
      <title>Developer Home</title>
      <Box
        sx={{
          width: "100%",
          minHeight: "100vh",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
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
              {contributor?.name || "User"}
            </Typography>
          </Box>
        </AppBar>

        <Box sx={{ p: 3 }}>
          {/* Row 1: Activity Chart & Ranking */}
          {/* <Grid
          container
          spacing={2}
          sx={{
            mb: 3,
            display: "grid",
          }}
        >
          <Grid item xs={12} md={9}>
            <Card
              sx={{
                height: { xs: "250px", md: "200px" },
                border: "2px solid #000",
                borderRadius: "12px",
                boxShadow: "3px 3px 0 #000",
              }}
            >
              <CardContent sx={{ height: "100%" }}>
                <Typography variant="sectionTitle" gutterBottom>
                  Activity Stats
                </Typography>
                <Box
                  sx={{
                    bgcolor: "#f5f5f5",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px dashed #ccc",
                    gap: 1,
                  }}
                >
                  <Typography variant="cardTitle" fontWeight="bold">
                    {contributor.stats.completionRate}%
                  </Typography>
                  <Typography variant="noticeText" color="text.secondary">
                    Completion Rate
                  </Typography>
                  <Typography variant="cardLabel">
                    Total:{" "}
                    <span style={{ fontWeight: 500 }}>
                      {contributor.stats.totalAssigned}
                    </span>{" "}
                    | Completed:{" "}
                    <span style={{ fontWeight: 500 }}>
                      {contributor.stats.completedTasks}
                    </span>
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid> */}

          {/* Row 2: Info + Metrics + Skills */}
          <Grid
            container
            spacing={2}
            sx={{
              mb: 3,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            }}
          >
            {/* Info */}
            <Grid item xs={12} md={4}>
              <Card
                sx={{
                  border: "2px solid #000",
                  borderRadius: "12px",
                  boxShadow: "3px 3px 0 #000",
                  height: "100%",
                }}
              >
                <CardContent>
                  <Box>
                    <Typography variant="cardLabel">Affliation: </Typography>
                    <Typography variant="cardValue" component="span">
                      {contributor.organization}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                      flexWrap: "wrap",
                    }}
                  >
                    <Typography
                      variant="cardLabel"
                      sx={{
                        fontWeight: "bold",
                        flexShrink: 0,
                      }}
                    >
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
                        position: "relative",
                      }}
                    >
                      <Typography
                        variant="cardValue"
                        title={contributor.primaryEmail}
                        sx={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          fontSize: "1rem",
                          maxWidth: "100%",
                          mr: 1,
                        }}
                      >
                        {contributor.primaryEmail || "-"}
                      </Typography>
                      <Tooltip
                        title={copiedContact ? "Copied!" : "Copy"}
                        placement="top"
                        arrow
                      >
                        <IconButton
                          size="small"
                          aria-label="Copy Contact"
                          sx={{ ml: 0.5 }}
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
                          aria-label="GitHub"
                          sx={{ ml: 0.5 }}
                        >
                          <FaGithub
                            style={{ fontSize: "1.2rem", color: "#333" }}
                          />
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
                          aria-label="Discord"
                          sx={{ ml: 0.5 }}
                        >
                          <FaDiscord
                            style={{ fontSize: "1.2rem", color: "#333" }}
                          />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="cardLabel">Type: </Typography>
                    <Typography variant="cardValue" component="span">
                      {contributor.userType}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Metrics */}
            <Grid item xs={12} md={4}>
              <Card
                sx={{
                  border: "2px solid #000",
                  borderRadius: "12px",
                  boxShadow: "3px 3px 0 #000",
                  height: "100%",
                }}
              >
                <CardContent
                  sx={{
                    p: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                  }}
                >
                  <StatPair
                    leftLabel="Completed Tasks"
                    leftValue={contributor.completedTasks}
                    rightLabel="PR Merged"
                    rightValue={contributor.prMerged}
                  />
                </CardContent>
              </Card>
            </Grid>

            {/* Skills */}
            <Grid item xs={12} md={4}>
              <Card
                sx={{
                  border: "2px solid #000",
                  borderRadius: "12px",
                  boxShadow: "3px 3px 0 #000",
                  height: "100%",
                }}
              >
                <CardContent>
                  <Typography
                    variant="sectionTitle"
                    gutterBottom
                    sx={{ fontWeight: 600 }}
                  >
                    Tech Skills
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {contributor.techStack.length ? (
                      contributor.techStack.map((s) => (
                        <Chip key={s} label={s} size="small" />
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

          {/* Row 3: Filters Sidebar + Projects */}
          <Grid
            container
            spacing={3}
            sx={{
              width: "100%",
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 4fr" },
            }}
          >
            {/* Sidebar Filters */}
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                height: "100%",
              }}
            >
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
                    onSwitchChange={handleFilterSwitch}
                  />
                </SidebarSection>

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
                    switchFilters={Object.keys(statusFilters).map((status) => ({
                      label: (
                        <Typography variant="filterLabel">{status}</Typography>
                      ),
                      checked: statusFilters[status] || false,
                      name: status,
                    }))}
                    onSwitchChange={(name) => handleStatusFilterChange(name)}
                  />
                </SidebarSection>
              </Box>
            </Box>

            {/* Projects */}
            <Grid item xs={12} md={9} sx={{ flexGrow: 1 }}>
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
                  {pageItems.length === 0 ? (
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
                        data={pageItems}
                        renderConfig={(p) => ({
                          key: p.id,
                          iconName: p.githubUrl ? "GitHub" : undefined,
                          title: p.title,
                          secondaryLabel: "Creation Date:",
                          secondaryValue: p.created_at,
                          description: p.description,
                          items: [
                            {
                              label: "Domain:",
                              value: p.domain || "N/A",
                              type: "chip",
                            },
                            {
                              label: "Tech Stack:",
                              value: p.techStack,
                              type: "chip",
                            },
                            { label: "Task Status:", value: p.status || "N/A" },
                          ],
                          onClick: p.githubUrl
                            ? () => openLink(p.githubUrl)
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
                  currentPage={page}
                  onPageChange={(_, v) => setPage(v)}
                  loading={loading}
                  totalItems={filteredProjects.length}
                />
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </>
  );
};

export default Home;
