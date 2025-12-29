import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Box,
  Drawer,
  useMediaQuery,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Paper,
  Chip,
  Divider,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Cancel";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import SidebarSection from "../../components/SidebarSection";
import TableHeaderWithSort from "../../components/TableHeaderWithSort";
import FilterPanel from "../../components/FilterPanel";
import PaginationBar from "../../components/PaginationBar";
import { Loader, ErrorMessage } from "../../components/Loader";
import headerImage from "../../assets/header-background.png";

const BASE_API = process.env.REACT_APP_BASE_API;

function normalizeProject(p, idx) {
  return {
    id: p._id || p.project_id || idx,
    name: p.projectName || "Untitled",
    description: p.description || "No description available",
    domain:
      Array.isArray(p.domain) && p.domain.length > 0 ? p.domain[0] : "General",
    createdAt: p.created_at ? new Date(p.created_at).toISOString() : "N/A",
    source: p.source || "Unknown",
    techStack: Array.isArray(p.techStack)
      ? p.techStack.flatMap(function (raw) {
          return String(raw)
            .split(/,|\n/)
            .map(function (tech) {
              return tech.replace(/["'`]/g, "").trim().toLowerCase();
            })
            .filter(Boolean);
        })
      : [],
    status: p.status ? p.status.toLowerCase() : "unknown",
    githubUrl: p.githubUrl || "",
    owner: p.owner || "",
    complexity: p.complexity || "N/A",
  };
}

function getRepoSlugName(url) {
  if (!url) return "unknown-repo";

  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const lastTwo = parts.slice(-2);
    return lastTwo.join("-");
  } catch (e) {
    return "unknown-repo";
  }
}

function normalizeRepository(r, idx) {
  return {
    id: r._id || r.repoId || idx,
    repoId: r.repoId,
    name: r.repoName || "Untitled Repo",
    slugName: getRepoSlugName(r.repoUrl) || "", // the new name we drived from url
    url: r.repoUrl || "",
    description: r.repoDescription || "",
    noOfProjects: r.noOfProjects || 0,
    domains:
      Array.isArray(r.domains) && r.domains.length > 0
        ? r.domains
        : ["General"],
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : "N/A",
    source: r.source || "Unknown",
    status: r.status ? r.status.toLowerCase() : "unknown",
    isOpen: r.status && r.status.toLowerCase() === "ongoing",
    projects: Array.isArray(r.projects)
      ? r.projects.map(function (p, pi) {
          return normalizeProject(p, pi);
        })
      : [],
  };
}

function RepoDashboard() {
  const [repos, setRepos] = useState([]);
  const [repoTechSkills, setRepoTechSkills] = useState({});
  const [repoDomains, setRepoDomains] = useState({});
  const [repoLoading, setRepoLoading] = useState(false);
  const [repoError, setRepoError] = useState(null);
  const [repoCurrentPage, setRepoCurrentPage] = useState(1);
  const [selectedRepoSource, setSelectedRepoSource] = useState("");
  const [selectedRepoDomains, setSelectedRepoDomains] = useState([]);
  const [repoSortBy, setRepoSortBy] = useState("createdAt");
  const [repoSortOrder, setRepoSortOrder] = useState("desc");
  const [repoStatusFilter, setRepoStatusFilter] = useState("");
  const [selectedTechs, setSelectedTechs] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openRepoPrograms, setOpenRepoPrograms] = useState(true);
  const [openRepoDomains, setOpenRepoDomains] = useState(false);
  const [openRepoTechs, setOpenRepoTechs] = useState(false);
  const [openRepoFilters, setOpenRepoFilters] = useState(false);

  const drawerWidth = 280;
  const reposPerPage = 10;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const navigate = useNavigate();
  const repoTableContainerRef = useRef(null);

  const scrollToTop = () => {
    if (repoTableContainerRef.current) {
      repoTableContainerRef.current.scrollTop = 0;
    }
  };

  useEffect(() => {
    scrollToTop();
  }, [
    repoCurrentPage,
    selectedRepoSource,
    selectedRepoDomains,
    repoSortBy,
    repoSortOrder,
    repoStatusFilter,
    searchText,
    selectedTechs,
  ]);

  useEffect(function () {
    setRepoLoading(true);
    setRepoError(null);
    fetch(`${BASE_API}/api/projects/repo-stats`)
      .then(function (res) {
        return res.json();
      })
      .then(function (json) {
        setRepoDomains(json.domains || {});
        setRepoTechSkills(json.techSkills || {});
        setRepos(
          Array.isArray(json.repos)
            ? json.repos.map(function (r, idx) {
                return normalizeRepository(r, idx);
              })
            : []
        );
        setRepoLoading(false);
      })
      .catch(function (err) {
        setRepoError(String(err));
        setRepoLoading(false);
      });
  }, []);

  var repoSources = useMemo(
    function () {
      var counts = {};
      repos.forEach(function (repo) {
        var source = repo.source || "Unknown";
        counts[source] = (counts[source] || 0) + 1;
      });
      return Object.entries(counts)
        .map(function (entry) {
          return { name: entry[0], count: entry[1] };
        })
        .sort(function (a, b) {
          return a.name.localeCompare(b.name);
        });
    },
    [repos]
  );

  // ---------------------
  // AVAILABLE DOMAINS (clean)
  // ---------------------
  const availableRepoDomains = useMemo(() => {
    let apiDomains = [];

    // 1. Extract domains from backend API response
    if (
      selectedRepoSource &&
      repoDomains[selectedRepoSource] &&
      repoDomains[selectedRepoSource].domains
    ) {
      apiDomains = repoDomains[selectedRepoSource].domains.map((d) =>
        d.trim().toLowerCase()
      );
    } else {
      apiDomains = Object.values(repoDomains)
        .flatMap((obj) => obj.domains || [])
        .map((d) => d.trim().toLowerCase());
    }

    // 2. Detect if any repo has "General"
    const repoHasGeneral = repos.some((r) =>
      (r.domains || []).some((d) => d.trim().toLowerCase() === "general")
    );

    // 3. If repos contain "General" but backend doesn’t → inject it
    if (repoHasGeneral && !apiDomains.includes("general")) {
      apiDomains.push("general");
    }

    // 4. Deduplicate & sort
    return Array.from(new Set(apiDomains)).sort();
  }, [selectedRepoSource, repoDomains, repos]);

  // ---------------------
  // AVAILABLE TECH SKILLS (clean)
  // ---------------------
  const availableRepoTechSkills = useMemo(() => {
    let filtered = repos;

    if (selectedRepoSource) {
      filtered = filtered.filter((r) => r.source === selectedRepoSource);
    }

    if (selectedRepoDomains.length > 0) {
      filtered = filtered.filter(function (repo) {
        const repoDom = (repo.domains || []).map((d) => d.trim().toLowerCase());

        return selectedRepoDomains.every((d) => repoDom.includes(d));
      });
    }

    const skills = filtered
      .flatMap((repo) => repo.projects || [])
      .flatMap((p) => p.techStack || [])
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (skills.length > 0) {
      return Array.from(new Set(skills)).sort();
    }

    // 4) Fallback: skills from selected program
    if (selectedRepoSource && repoTechSkills[selectedRepoSource]) {
      return repoTechSkills[selectedRepoSource].skills
        .map((s) => s.trim().toLowerCase())
        .sort();
    }

    // 5) Fallback: all skills
    const all = Object.values(repoTechSkills)
      .flatMap((obj) => obj.skills || [])
      .map((s) => s.trim().toLowerCase());

    return Array.from(new Set(all)).sort();
  }, [selectedRepoSource, selectedRepoDomains, repos, repoTechSkills]);

  const filteredRepos = useMemo(() => {
    return repos.filter((repo) => {
      // Program match
      const sourceMatches =
        !selectedRepoSource || repo.source === selectedRepoSource;

      const repoDomainsNormalized = (repo.domains || []).map((d) =>
        d.trim().toLowerCase()
      );

      const domainMatches =
        selectedRepoDomains.length === 0 ||
        selectedRepoDomains.every((selected) =>
          repoDomainsNormalized.includes(selected)
        );

      // Open repos match
      const statusMatches = !repoStatusFilter || repo.isOpen;

      // Search match
      const searchMatches =
        !searchText ||
        (repo.slugName || "").toLowerCase().includes(searchText.toLowerCase());

      const techMatches =
        selectedTechs.length === 0 ||
        selectedTechs.every((selectedTech) =>
          repo.projects.some((p) =>
            (p.techStack || [])
              .map((t) => t.toLowerCase())
              .includes(selectedTech)
          )
        );

      return (
        sourceMatches &&
        domainMatches &&
        statusMatches &&
        searchMatches &&
        techMatches
      );
    });
  }, [
    repos,
    selectedRepoSource,
    selectedRepoDomains,
    repoStatusFilter,
    searchText,
    selectedTechs,
  ]);

  // ------------------------------------
  // SORTED REPOS
  // ------------------------------------
  const sortedRepos = useMemo(() => {
    const arr = [...filteredRepos];

    arr.sort((a, b) => {
      if (repoSortBy === "name") {
        const nameA = (a.slugName || "").toLowerCase();
        const nameB = (b.slugName || "").toLowerCase();

        return repoSortOrder === "asc"
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      }

      if (repoSortBy === "noOfProjects") {
        return repoSortOrder === "asc"
          ? (a.noOfProjects || 0) - (b.noOfProjects || 0)
          : (b.noOfProjects || 0) - (a.noOfProjects || 0);
      }

      if (repoSortBy === "createdAt") {
        return repoSortOrder === "asc"
          ? new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
          : new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }

      if (repoSortBy === "domains") {
        const domA = (a.domains?.[0] || "").toLowerCase();
        const domB = (b.domains?.[0] || "").toLowerCase();

        return repoSortOrder === "asc"
          ? domA.localeCompare(domB)
          : domB.localeCompare(domA);
      }

      return 0;
    });

    return arr;
  }, [filteredRepos, repoSortBy, repoSortOrder]);

  // ------------------------------------
  // PAGINATION
  // ------------------------------------
  const totalRepoPages = Math.ceil(sortedRepos.length / reposPerPage);
  const repoIndexOfLast = repoCurrentPage * reposPerPage;
  const repoIndexOfFirst = repoIndexOfLast - reposPerPage;
  const currentRepos = sortedRepos.slice(repoIndexOfFirst, repoIndexOfLast);

  // ---------------------
  // SIDEBAR (Domains + TechStack)
  // ---------------------
  const repoSidebarContent = (
    <Box
      sx={{
        px: 1,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* ------------------------ */}
      {/* PROGRAMS SECTION */}
      {/* ------------------------ */}
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
        }}
      >
        <Divider sx={{ my: 1 }} />

        <SidebarSection
          title={
            <Typography variant="sideSectionTitle">
              Browse By Programs
            </Typography>
          }
          open={openRepoPrograms}
          toggleOpen={() => setOpenRepoPrograms(!openRepoPrograms)}
        >
          <Box>
            {Object.keys(repoTechSkills).map((program) => {
              const count = repos.filter((r) => r.source === program).length;

              return (
                <ListItemButton
                  key={program}
                  selected={selectedRepoSource === program}
                  onClick={() => {
                    setSelectedRepoSource(program);
                    setSelectedRepoDomains([]); // IMPORTANT
                    setRepoCurrentPage(1);
                    if (isMobile) setMobileOpen(false);
                  }}
                  sx={{
                    py: 0.5,
                    borderRadius: 1,
                    "&.Mui-selected": {
                      backgroundColor: "primary.main",
                      color: "white",
                      "&:hover": { backgroundColor: "primary.dark" },
                    },
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography variant="filterLabel">
                        {program} ({count})
                      </Typography>
                    }
                  />
                </ListItemButton>
              );
            })}

            {selectedRepoSource && (
              <ListItemButton
                onClick={() => setSelectedRepoSource("")}
                sx={{ color: "#e41d1dff", cursor: "pointer" }}
              >
                <ListItemText
                  primary={
                    <Typography
                      variant="filterLabel"
                      sx={{ color: "#e41d1dff", cursor: "pointer" }}
                    >
                      Reset
                    </Typography>
                  }
                />
              </ListItemButton>
            )}
          </Box>
        </SidebarSection>

        {/* ------------------------ */}
        {/* DOMAINS SECTION */}
        {/* ------------------------ */}
        <SidebarSection
          title={<Typography variant="sideSectionTitle">Domains</Typography>}
          open={openRepoDomains}
          toggleOpen={() => setOpenRepoDomains(!openRepoDomains)}
        >
          <FilterPanel
            switchFilters={availableRepoDomains.map((domain) => {
              const normalized = domain.trim().toLowerCase();

              return {
                label: <Typography variant="filterLabel">{domain}</Typography>,
                checked: selectedRepoDomains.includes(normalized),
                name: normalized,
              };
            })}
            onSwitchChange={(name, checked) => {
              setSelectedRepoDomains(
                checked
                  ? [...selectedRepoDomains, name]
                  : selectedRepoDomains.filter((d) => d !== name)
              );
              setRepoCurrentPage(1);
            }}
          />

          {selectedRepoDomains.length > 0 && (
            <Box sx={{ px: 2, py: 1 }}>
              <Typography
                variant="filterLabel"
                sx={{ color: "#e41d1dff", cursor: "pointer" }}
                onClick={() => setSelectedRepoDomains([])}
              >
                Reset
              </Typography>
            </Box>
          )}
        </SidebarSection>
      </Box>

      {/* ------------------------ */}
      {/* FILTERS + TECH STACK */}
      {/* ------------------------ */}
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
        }}
      >
        <Divider sx={{ my: 1 }} />

        {/* SHOW OPEN */}
        <SidebarSection
          title={<Typography variant="sideSectionTitle">Filters</Typography>}
          open={openRepoFilters}
          toggleOpen={() => setOpenRepoFilters(!openRepoFilters)}
        >
          <FilterPanel
            switchFilters={[
              {
                label: (
                  <Typography variant="filterLabel">Show Open repos</Typography>
                ),
                checked: repoStatusFilter === "open",
                name: "open",
              },
            ]}
            onSwitchChange={(name, checked) => {
              setRepoStatusFilter(checked ? name : "");
            }}
          />
        </SidebarSection>

        {/* TECH STACK */}
        <SidebarSection
          title={<Typography variant="sideSectionTitle">Tech Stack</Typography>}
          open={openRepoTechs}
          toggleOpen={() => setOpenRepoTechs(!openRepoTechs)}
        >
          <FilterPanel
            switchFilters={availableRepoTechSkills.map((tech) => ({
              label: <Typography variant="filterLabel">{tech}</Typography>,
              checked: selectedTechs.includes(tech),
              name: tech,
            }))}
            onSwitchChange={(name, checked) => {
              setSelectedTechs(
                checked
                  ? [...selectedTechs, name]
                  : selectedTechs.filter((t) => t !== name)
              );
              setRepoCurrentPage(1);
            }}
          />
        </SidebarSection>
      </Box>
    </Box>
  );

  const ellipsize = (text, max = 15) => {
    if (!text) return "";
    return text.length > max ? text.substring(0, max) + "..." : text;
  };

  return (
    <>
      <title>Repository Directory</title>
      <Box sx={{ display: "flex", flex: 1 }}>
        <Box
          component="main"
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <AppBar
            position="static"
            color="default"
            elevation={1}
            sx={{ height: 80 }}
          >
            <Toolbar
              sx={{
                height: "100%",
                display: "flex",
                justifyContent: "space-between",
                backgroundImage: "url(" + headerImage + ")",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                {isMobile && (
                  <IconButton
                    onClick={function () {
                      setMobileOpen(true);
                    }}
                    sx={{ color: "var(--color-white)" }}
                  >
                    <MenuIcon />
                  </IconButton>
                )}
                <Typography
                  variant="mainHeading"
                  sx={{
                    color: "var(--color-white)",
                  }}
                >
                  Repository Directory
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                  sx={{
                    px: 3,
                    py: { xs: 0, sm: 1 },
                    color: "var(--color-white)",
                    border: "2px solid var(--color-white)",
                    borderRadius: 2,
                    fontSize: { xs: "0.875rem", sm: "1rem" },
                    cursor: "pointer",
                    textAlign: "center",
                    mr: 2,
                    "&:hover": {
                      bgcolor: "var(--item-active-bgcolor)",
                      color: "var(--item-active-color)",
                      borderColor: "var(--item-active-bgcolor)",
                    },
                  }}
                  onClick={function () {
                    navigate("/projects");
                  }}
                >
                  <Typography
                    variant="filterLabel"
                    sx={{ color: "var(--color-white)" }}
                  >
                    View by Projects
                  </Typography>
                </Box>
                <TextField
                  size="small"
                  placeholder="Search by Name"
                  value={searchText}
                  onChange={function (e) {
                    setSearchText(e.target.value);
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        {searchText && (
                          <IconButton
                            onClick={function () {
                              setSearchText("");
                            }}
                            size="small"
                          >
                            <ClearIcon />
                          </IconButton>
                        )}
                        <IconButton size="small">
                          <SearchIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    backgroundColor: "var(--color-white)",
                    borderRadius: 3,
                  }}
                />
              </Box>
            </Toolbar>
          </AppBar>

          <Box sx={{ display: "flex", p: 2 }}>
            {isMobile ? (
              <Drawer
                variant="temporary"
                open={mobileOpen}
                onClose={function () {
                  setMobileOpen(false);
                }}
                ModalProps={{ keepMounted: true }}
                sx={{
                  "& .MuiDrawer-paper": {
                    width: drawerWidth,
                    position: "absolute",
                    zIndex: 1000,
                    py: 2,
                  },
                }}
              >
                {repoSidebarContent}
              </Drawer>
            ) : (
              <Drawer
                variant="permanent"
                open
                sx={{
                  position: "relative",
                  "& .MuiDrawer-paper": {
                    position: "relative",
                    height: "calc(100vh - 150px)",
                    maxHeight: "calc(100vh - 150px)",
                    overflow: "auto",
                    boxSizing: "border-box",
                    width: drawerWidth,
                    zIndex: 1000,
                    "&::-webkit-scrollbar": { display: "none" },
                    msOverflowStyle: "none",
                    scrollbarWidth: "none",
                    borderRight: "none",
                  },
                  height: "100%",
                  mr: 2,
                }}
              >
                {repoSidebarContent}
              </Drawer>
            )}
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
                Repositories in Category
                <Typography
                  variant="cardLabel"
                  color="text.secondary"
                  component="span"
                >
                  ({sortedRepos.length})
                </Typography>
              </Typography>
              {repoLoading && <Loader />}
              {repoError && <ErrorMessage error={repoError} />}
              {!repoLoading && !repoError && (
                <TableContainer
                  component={Paper}
                  sx={{
                    height: "100vh",
                    maxHeight: "calc(100vh - 260px)",
                    overflow: "auto",
                    "&::-webkit-scrollbar": { display: "none" },
                    msOverflowStyle: "none",
                    scrollbarWidth: "none",
                  }}
                  ref={repoTableContainerRef}
                >
                  <Table stickyHeader aria-label="repo table">
                    <TableHead>
                      <TableRow>
                        <TableHeaderWithSort
                          label={
                            <Typography variant="tableLabel">
                              Repository Name
                            </Typography>
                          }
                          sortBy={repoSortBy}
                          sortField="name"
                          sortOrder={repoSortOrder}
                          setSortBy={setRepoSortBy}
                          setSortOrder={setRepoSortOrder}
                          width="20%"
                        />
                        <TableCell sx={{ width: "10%", fontWeight: 600 }}>
                          <Typography variant="tableLabel">
                            No of Projects
                          </Typography>
                        </TableCell>
                        <TableHeaderWithSort
                          label={
                            <Typography variant="tableLabel">
                              Domains
                            </Typography>
                          }
                          sortBy={repoSortBy}
                          sortField="domains"
                          sortOrder={repoSortOrder}
                          setSortBy={setRepoSortBy}
                          setSortOrder={setRepoSortOrder}
                          width="25%"
                        />
                        <TableHeaderWithSort
                          label={
                            <Typography variant="tableLabel">
                              Creation Date
                            </Typography>
                          }
                          sortBy={repoSortBy}
                          sortField="createdAt"
                          sortOrder={repoSortOrder}
                          setSortBy={setRepoSortBy}
                          setSortOrder={setRepoSortOrder}
                          width="15%"
                        />
                        <TableCell sx={{ width: "15%" }}>
                          <Typography variant="tableLabel">Status</Typography>
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {currentRepos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography variant="noticeText">
                              No repositories match the current filters. (Try
                              resetting your filters)
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        currentRepos.map(function (repo) {
                          return (
                            <TableRow
                              key={repo.repoId}
                              hover
                              onClick={function () {
                                navigate("/repository/" + repo.repoId);
                              }}
                              sx={{ cursor: "pointer" }}
                            >
                              <TableCell>
                                <Typography variant="tableValue">
                                  {repo.slugName}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="tableValue">
                                  {repo.noOfProjects || "-"}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                {repo.domains && repo.domains.length > 0 ? (
                                  <>
                                    {repo.domains
                                      .slice(0, 2)
                                      .map((domain, i) => (
                                        <Chip
                                          key={i}
                                          label={ellipsize(domain, 15)}
                                          size="small"
                                          sx={{ mr: 0.5, mb: 0.3 }}
                                        />
                                      ))}

                                    {repo.domains.length > 2 && (
                                      <Chip
                                        label={`+${
                                          repo.domains.length - 2
                                        } more`}
                                        size="small"
                                      />
                                    )}
                                  </>
                                ) : (
                                  <Typography variant="tableValue">
                                    -
                                  </Typography>
                                )}
                              </TableCell>

                              <TableCell>
                                <Typography variant="tableValue">
                                  {repo.createdAt
                                    ? new Date(
                                        repo.createdAt
                                      ).toLocaleDateString()
                                    : "-"}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="tableValue">
                                  {repo.status}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {!repoLoading && !repoError && totalRepoPages > 1 && (
                <PaginationBar
                  totalPages={totalRepoPages}
                  currentPage={repoCurrentPage}
                  onPageChange={function (e, page) {
                    setRepoCurrentPage(page);
                  }}
                  loading={false}
                />
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
}

export default RepoDashboard;
