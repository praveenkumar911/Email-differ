import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  AppBar,
  Box,
  Typography,
  Grid,
  Tabs,
  Tab,
  Radio,
  RadioGroup,
  FormControlLabel,
  CircularProgress,
  Stack,
  Chip,
  Divider,
  IconButton,
  Card,
  CardContent,
  Tooltip,
  Switch,
} from "@mui/material";
import { FaGithub, FaDiscord } from "react-icons/fa";
import PaginationBar from "../../components/PaginationBar";
import SidebarSection from "../../components/SidebarSection";
import { useAuth } from "../../context/AuthContext";
import FilterPanel from "../../components/FilterPanel";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import headerImage from "../../assets/header-background.png";
import DetailedCard from "../../components/DetailedCard";
import StatPair from "../../components/StatPair";

const PAGE_SIZE = 3;
const BASE_API = process.env.REACT_APP_BASE_API;

// -----------------------------
// Normalizers
// -----------------------------
function normalizeMentor(user = {}, org = {}, extra = {}) {
  return {
    name: user.name || "-",
    userId: user.userId || "-",
    organization: org.name || "-",
    orgType: user.orgType || "-",
    phoneNumber: user.phoneNumber || "-",
    primaryEmail: user.primaryEmail || "-",
    githubUrl: user.githubUrl || "-",
    discordId: user.discordId || "-",
    ranking: user.ranking ?? "-",
    rating: user.rating ?? "-",
    techStack: Array.isArray(user.techStack) ? user.techStack : ["-"],
    completedTasks: user.completedTasks ?? 0,
    prMerged: user.prMerged ?? 0,

    totalAssigned: extra.totalAssigned ?? "-",
    ongoing: extra.ongoing ?? "-",
  };
}

function normalizeProjects(raw = []) {
  return raw.map((p = {}) => ({
    id: p.project_id || "-",
    name: p.projectName || "-",
    githubUrl: p.githubUrl || "-",
    description: p.description || "-",
    created_at: p.created_at
      ? new Date(p.created_at).toLocaleDateString()
      : "-",
    domain: Array.isArray(p.domain) ? p.domain : ["-"],
    techStack: Array.isArray(p.techStack) ? p.techStack : ["-"],
    status: p.status ? String(p.status).toLowerCase() : "unknown",
    isOpen: p.status && String(p.status).toLowerCase() === "ongoing",
    assignedTo: Array.isArray(p.assignedTo) ? p.assignedTo : [],
  }));
}

function normalizeDevelopers(raw = []) {
  return raw.map((d = {}) => {
    return {
      id: d.userId || d._id || "-",
      userId: d.userId || "-",
      name: d.name || "-",
      userStatus: d.userStatus || "-",
      githubUrl: d.githubUrl || "-",
      techStack: Array.isArray(d.techStack) ? d.techStack : ["-"],
      domain: d.domain || d.source || "-",
      taskStatus:
        d.ongoingTasks && d.ongoingTasks > 0 ? "ongoing" : "completed",
      completedTasks: d.completedTasks ?? "-",
      prMerged: d.prMerged ?? d.prMergedTasks ?? "-",
      primaryEmail: d.primaryEmail || d.email || "-",
      discordId: d.discordId || "-",
      rating: d.rating ?? "-",
      ranking: d.ranking ?? "-",
    };
  });
}

