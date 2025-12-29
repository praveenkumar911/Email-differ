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
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import SidebarSection from "../../components/SidebarSection";
import TableHeaderWithSort from "../../components/TableHeaderWithSort";
import FilterPanel from "../../components/FilterPanel";
import PaginationBar from "../../components/PaginationBar";
import { Loader, ErrorMessage } from "../../components/Loader";
import DetailedCard from "../../components/DetailedCard";
import headerImage from "../../assets/header-background.png";

const BASE_API = process.env.REACT_APP_BASE_API;

function normalizeProject(p, idx) {
  const domains = Array.isArray(p.domain)
    ? p.domain.map((d) => String(d).trim()).filter(Boolean)
    : [];

  return {
    id: p._id || p.project_id || idx,
    name: p.projectName || "Untitled",
    description: p.description || "No description available",
    domain: domains.length > 0 ? domains : ["General"],
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
    isOpen: p.status && p.status.toLowerCase() === "ongoing",
    githubUrl: p.githubUrl || "",
    owner: p.owner || "",
    complexity: p.complexity || "N/A",
  };
}

function ProjectDashboard() {
  const [projects, setProjects] = useState([]);
  const [techSkills, setTechSkills] = useState({});
  const [searchText, setSearchText] = useState("");
  const [isDetailedView, setIsDetailedView] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [showOpenOnly, setShowOpenOnly] = useState(false);
  const [selectedTechs, setSelectedTechs] = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openPrograms, setOpenPrograms] = useState(true);
  const [openDomains, setOpenDomains] = useState(false);
  const [openTechs, setOpenTechs] = useState(false);
  const [openFilters, setOpenFilters] = useState(false);

  const drawerWidth = 280;
  const projectsPerPage = 10;

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const navigate = useNavigate();
  const tableContainerRef = useRef(null);
  const detailedContainerRef = useRef(null);

  const scrollToTop = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = 0;
    }
    if (detailedContainerRef.current) {
      detailedContainerRef.current.scrollTop = 0;
    }
  };

  useEffect(() => {
    scrollToTop();
  }, [currentPage]);

  useEffect(() => {
    scrollToTop();
  }, [
    isDetailedView,
    selectedDomain,
    selectedTechs,
    selectedProgram,
    showOpenOnly,
  ]);

  useEffect(function () {
    setLoading(true);
    setError(null);
    fetch(`${BASE_API}/api/projects/all`)
      .then(function (res) {
        return res.json();
      })
      .then(function (json) {
        var rawProjects = Array.isArray(json?.data?.data) ? json.data.data : [];
        setTechSkills(json?.data?.techSkills || {});
        setProjects(
          rawProjects.map(function (p, idx) {
            return normalizeProject(p, idx);
          })
        );
        setLoading(false);
      })
      .catch(function (err) {
        setError(String(err));
        setProjects([]);
        setLoading(false);
      });
  }, []);

  var sidebarBaseProjects = useMemo(
    function () {
      return selectedProgram
        ? projects.filter(function (p) {
            return p.source === selectedProgram;
          })
        : projects;
    },
    [projects, selectedProgram]
  );

  var allDomains = useMemo(() => {
    const domainSet = new Set();
    sidebarBaseProjects.forEach((p) => {
      if (Array.isArray(p.domain)) {
        p.domain.forEach((d) => {
          const cleaned = String(d).trim();
          if (cleaned) domainSet.add(cleaned);
        });
      }
    });
    return Array.from(domainSet).sort((a, b) => a.localeCompare(b));
  }, [sidebarBaseProjects]);

  var allTechs = useMemo(
    function () {
      var filteredProjects = projects;
      if (selectedProgram)
        filteredProjects = filteredProjects.filter(function (p) {
          return p.source === selectedProgram;
        });
      if (selectedDomain)
        filteredProjects = filteredProjects.filter(function (p) {
          return p.domain === selectedDomain;
        });
      var all = filteredProjects
        .flatMap(function (p) {
          return p.techStack || [];
        })
        .map(function (skill) {
          return skill && skill.trim().toLowerCase();
        })
        .filter(Boolean);
      return Array.from(new Set(all)).sort(function (a, b) {
        return a.localeCompare(b);
      });
    },
    [projects, selectedProgram, selectedDomain]
  );

  var filteredProjects = useMemo(
    function () {
      return projects.filter(function (project) {
        var matchesSearch = project.name
          .toLowerCase()
          .includes(searchText.toLowerCase());
        var matchesDomain =
          selectedDomain === "" ||
          (Array.isArray(project.domain) &&
            project.domain.some(
              (d) => d.toLowerCase() === selectedDomain.toLowerCase()
            ));
        var matchesOpen = !showOpenOnly || project.isOpen;
        var matchesTech =
          selectedTechs.length === 0 ||
          selectedTechs.every(function (tech) {
            return project.techStack.includes(tech.toLowerCase());
          });
        var matchesProgram =
          selectedProgram === "" || project.source === selectedProgram;
        return (
          matchesSearch &&
          matchesDomain &&
          matchesOpen &&
          matchesTech &&
          matchesProgram
        );
      });
    },
    [
      projects,
      searchText,
      selectedDomain,
      showOpenOnly,
      selectedTechs,
      selectedProgram,
    ]
  );

  var sortedProjects = useMemo(
    function () {
      var projectsCopy = [].concat(filteredProjects);
      projectsCopy.sort(function (a, b) {
        if (sortBy === "createdAt") {
          return sortOrder === "asc"
            ? new Date(a.createdAt) - new Date(b.createdAt)
            : new Date(b.createdAt) - new Date(a.createdAt);
        } else if (sortBy === "name") {
          return sortOrder === "asc"
            ? a.name.localeCompare(b.name, undefined, {
                numeric: true,
                sensitivity: "base",
              })
            : b.name.localeCompare(a.name, undefined, {
                numeric: true,
                sensitivity: "base",
              });
        } else if (sortBy === "domain") {
          return sortOrder === "asc"
            ? a.domain.localeCompare(b.domain)
            : b.domain.localeCompare(a.domain);
        }
        return 0;
      });
      return projectsCopy;
    },
    [filteredProjects, sortBy, sortOrder]
  );

  var indexOfLast = currentPage * projectsPerPage;
  var indexOfFirst = indexOfLast - projectsPerPage;
  var currentProjects = sortedProjects.slice(indexOfFirst, indexOfLast);
  var totalPages = Math.ceil(sortedProjects.length / projectsPerPage);

  var sidebarContent = (
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
              Browse By Programs
            </Typography>
          }
          open={openPrograms}
          toggleOpen={() => setOpenPrograms(!openPrograms)}
        >
          <Box>
            {Object.keys(techSkills).map(function (program) {
              var count = projects.filter(function (p) {
                return p.source === program;
              }).length;
              return (
                <ListItemButton
                  key={program}
                  selected={selectedProgram === program}
                  onClick={function () {
                    setSelectedProgram(program);
                    setSelectedDomain("");
                    setCurrentPage(1);
                    if (isMobile) setMobileOpen(false);
                  }}
                  sx={{
                    width: "100%",
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
            {selectedProgram && (
              <ListItemButton
                onClick={function () {
                  setSelectedProgram("");
                }}
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
        <SidebarSection
          title={<Typography variant="sideSectionTitle">Domains</Typography>}
          open={openDomains}
          toggleOpen={() => setOpenDomains(!openDomains)}
        >
          <Box>
            {allDomains.map(function (domain) {
              // CORRECT COUNT: check if domain exists in the array
              var count = sidebarBaseProjects.filter(function (p) {
                return (
                  Array.isArray(p.domain) &&
                  p.domain.some(
                    (d) => d.trim().toLowerCase() === domain.toLowerCase()
                  )
                );
              }).length;

              return (
                <ListItemButton
                  key={domain}
                  selected={selectedDomain === domain}
                  onClick={function () {
                    setSelectedDomain(domain);
                    setCurrentPage(1);
                    if (isMobile) setMobileOpen(false);
                  }}
                  sx={{
                    width: "100%",
                    py: 0.5,
                    borderRadius: 1,
                    display: "flex",
                    alignItems: "center",
                    overflow: "hidden",
                    "& .MuiListItemText-root": { flexGrow: 1, minWidth: 0 },
                    "& .MuiListItemText-primary": {
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                    "&.Mui-selected": {
                      backgroundColor: "primary.main",
                      color: "white",
                      "&:hover": { backgroundColor: "primary.dark" },
                    },
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography variant="filterLabel">{domain}</Typography>
                    }
                  />
                  <Chip
                    label={count + " project" + (count === 1 ? "" : "s")}
                    size="small"
                    color={selectedDomain === domain ? "secondary" : "default"}
                    sx={{
                      backgroundColor:
                        selectedDomain === domain
                          ? "white"
                          : "rgba(0, 0, 0, 0.1)",
                      color:
                        selectedDomain === domain ? "primary.main" : "inherit",
                      minWidth: 32,
                    }}
                  />
                </ListItemButton>
              );
            })}

            {selectedDomain && (
              <ListItemButton onClick={() => setSelectedDomain("")}>
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
      </Box>
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
          title={<Typography variant="sideSectionTitle">Filters</Typography>}
          open={openFilters}
          toggleOpen={() => setOpenFilters(!openFilters)}
        >
          <FilterPanel
            switchFilters={[
              {
                label: (
                  <Typography variant="filterLabel">
                    Show Open Projects
                  </Typography>
                ),
                checked: showOpenOnly,
                name: "open",
              },
            ]}
            onSwitchChange={function (name, value) {
              setShowOpenOnly(value);
            }}
          />
        </SidebarSection>
        <SidebarSection
          title={<Typography variant="sideSectionTitle">Tech Stack</Typography>}
          open={openTechs}
          toggleOpen={() => setOpenTechs(!openTechs)}
        >
          <FilterPanel
            switchFilters={allTechs.map(function (tech) {
              return {
                label: <Typography variant="filterLabel">{tech}</Typography>,
                checked: selectedTechs.includes(tech),
                name: tech,
              };
            })}
            onSwitchChange={function (name, checked) {
              setSelectedTechs(
                checked
                  ? selectedTechs.concat(name)
                  : selectedTechs.filter(function (t) {
                      return t !== name;
                    })
              );
              setCurrentPage(1);
            }}
          />
        </SidebarSection>
      </Box>
    </Box>
  );

  const ellipsize = (text, max = 20) => {
    if (!text) return "";
    return text.length > max ? text.substring(0, max) + "..." : text;
  };

  return (
    <>
      <title>Projects Directory</title>
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
                  Project Directory
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
                    navigate("/repositories");
                  }}
                >
                  <Typography
                    variant="filterLabel"
                    sx={{ color: "var(--color-white)" }}
                  >
                    View by Repository
                  </Typography>
                </Box>
                <TextField
                  size="small"
                  placeholder="Search by Title"
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
                <FilterPanel
                  switchFilters={[
                    {
                      label: (
                        <Typography
                          variant="filterLabel"
                          sx={{ color: "var(--color-white)" }}
                        >
                          Detailed View
                        </Typography>
                      ),
                      checked: isDetailedView,
                      name: "detailed",
                      color: "var(--color-white)",
                      labelColor: "var(--color-white)",
                    },
                  ]}
                  onSwitchChange={function (name, value) {
                    setIsDetailedView(value);
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
                {sidebarContent}
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
                {sidebarContent}
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
                Projects in Category
                <Typography
                  variant="cardLabel"
                  color="text.secondary"
                  component="span"
                >
                  ({sortedProjects.length})
                </Typography>
              </Typography>
              {loading && <Loader />}
              {error && <ErrorMessage error={error} />}
              {!loading && !error && !isDetailedView && (
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
                  ref={tableContainerRef}
                >
                  <Table stickyHeader aria-label="projects table">
                    <TableHead>
                      <TableRow>
                        <TableHeaderWithSort
                          label={
                            <Typography variant="tableLabel">
                              Project Name
                            </Typography>
                          }
                          sortBy={sortBy}
                          sortField="name"
                          sortOrder={sortOrder}
                          setSortBy={setSortBy}
                          setSortOrder={setSortOrder}
                          width="20%"
                        />
                        <TableCell sx={{ width: "35%", fontWeight: 600 }}>
                          <Typography variant="tableLabel">
                            Short Description
                          </Typography>
                        </TableCell>
                        <TableHeaderWithSort
                          label={
                            <Typography variant="tableLabel">Domain</Typography>
                          }
                          sortBy={sortBy}
                          sortField="domain"
                          sortOrder={sortOrder}
                          setSortBy={setSortBy}
                          setSortOrder={setSortOrder}
                          width="25%"
                        />
                        <TableHeaderWithSort
                          label={
                            <Typography variant="tableLabel">
                              Creation Date
                            </Typography>
                          }
                          sortBy={sortBy}
                          sortField="createdAt"
                          sortOrder={sortOrder}
                          setSortBy={setSortBy}
                          setSortOrder={setSortOrder}
                          width="20%"
                        />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {currentProjects.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} align="center">
                            <Typography variant="noticeText">
                              No Projects match the current filters.(Try
                              resetting your filters)
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        currentProjects.map(function (project) {
                          return (
                            <TableRow
                              key={project.id}
                              hover
                              sx={{
                                cursor: project.githubUrl
                                  ? "pointer"
                                  : "default",
                              }}
                              onClick={function () {
                                if (project.githubUrl)
                                  window.open(
                                    project.githubUrl,
                                    "_blank",
                                    "noopener noreferrer"
                                  );
                              }}
                            >
                              <TableCell>
                                <Typography variant="tableValue">
                                  {project.name}
                                </Typography>
                              </TableCell>
                              <TableCell
                                sx={{
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  maxWidth: 250,
                                }}
                              >
                                <Typography variant="tableValue">
                                  {project.description}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Box
                                  sx={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 0.5,
                                    alignItems: "center",
                                  }}
                                >
                                  {project.domain.length > 0 ? (
                                    <>
                                      {/* Always show the first domain */}
                                      <Chip
                                        label={project.domain[0]}
                                        size="small"
                                      />

                                      {/* Show second domain only if exactly 2 */}
                                      {project.domain.length === 2 && (
                                        <Chip
                                          label={project.domain[1]}
                                          size="small"
                                        />
                                      )}

                                      {/* Show "+N more" if 3 or more */}
                                      {project.domain.length > 2 && (
                                        <Chip
                                          label={`+${
                                            project.domain.length - 1
                                          } more`}
                                          size="small"
                                          sx={{
                                            bgcolor: "grey.200",
                                            color: "text.primary",
                                            fontWeight: 500,
                                          }}
                                        />
                                      )}
                                    </>
                                  ) : (
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                    >
                                      —
                                    </Typography>
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Typography variant="tableValue">
                                  {project.createdAt
                                    ? new Date(
                                        project.createdAt
                                      ).toLocaleDateString()
                                    : "-"}
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
              {!loading &&
                !error &&
                isDetailedView &&
                (currentProjects.length === 0 ? (
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
                      No Projects match the current filters. (Try resetting your
                      filters)
                    </Typography>
                  </Box>
                ) : (
                  <Box
                    ref={detailedContainerRef}
                    sx={{
                      height: "100vh",
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
                        key: project.id,
                        iconName: project.githubUrl ? "GitHub" : undefined,
                        title: project.name,
                        secondaryLabel: "Creation Date:",
                        secondaryValue:
                          project.createdAt !== "N/A"
                            ? new Date(project.createdAt).toLocaleDateString()
                            : "-",
                        description: project.description,
                        items: [
                          {
                            label: "Domains:",
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
                      gap={2}
                      showEmpty={false}
                      listSx={{ width: "100%" }}
                    />
                  </Box>
                ))}
              <PaginationBar
                totalPages={totalPages}
                currentPage={currentPage}
                loading={loading}
                onPageChange={function (e, page) {
                  setCurrentPage(page);
                }}
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
}

export default ProjectDashboard;
