import React, { useState, useEffect, useRef } from "react";
import {
  AppBar,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Radio,
  RadioGroup,
  FormControlLabel,
  CircularProgress,
  Stack,
  Switch,
  Divider,
  Tooltip,
} from "@mui/material";
import {
  CheckCircle as CompletedIcon,
  AccessTime as OngoingIcon,
  Merge as MergedIcon,
} from "@mui/icons-material";
import { FaGithub, FaDiscord } from "react-icons/fa";
import PaginationBar from "../../components/PaginationBar";
import { useAuth } from "../../context/AuthContext";
import FilterPanel from "../../components/FilterPanel";
import SidebarSection from "../../components/SidebarSection";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import headerImage from "../../assets/header-background.png";
import DetailedCard from "../../components/DetailedCard";
import StatPair from "../../components/StatPair";

const BASE_API = process.env.REACT_APP_BASE_API;

const PAGE_SIZE = 10;

const OrgManagerHome = () => {
  const { token, userId: USER_ID } = useAuth();

  const [tab, setTab] = useState("projects");
  const [radioFilter, setRadioFilter] = useState("all");
  const [filters, setFilters] = useState({
    openTasks: false,
    statuses: {},
  });
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openFilterSection, setOpenFilterSection] = useState(true);
  const [openStatusSection, setOpenStatusSection] = useState(false);
  const [openTechSection, setOpenTechSection] = useState(false);
  const [manager, setManager] = useState(null);
  const [projects, setProjects] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [copiedContact, setCopiedContact] = useState(false);
  const [orgId, setOrgId] = useState(null);

  // ───────────────────────────────────────────────
  // PROFILE API (same)
  // ───────────────────────────────────────────────
  const fetchProfile = async () => {
    const url = `${BASE_API}/api/users/contributors/${USER_ID}`;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error("Failed to load profile.");

    const json = await res.json();

    const user = json.user || {};
    const org = json.organization || {};

    const resolvedOrgId = org.org_id || org.orgId || org._id || org.id || null;

    setManager({
      name: user.name || "-",
      organization: org.name || "-",
      orgType: user.orgType || "-",
      phoneNumber: user.phoneNumber || "-",
      primaryEmail: user.primaryEmail || "-",
      discordId: user.discordId || "-",
      githubUrl: user.githubUrl || "-",
      rating: org.rating ?? "-",
      techStack: Array.isArray(user.techStack) ? user.techStack : ["-"],
      completedTasks: user.completedTasks ?? "-",
      prMerged: user.prMerged ?? "-",
    });

    return resolvedOrgId; // <-- VERY IMPORTANT
  };

  // ───────────────────────────────────────────────
  // PROJECTS API (updated) -- now tries org endpoint first
  // ───────────────────────────────────────────────
  const fetchProjects = async (orgId) => {
    if (!orgId) {
      setProjects([]);
      return;
    }

    const url = `${BASE_API}/api/orgs/${orgId}`;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error("Failed to load organization projects.");

    const json = await res.json();

    const org = json.org || {};
    const orgProjects = Array.isArray(org.projects) ? org.projects : [];

    const mapped = orgProjects.map((p) => ({
      id: p.project_id,
      name: p.projectName,
      githubUrl: p.githubUrl,
      description: p.description,
      created_at: new Date(p.created_at).toLocaleDateString(),
      domain: p.domain || [],
      techStack: p.techStack || [],
      status: p.status.toLowerCase(),
      isOpen: p.status.toLowerCase() === "ongoing",
      assignedTo: p.assignedTo || [],
      source: p.source,
      complexity: p.complexity,
    }));

    setProjects(mapped); // <--- now UI should show 4 projects
  };

  // ───────────────────────────────────────────────
  // DEVELOPERS API
  // ───────────────────────────────────────────────
  const fetchDevelopers = async () => {
    const url = `${BASE_API}/api/orgs/user/${USER_ID}`;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error("Failed to load developers.");

    const json = await res.json();

    const mapped = (json.developers || []).map((d) => ({
      id: d.userId || "-",
      name: d.name || "-",
      userStatus: d.userStatus || "-",
      githubUrl: d.githubUrl || "-",
      techStack: Array.isArray(d.techStack) ? d.techStack : ["-"],
      domain: d.domain || "-",
      taskStatus:
        d.ongoingTasks && d.ongoingTasks > 0 ? "ongoing" : "completed",
      completedTasks: d.completedTasks ?? "-",
      prMerged: d.prMerged ?? d.prMergedTasks ?? "-",
    }));

    setDevelopers(mapped);
  };

  // ───────────────────────────────────────────────
  // MENTORS API
  // ───────────────────────────────────────────────
  const fetchMentors = async () => {
    const url = `${BASE_API}/api/orgs/mentors/${USER_ID}`;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error("Failed to load mentors.");

    const json = await res.json();

    const mapped = (json.mentors || []).map((m) => ({
      id: m.userId || "-",
      name: m.name || "-",
      mentorStatus: m.status || "-",
      githubUrl: m.githubUrl || "-",
      techStack: Array.isArray(m.techStack) ? m.techStack : ["-"],
      domain: m.domain || "-",
      taskStatus: m.taskStatus || "-",
      projectsMentored: m.projectsMentored ?? "-",
      rating: m.rating || "-",
    }));

    setMentors(mapped);
  };

  // ───────────────────────────────────────────────
  // MASTER FETCH
  // ───────────────────────────────────────────────
  useEffect(() => {
    if (!USER_ID) {
      setLoading(false);
      setError("Please log in to view your org manager profile.");
      return;
    }

    const load = async () => {
      try {
        setLoading(true);

        // 1️⃣ Get orgId from profile API
        const orgId = await fetchProfile();

        // 2️⃣ Fetch org projects with that orgId
        await fetchProjects(orgId);

        // 3️⃣ Fetch remaining data
        await Promise.all([fetchDevelopers(), fetchMentors()]);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [USER_ID, token]);

  const detailedContainerRef = useRef(null);

  const scrollToTop = () => {
    if (detailedContainerRef.current) {
      detailedContainerRef.current.scrollTop = 0;
    }
  };

  useEffect(() => {
    scrollToTop();
  }, [
    page,
    tab,
    radioFilter,
    selectedSkills,
    filters.openTasks,
    JSON.stringify(filters.statuses),
    projects,
    developers,
    mentors,
  ]);

  const allSkills = [
    ...new Set(
      (tab === "developers" ? developers : mentors)
        .flatMap((person) => person.techStack || [])
        .filter((skill) => skill && skill !== "-")
    ),
  ];

  // Dynamic project statuses (no hardcoding)
  const allProjectStatuses = [
    ...new Set(projects.map((p) => p.status).filter(Boolean)),
  ];

  // Initialize dynamic status filter map
  useEffect(() => {
    if (projects.length === 0) return;

    const statusMap = {};
    allProjectStatuses.forEach((s) => (statusMap[s] = false));

    setFilters((prev) => ({
      ...prev,
      statuses: statusMap,
    }));
  }, [projects]);

  // ───────────────────────────────────────────────
  // DYNAMIC FILTER LOGIC (NEW VERSION)
  // ───────────────────────────────────────────────
  const getFiltered = () => {
    let list =
      tab === "projects"
        ? projects
        : tab === "developers"
        ? developers
        : mentors;

    // ───────────────────────────────────────────────
    // PROJECT FILTERS
    // ───────────────────────────────────────────────
    if (tab === "projects") {
      // Owned / Contributed filter (NEW: use assignedTo + status)
      if (radioFilter === "owned")
        list = list.filter(
          (p) => Array.isArray(p.assignedTo) && p.assignedTo.includes(USER_ID)
        );
      if (radioFilter === "contributed")
        list = list.filter(
          (p) =>
            Array.isArray(p.assignedTo) &&
            p.assignedTo.includes(USER_ID) &&
            p.status === "completed"
        );

      // OPEN TASKS (sample-code behaviour)
      if (filters.openTasks) {
        list = list.filter((p) => p.isOpen);
      }

      // DYNAMIC STATUS FILTERING
      if (filters.statuses) {
        const activeStatuses = Object.entries(filters.statuses)
          .filter(([_, isActive]) => isActive)
          .map(([status]) => status);

        if (activeStatuses.length > 0) {
          list = list.filter((p) => activeStatuses.includes(p.status));
        }
      }
    }

    // ───────────────────────────────────────────────
    // DEV / MENTOR SKILL FILTER
    // ───────────────────────────────────────────────
    if ((tab === "developers" || tab === "mentors") && selectedSkills.length) {
      list = list.filter((person) =>
        person.techStack?.some((skill) => selectedSkills.includes(skill))
      );
    }

    return list;
  };

  const filtered = getFiltered();
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openLink = (url) => {
    if (url && url !== "-" && url !== "#")
      window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopyContact = (contact) => {
    if (!contact) return;
    navigator.clipboard.writeText(contact);
    setCopiedContact(true);
    setTimeout(() => setCopiedContact(false), 1000);
  };

  // ───────────────────────────────────────────────
  // ALL UI BELOW THIS POINT IS 100% UNCHANGED
  // ───────────────────────────────────────────────

  return (
    <>
      <title>Org manager / Program Coordinator</title>
      <Box sx={{ minHeight: "100vh", width: "100%", boxSizing: "border-box" }}>
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
              {manager ? manager.name : "Org Manager Dashboard"}
            </Typography>
          </Box>
        </AppBar>

        <Box sx={{ p: 3 }}>
          {/* Top Stats Row */}
          <Grid
            container
            spacing={2}
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(3,1fr)" },
              gap: 2,
              mb: 3,
            }}
          >
            {/* Contact + org type */}
            <Grid item xs={12} md={4}>
              <Card
                sx={{
                  height: "100%",
                  border: "2px solid #000",
                  borderRadius: "16px",
                  boxShadow: "4px 4px 0 #000",
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      mb: 1,
                      gap: 0.5,
                      flexWrap: "wrap",
                    }}
                  >
                    <Typography
                      variant="cardLabel"
                      sx={{ fontWeight: "bold", flexShrink: 0 }}
                    >
                      Contact:
                    </Typography>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        maxWidth: { xs: 160, md: 250 },
                        flex: "1 1 160px",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <Typography
                        variant="cardValue"
                        title={manager?.primaryEmail || "-"}
                        sx={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "120px",
                        }}
                      >
                        {manager?.primaryEmail || "-"}
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
                            handleCopyContact(manager?.primaryEmail)
                          }
                        >
                          <ContentCopyIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                      {manager?.githubUrl && manager.githubUrl !== "-" && (
                        <IconButton
                          onClick={() => openLink(manager.githubUrl)}
                          size="small"
                          aria-label="GitHub"
                          sx={{ ml: 0.5 }}
                        >
                          <FaGithub style={{ fontSize: "1.2rem" }} />
                        </IconButton>
                      )}
                      {manager?.discordId && manager.discordId !== "-" && (
                        <IconButton
                          onClick={() =>
                            openLink(
                              `https://discord.com/users/${manager.discordId}`
                            )
                          }
                          size="small"
                          aria-label="Discord"
                          sx={{ ml: 0.5 }}
                        >
                          <FaDiscord style={{ fontSize: "1.2rem" }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>

                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="cardLabel">Org Type:</Typography>
                    <Typography variant="cardValue">
                      {manager ? manager.orgType : "-"}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Completed/PR Stats */}
            <Grid item xs={12} md={4}>
              <Card
                sx={{
                  border: "2px solid #000",
                  borderRadius: "16px",
                  boxShadow: "4px 4px 0 #000",
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
                    leftValue={manager?.completedTasks}
                    rightLabel="PR Merged"
                    rightValue={manager?.prMerged}
                  />
                </CardContent>
              </Card>
            </Grid>

            {/* Tech Skills */}
            <Grid item xs={12} md={4}>
              <Card
                sx={{
                  height: "100%",
                  border: "2px solid #000",
                  borderRadius: "16px",
                  boxShadow: "4px 4px 0 #000",
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Typography
                    variant="sectionTitle"
                    gutterBottom
                    sx={{ fontWeight: 600 }}
                  >
                    Tech Skills Demonstrated
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {loading ? (
                      <Chip label="Loading…" size="small" />
                    ) : manager?.techStack?.length ? (
                      manager.techStack.map((s, idx) => (
                        <Chip
                          key={s + idx}
                          label={s}
                          size="small"
                          sx={{ bgcolor: "#e0e0e0" }}
                        />
                      ))
                    ) : (
                      <Typography variant="noticeText">
                        No skills listed
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Tabs */}
          <Box sx={{ mb: 3 }}>
            <Tabs
              value={tab}
              onChange={(_, v) => {
                setTab(v);
                setPage(1);
                setRadioFilter("all");
                setSelectedSkills([]);
              }}
              sx={{
                borderBottom: "2px solid #000",
                "& .MuiTab-root": {
                  textTransform: "none",
                  minWidth: "auto",
                  px: 3,
                  color: "var(--item-color)",
                },
                "& .Mui-selected": {
                  bgcolor: "var(--item-active-bgcolor)",
                  color: "var(--item-active-color) !important",
                },
              }}
            >
              <Tab label="Projects" value="projects" />
              <Tab label="Developers" value="developers" />
              <Tab label="Mentors" value="mentors" />
            </Tabs>
          </Box>

          <Grid
            container
            spacing={2}
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 4fr" },
              gap: 2,
            }}
          >
            {/* Sidebar */}
            <Grid item xs={12} md={3}>
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
                    maxHeight: "70vh",
                    overflow: "auto",
                    boxSizing: "border-box",
                    "&::-webkit-scrollbar": { display: "none" },
                  }}
                >
                  <Divider sx={{ my: 1 }} />
                  {tab === "projects" && (
                    <>
                      <SidebarSection
                        title={
                          <Typography variant="sideSectionTitle">
                            Project Filters
                          </Typography>
                        }
                        open={openFilterSection}
                        toggleOpen={() => setOpenFilterSection((v) => !v)}
                      >
                        <FilterPanel
                          switchFilters={[
                            {
                              label: (
                                <Typography variant="filterLabel">
                                  Open Tasks Only
                                </Typography>
                              ),
                              checked: filters.openTasks,
                              name: "openTasks",
                            },
                          ]}
                          onSwitchChange={(name, checked) => {
                            setFilters((f) => ({ ...f, [name]: checked }));
                            setPage(1);
                          }}
                        />
                      </SidebarSection>

                      <SidebarSection
                        title={
                          <Typography variant="sideSectionTitle">
                            Task Status
                          </Typography>
                        }
                        open={openStatusSection}
                        toggleOpen={() => setOpenStatusSection((v) => !v)}
                      >
                        <FilterPanel
                          switchFilters={allProjectStatuses.map((status) => ({
                            label: (
                              <Typography variant="filterLabel">
                                {status.charAt(0).toUpperCase() +
                                  status.slice(1)}
                              </Typography>
                            ),
                            checked: filters.statuses?.[status] || false,
                            name: status,
                          }))}
                          onSwitchChange={(name, checked) => {
                            setFilters((prev) => ({
                              ...prev,
                              statuses: {
                                ...prev.statuses,
                                [name]: checked,
                              },
                            }));
                            setPage(1);
                          }}
                        />
                      </SidebarSection>
                    </>
                  )}

                  {(tab === "developers" || tab === "mentors") && (
                    <SidebarSection
                      title={
                        <Typography variant="sideSectionTitle">
                          Tech Skills
                        </Typography>
                      }
                      open={openTechSection}
                      toggleOpen={() => setOpenTechSection((v) => !v)}
                    >
                      <Stack spacing={0.5}>
                        {allSkills.length === 0 ? (
                          <Typography
                            variant="noticeText"
                            color="text.secondary"
                          >
                            No skills available.
                          </Typography>
                        ) : (
                          allSkills.map((skill) => (
                            <Box
                              key={skill}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                px: 1,
                                py: 0.8,
                                borderBottom: "1px solid #f1f1f1",
                              }}
                            >
                              <Typography variant="filterLabel">
                                {skill}
                              </Typography>
                              <Switch
                                checked={selectedSkills.includes(skill)}
                                size="small"
                                onChange={() => {
                                  setSelectedSkills((prev) =>
                                    prev.includes(skill)
                                      ? prev.filter((s) => s !== skill)
                                      : [...prev, skill]
                                  );
                                  setPage(1);
                                }}
                              />
                            </Box>
                          ))
                        )}
                      </Stack>
                    </SidebarSection>
                  )}
                </Box>
              </Box>
            </Grid>

            {/* Main Content */}
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
                  width: "100%",
                  "&::-webkit-scrollbar": { display: "none" },
                  msOverflowStyle: "none",
                  scrollbarWidth: "none",
                }}
              >
                {/* RADIO BUTTON MOVED INSIDE BORDER */}
                <Box sx={{ mb: 2, pl: { xs: 0, md: 1 }, ml: 2 }}>
                  <RadioGroup
                    row
                    value={radioFilter}
                    onChange={(e) => setRadioFilter(e.target.value)}
                    sx={{
                      "& .MuiFormControlLabel-root": { mr: 2, mb: 0 },
                      "& .MuiRadio-root": { p: 0.5 },
                    }}
                  >
                    {tab === "projects" ? (
                      <>
                        <FormControlLabel
                          value="all"
                          control={<Radio size="small" />}
                          label={
                            <Typography variant="filterLabel">All</Typography>
                          }
                        />
                        <FormControlLabel
                          value="owned"
                          control={<Radio size="small" />}
                          label={
                            <Typography variant="filterLabel">Owned</Typography>
                          }
                        />
                        <FormControlLabel
                          value="contributed"
                          control={<Radio size="small" />}
                          label={
                            <Typography variant="filterLabel">
                              Contributed
                            </Typography>
                          }
                        />
                      </>
                    ) : (
                      <FormControlLabel
                        value="all"
                        control={<Radio size="small" />}
                        label={
                          <Typography variant="filterLabel">All</Typography>
                        }
                      />
                    )}
                  </RadioGroup>
                </Box>

                {loading ? (
                  <Box
                    display="flex"
                    width="100%"
                    height="100%"
                    justifyContent="center"
                    alignItems="center"
                    py={4}
                  >
                    <CircularProgress />
                    <Typography variant="noticeText" ml={2}>
                      Loading org manager data...
                    </Typography>
                  </Box>
                ) : paginated.length === 0 ? (
                  <Box
                    sx={{
                      height: "100%",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      px: 2,
                    }}
                  >
                    <Typography variant="noticeText" color="text.secondary">
                      No items match the filters.
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
                      data={paginated}
                      renderConfig={(item) =>
                        tab === "projects"
                          ? {
                              key: item.id,
                              iconName:
                                item.githubUrl && item.githubUrl !== "-"
                                  ? "GitHub"
                                  : undefined,
                              title: item.name || "-",
                              secondaryLabel: "Creation Date:",
                              secondaryValue: item.created_at || "-",
                              description: item.description || "-",
                              items: [
                                {
                                  label: "Domain:",
                                  value: item.domain || "-",
                                  type: "chip",
                                },
                                {
                                  label: "Tech Stack:",
                                  value:
                                    item.techStack.length > 0
                                      ? item.techStack
                                      : ["-"],
                                  type: "chip",
                                },
                                {
                                  label: "Task Status:",
                                  value: item.status || "-",
                                  type: "text",
                                },
                              ],
                              onClick:
                                item.githubUrl && item.githubUrl !== "-"
                                  ? () => openLink(item.githubUrl)
                                  : undefined,
                            }
                          : tab === "developers"
                          ? {
                              key: item.id,
                              iconName:
                                item.githubUrl && item.githubUrl !== "-"
                                  ? "GitHub"
                                  : undefined,
                              title: item.name || "-",
                              secondaryLabel: null,
                              secondaryValue: null,
                              description: null,
                              items: [
                                {
                                  label: "Completed Tasks:",
                                  value: item.completedTasks,
                                  type: "text",
                                },
                                {
                                  label: "PRs Merged:",
                                  value: item.prMerged,
                                  type: "text",
                                },
                                {
                                  label: "Tech Stack:",
                                  value:
                                    item.techStack.length > 0
                                      ? item.techStack
                                      : ["-"],
                                  type: "chip",
                                },
                                {
                                  label: "Task Status:",
                                  value: item.taskStatus,
                                  type: "text",
                                },
                              ],
                              onClick:
                                item.githubUrl && item.githubUrl !== "-"
                                  ? () => openLink(item.githubUrl)
                                  : undefined,
                            }
                          : {
                              key: item.id,
                              iconName:
                                item.githubUrl && item.githubUrl !== "-"
                                  ? "GitHub"
                                  : undefined,
                              title: item.name || "-",
                              secondaryLabel: null,
                              secondaryValue: null,
                              description: null,
                              items: [
                                {
                                  label: "Projects Mentored:",
                                  value: item.projectsMentored,
                                  type: "chip",
                                },
                                {
                                  label: "Tech Stack:",
                                  value:
                                    item.techStack.length > 0
                                      ? item.techStack
                                      : ["-"],
                                  type: "chip",
                                },
                                {
                                  label: "Task Status:",
                                  value: item.taskStatus,
                                  type: "text",
                                },
                              ],
                              onClick:
                                item.githubUrl && item.githubUrl !== "-"
                                  ? () => openLink(item.githubUrl)
                                  : undefined,
                            }
                      }
                      gap={2}
                      showEmpty={false}
                      listSx={{ width: "100%" }}
                    />
                  </Box>
                )}

                <PaginationBar
                  totalPages={totalPages}
                  currentPage={page}
                  onPageChange={(_, v) => setPage(v)}
                  loading={loading}
                  totalItems={filtered.length}
                />
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </>
  );
};

export default OrgManagerHome;