// -----------------------------
// MentorHome component
// -----------------------------
const MentorHome = () => {
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

  const [openFilterSection, setOpenFilterSection] = useState(false);
  const [openStatusSection, setOpenStatusSection] = useState(false);
  const [openTechSection, setOpenTechSection] = useState(false);

  const [mentor, setMentor] = useState(null);
  const [orgId, setOrgId] = useState(null);

  const [projects, setProjects] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [copiedContact, setCopiedContact] = useState(false);

  // -----------------------------
  // Fetch profile → get orgId
  // -----------------------------
  useEffect(() => {
    if (!USER_ID) {
      setLoading(false);
      setError("Please log in to view your mentor profile.");
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // Fetch contributor profile
        const res = await fetch(
          `${BASE_API}/api/users/contributors/${USER_ID}`,
          { headers }
        );
        if (!res.ok) throw new Error("Failed to load profile");
        const json = await res.json();

        const user = json.user || {};
        const org = json.organization || {};

        // Attempt to resolve org ID
        const resolvedOrgId =
          org.org_id || org.orgId || org._id || org.id || null;
        setOrgId(resolvedOrgId);

        // Normalized mentor profile
        setMentor(
          normalizeMentor(user, org, {
            completedTasks: json.completedTasks,
            prMerged: json.prMerged,
            totalAssigned: json.totalAssigned,
            ongoing: json.ongoing,
          })
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [USER_ID, token]);

  // -----------------------------
  // Fetch org projects + developers
  // -----------------------------
  useEffect(() => {
    if (!orgId) return;

    const load = async () => {
      try {
        setLoading(true);
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // Fetch org details → includes projects[]
        const orgRes = await fetch(`${BASE_API}/api/orgs/${orgId}`, {
          headers,
        });
        if (!orgRes.ok) throw new Error("Failed loading organization projects");
        const orgJson = await orgRes.json();
        const orgProjects = orgJson.org?.projects || [];

        setProjects(normalizeProjects(orgProjects));

        // Fetch developers
        const devRes = await fetch(`${BASE_API}/api/orgs/user/${USER_ID}`, {
          headers,
        });
        if (!devRes.ok) throw new Error("Failed loading developers");
        const devJson = await devRes.json();

        setDevelopers(normalizeDevelopers(devJson.developers || []));

        // Dynamic statuses
        const statuses = [
          ...new Set(orgProjects.map((p) => p.status?.toLowerCase())),
        ].filter(Boolean);

        const map = {};
        statuses.forEach((s) => (map[s] = false));

        setFilters((prev) => ({
          ...prev,
          statuses: map,
        }));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [orgId, USER_ID, token]);

  const detailedContainerRef = useRef(null);

  const scrollToTop = () => {
    requestAnimationFrame(() => {
      if (detailedContainerRef.current) {
        detailedContainerRef.current.scrollTop = 0;
      }
    });
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
  ]);

  // -----------------------------
  // Dynamic Skills for Developers
  // -----------------------------
  const allSkills = useMemo(
    () =>
      Array.from(
        new Set(
          developers
            .flatMap((d) => d.techStack || [])
            .filter((s) => s && s !== "-")
        )
      ),
    [developers]
  );

  // -----------------------------
  // Filtering Logic (updated to match OrgManagerHome)
  // -----------------------------
  const getFiltered = () => {
    let list = tab === "projects" ? projects : developers;

    if (tab === "projects") {
      // OWNED logic
      if (radioFilter === "owned") {
        list = list.filter(
          (p) => Array.isArray(p.assignedTo) && p.assignedTo.includes(USER_ID)
        );
      }

      // CONTRIBUTED logic
      if (radioFilter === "contributed") {
        list = list.filter(
          (p) =>
            Array.isArray(p.assignedTo) &&
            p.assignedTo.includes(USER_ID) &&
            p.status === "completed"
        );
      }

      // OPEN TASKS
      if (filters.openTasks) {
        list = list.filter((p) => p.isOpen);
      }

      // STATUS FILTERS
      const active = Object.entries(filters.statuses)
        .filter(([_, active]) => active)
        .map(([s]) => s);

      if (active.length > 0) {
        list = list.filter((p) => active.includes(p.status));
      }
    }

    // Developer SKILL FILTER
    if (tab === "developers" && selectedSkills.length) {
      list = list.filter((d) =>
        d.techStack?.some((skill) => selectedSkills.includes(skill))
      );
    }

    return list;
  };

  const filtered = getFiltered();
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // -----------------------------
  // Utils
  // -----------------------------
  const openLink = (url) => {
    if (!url || url === "-" || url === "#") return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopyContact = (contact) => {
    if (!contact || contact === "-") return;
    navigator.clipboard.writeText(contact);
    setCopiedContact(true);
    setTimeout(() => setCopiedContact(false), 1000);
  };

  // -----------------------------
  // Render UI
  // -----------------------------
  if (loading) {
    return (
      <Box
        display="flex"
        width="100%"
        height="100vh"
        justifyContent="center"
        alignItems="center"
        py={4}
      >
        <CircularProgress />
        <Typography ml={2}>Loading mentor data...</Typography>
      </Box>
    );
  }

  if (error || !mentor) {
    return (
      <Typography color="error" align="center" py={4}>
        {error || "Mentor profile not found"}
      </Typography>
    );
  }

  return (
    <>
      <title>Mentor Home</title>
      <Box sx={{ minHeight: "100vh", width: "100%", boxSizing: "border-box" }}>
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
              {mentor.name}
            </Typography>
          </Box>
        </AppBar>

        <Box sx={{ p: 3 }}>
          {/* ————— TOP STATS ————— */}
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
            {/* CONTACT */}
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
                        sx={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "120px",
                        }}
                      >
                        {mentor.primaryEmail}
                      </Typography>

                      <Tooltip title={copiedContact ? "Copied!" : "Copy"} arrow>
                        <IconButton
                          size="small"
                          onClick={() => handleCopyContact(mentor.primaryEmail)}
                        >
                          <ContentCopyIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>

                      {mentor.githubUrl !== "-" && (
                        <IconButton
                          size="small"
                          sx={{ ml: 0.5 }}
                          onClick={() => openLink(mentor.githubUrl)}
                        >
                          <FaGithub style={{ fontSize: "1.2rem" }} />
                        </IconButton>
                      )}
                      {mentor.discordId !== "-" && (
                        <IconButton
                          size="small"
                          sx={{ ml: 0.5 }}
                          onClick={() =>
                            openLink(
                              `https://discord.com/users/${mentor.discordId}`
                            )
                          }
                        >
                          <FaDiscord style={{ fontSize: "1.2rem" }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>

                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="cardLabel">Org Type:</Typography>
                    <Typography variant="cardValue">
                      {mentor.orgType}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* COMPLETED / PR MERGED */}
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
                    leftValue={mentor?.completedTasks}
                    rightLabel="PR Merged"
                    rightValue={mentor?.prMerged}
                  />
                </CardContent>
              </Card>
            </Grid>

            {/* TECH STACK */}
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
                    sx={{ fontWeight: 600 }}
                    gutterBottom
                  >
                    Tech Skills Demonstrated
                  </Typography>

                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {mentor.techStack?.map((skill, idx) => (
                      <Chip
                        key={skill + idx}
                        label={skill}
                        size="small"
                        sx={{ bgcolor: "#e0e0e0" }}
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* ————— TABS ————— */}
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
                  px: 3,
                  textTransform: "none",
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
            {/* ————— SIDEBAR ————— */}
            <Grid item xs={12} md={3}>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
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
                  }}
                >
                  <Divider sx={{ my: 1 }} />

                  {/* PROJECT FILTERS */}
                  {tab === "projects" ? (
                    <>
                      <SidebarSection
                        title="Project Filters"
                        open={openFilterSection}
                        toggleOpen={() => setOpenFilterSection((v) => !v)}
                      >
                        <FilterPanel
                          switchFilters={[
                            {
                              label: "Open Tasks Only",
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
                        title="Task Status"
                        open={openStatusSection}
                        toggleOpen={() => setOpenStatusSection((v) => !v)}
                      >
                        <FilterPanel
                          switchFilters={Object.keys(filters.statuses).map(
                            (status) => ({
                              label:
                                status.charAt(0).toUpperCase() +
                                status.slice(1),
                              checked: filters.statuses[status],
                              name: status,
                            })
                          )}
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
                  ) : (
                    /* DEVELOPER SKILL FILTER */
                    <SidebarSection
                      title="Tech Skills"
                      open={openTechSection}
                      toggleOpen={() => setOpenTechSection((v) => !v)}
                    >
                      <Stack spacing={0.5}>
                        {allSkills.map((skill) => (
                          <Box
                            key={skill}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              px: 1,
                              py: 0.8,
                              borderBottom: "1px solid #eee",
                            }}
                          >
                            <Typography>{skill}</Typography>
                            <Switch
                              checked={selectedSkills.includes(skill)}
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
                        ))}
                      </Stack>
                    </SidebarSection>
                  )}
                </Box>
              </Box>
            </Grid>

            {/* ————— MAIN CONTENT ————— */}
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
                {/* RADIO (All / Owned / Contributed) */}
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
                          control={<Radio />}
                          label="All"
                        />
                        <FormControlLabel
                          value="owned"
                          control={<Radio />}
                          label="Owned"
                        />
                        <FormControlLabel
                          value="contributed"
                          control={<Radio />}
                          label="Contributed"
                        />
                      </>
                    ) : (
                      <FormControlLabel
                        value="all"
                        control={<Radio />}
                        label="All"
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
                      Loading org mentor data...
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
                              iconName: item.githubUrl ? "GitHub" : undefined,
                              title: item.name,
                              secondaryLabel: "Creation Date:",
                              secondaryValue: item.created_at,
                              description: item.description,
                              items: [
                                {
                                  label: "Domain:",
                                  value: item.domain,
                                  type: "chip",
                                },
                                {
                                  label: "Tech Stack:",
                                  value: item.techStack.length
                                    ? item.techStack
                                    : ["-"],
                                  type: "chip",
                                },
                                {
                                  label: "Task Status:",
                                  value: item.status,
                                  type: "text",
                                },
                              ],
                              onClick:
                                item.githubUrl !== "-"
                                  ? () => openLink(item.githubUrl)
                                  : undefined,
                            }
                          : {
                              key: item.id,
                              iconName: item.githubUrl ? "GitHub" : undefined,
                              title: item.name,
                              items: [
                                {
                                  label: "Completed Tasks:",
                                  value: item.completedTasks,
                                },
                                { label: "PRs Merged:", value: item.prMerged },
                                {
                                  label: "Tech Stack:",
                                  value: item.techStack.length
                                    ? item.techStack
                                    : ["-"],
                                  type: "chip",
                                },
                                {
                                  label: "Task Status:",
                                  value: item.taskStatus,
                                },
                              ],
                              onClick:
                                item.githubUrl !== "-"
                                  ? () => openLink(item.githubUrl)
                                  : undefined,
                            }
                      }
                    />
                  </Box>
                )}

                {/* PAGINATION */}
                <PaginationBar
                  totalPages={totalPages}
                  currentPage={page}
                  onPageChange={(_, v) => setPage(v)}
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

export default MentorHome;
