import React, { useState, useMemo, useEffect, useRef } from "react";
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
  ListItemButton,
  ListItemText,
  Divider,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Cancel";
import { useTheme } from "@mui/material/styles";
import SidebarSection from "../../components/SidebarSection";
import FilterPanel from "../../components/FilterPanel";
import TableHeaderWithSort from "../../components/TableHeaderWithSort";
import PaginationBar from "../../components/PaginationBar";
import { Loader, ErrorMessage } from "../../components/Loader";
import headerImage from "../../assets/header-background.png";
import { useNavigate } from "react-router-dom";

const BASE_API = process.env.REACT_APP_BASE_API;

// --- Normalize tech stack ---
function normalizeTechStack(arr) {
  if (!Array.isArray(arr)) return [];
  return Array.from(
    new Set(
      arr
        .flatMap((raw) => String(raw).split(","))
        .map((tech) => tech.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function MembersDashboard() {
  // ---- State
  const [contributors, setContributors] = useState([]);
  const [techSkills, setTechSkills] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingSearchText, setPendingSearchText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalContributors, setTotalContributors] = useState(0);
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedTechs, setSelectedTechs] = useState([]);
  const [openBrowse, setOpenBrowse] = useState(true);
  const [openType, setOpenType] = useState(false);
  const [openTechs, setOpenTechs] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");

  // Pagination params
  const membersPerPage = 20;
  const drawerWidth = 280;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const memTableContainerRef = useRef(null);
  const navigate = useNavigate();

  const scrollToTop = () => {
    if (memTableContainerRef.current) {
      memTableContainerRef.current.scrollTop = 0;
    }
  };

  useEffect(() => {
    scrollToTop();
  }, [
    currentPage,
    selectedSource,
    selectedType,
    selectedTechs,
    sortBy,
    sortOrder,
    searchText,
  ]);

  // ---- Fetch developers & total count (server paged), with search API only on icon click
  useEffect(() => {
    setLoading(true);
    setError("");
    let url = "";

    if (searchText && searchText.trim().length > 0) {
      url = `${BASE_API}/api/users/contributors/search/developers?q=${encodeURIComponent(
        searchText
      )}&page=${currentPage}&limit=${membersPerPage}`;
    } else {
      url = `${BASE_API}/api/users/contributors/developers?page=${currentPage}&limit=${membersPerPage}`;
    }

    fetch(url)
      .then(async (res) => {
        if (res.status === 404) {
          return {
            developers: [],
            totalDevelopers: 0,
            techSkills: {},
          };
        }
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setTechSkills(json.techSkills || {});
        const developersArr = Array.isArray(json.developers)
          ? json.developers
          : [];
        setTotalContributors(json.totalDevelopers || 0);
        const normalized = developersArr.map((m, idx) => ({
          id: m._id || m.userId || idx,
          name:
            (m.name && typeof m.name === "string" && m.name.trim()) ||
            `User ${m.userId || idx}`,
          githubUrl: m.githubUrl || "",
          contact: m.phoneNumber || "N/A",
          email: m.primaryEmail || "N/A",
          discordId: m.discordId || "N/A",
          orgType: "N/A",
          organization: m.organization || "N/A",
          completedTasks: m.stats?.completedTasks?.toString() ?? "0",
          ranking: m.ranking ?? 0,
          rating: m.rating ?? 0,
          role: m.roleId || "N/A",
          type: "Developer",
          source: m.source || "Unknown",
          techStack: normalizeTechStack(m.techStack || []),
          stats: m.stats || {},
          isverified: !!m.isverified,
          ...m,
        }));
        setContributors(normalized);
        setLoading(false);
        setError("");
      })
      .catch((err) => {
        if (err.message && err.message.startsWith("API error: 404")) {
          setContributors([]);
          setTotalContributors(0);
          setError("");
        } else {
          setContributors([]);
          setTotalContributors(0);
          setError(err.message || "Unknown error");
        }
        setLoading(false);
      });

    if (memTableContainerRef.current) {
      memTableContainerRef.current.scrollTo({ top: 0 });
    }
    // eslint-disable-next-line
  }, [searchText, currentPage]);

  // --- Compute sidebar source list
  const sourcesList = useMemo(() => {
    const map = {};
    contributors.forEach((m) => {
      const val = m.source || "Unknown";
      map[val] = (map[val] || 0) + 1;
    });
    return Object.entries(map)
      .map(([src, count]) => ({ src, count }))
      .sort((a, b) => String(a.src || "").localeCompare(String(b.src || "")));
  }, [contributors]);

  // --- "Type" sidebar
  const typeCounts = useMemo(() => {
    const filtered = selectedSource
      ? contributors.filter((m) => m.source === selectedSource)
      : contributors;

    const map = {};
    filtered.forEach((m) => {
      const val =
        (m.type && typeof m.type === "string" && m.type.trim()) || "N/A";
      map[val] = (map[val] || 0) + 1;
    });

    return Object.entries(map)
      .map(([name, count]) => ({ name: name || "N/A", count }))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [contributors, selectedSource]);

  // --- Compute techs for currently selected source, fallback: all
  const sidebarTechs = useMemo(() => {
    if (!selectedSource) {
      return Array.from(new Set(contributors.flatMap((m) => m.techStack || [])))
        .filter(Boolean)
        .sort((a, b) => String(a || "").localeCompare(String(b || "")));
    }

    if (
      techSkills[selectedSource] &&
      Array.isArray(techSkills[selectedSource].skills)
    ) {
      return Array.from(
        new Set(
          techSkills[selectedSource].skills.map((t) => t.trim().toLowerCase())
        )
      ).sort((a, b) => String(a || "").localeCompare(String(b || "")));
    }

    return Array.from(
      new Set(
        contributors
          .filter((m) => m.source === selectedSource)
          .flatMap((m) => m.techStack || [])
      )
    )
      .filter(Boolean)
      .sort((a, b) => String(a || "").localeCompare(String(b || "")));
  }, [contributors, selectedSource, techSkills]);

  // --- Filtering, Sorting, Paging (after backend search/filter)
  const filteredMembers = useMemo(
    () =>
      contributors.filter((m) => {
        const matchesSource = !selectedSource || m.source === selectedSource;
        const matchesType = !selectedType || m.type === selectedType;
        const matchesTech =
          selectedTechs.length === 0 ||
          selectedTechs.every((t) => (m.techStack || []).includes(t));
        return matchesSource && matchesType && matchesTech;
      }),
    [contributors, selectedSource, selectedType, selectedTechs]
  );

  const sortedMembers = useMemo(() => {
    const arr = [...filteredMembers];
    arr.sort((a, b) => {
      if (sortBy === "name") {
        const nameA = a.name || "";
        const nameB = b.name || "";
        return sortOrder === "asc"
          ? nameA.localeCompare(nameB, undefined, {
              numeric: true,
              sensitivity: "base",
            })
          : nameB.localeCompare(nameA, undefined, {
              numeric: true,
              sensitivity: "base",
            });
      }
      if (sortBy === "organization") {
        const orgA = a.organization || "";
        const orgB = b.organization || "";
        return sortOrder === "asc"
          ? orgA.localeCompare(orgB)
          : orgB.localeCompare(orgA);
      }
      if (sortBy === "type") {
        const typeA = a.type || "";
        const typeB = b.type || "";
        return sortOrder === "asc"
          ? typeA.localeCompare(typeB)
          : typeB.localeCompare(typeA);
      }
      if (sortBy === "source") {
        const sourceA = a.source || "";
        const sourceB = b.source || "";
        return sortOrder === "asc"
          ? sourceA.localeCompare(sourceB)
          : sourceB.localeCompare(sourceA);
      }
      return 0;
    });
    return arr;
  }, [filteredMembers, sortBy, sortOrder]);

  useEffect(() => {
    if (pendingSearchText === "") {
      setSearchText("");
      setCurrentPage(1);
    }
  }, [pendingSearchText]);

  const totalPages = Math.ceil(totalContributors / membersPerPage);
  // Page already server-paginated, but local filters/sort may reduce it
  const currentMembers = sortedMembers.slice(0, membersPerPage);

  // --- Sidebar box styling helper
  function sidebarBoxSx() {
    return {
      px: 1,
      border: "2px solid #000",
      borderRadius: "12px",
      boxShadow: "3px 3px 0 #000",
      maxHeight: "50vh",
      overflow: "auto",
      boxSizing: "border-box",
      zIndex: 1000,
      "&::-webkit-scrollbar": { display: "none" },
      msOverflowStyle: "none",
      scrollbarWidth: "none",
    };
  }

  // --- Sidebar content
  const sidebarContent = (
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
      <Box sx={sidebarBoxSx()}>
        <Divider sx={{ my: 1 }} />
        {/* 1. Browse By (sources) */}
        <SidebarSection
          title={
            <Typography variant="sideSectionTitle">Browse By Source</Typography>
          }
          open={openBrowse}
          toggleOpen={() => setOpenBrowse(!openBrowse)}
        >
          <Box>
            {sourcesList.map((item) => (
              <ListItemButton
                key={item.src}
                selected={selectedSource === item.src}
                onClick={() => {
                  setSelectedSource(item.src);
                  setSelectedTechs([]);
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
                      {item.src} ({item.count})
                    </Typography>
                  }
                />
              </ListItemButton>
            ))}
            {selectedSource && (
              <ListItemButton
                onClick={() => {
                  setSelectedSource("");
                  setSelectedTechs([]);
                  setCurrentPage(1);
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

        {/* 2. Type */}
        {/* <SidebarSection
          title={<Typography variant="sideSectionTitle">Type</Typography>}
          open={openType}
          toggleOpen={() => setOpenType((v) => !v)}
        >
          <Box>
            {typeCounts.map((type) => (
              <ListItemButton
                key={type.name}
                selected={selectedType === type.name}
                onClick={() => {
                  setSelectedType(type.name);
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
                  "& .MuiListItemText-root": {
                    flexGrow: 1,
                    minWidth: 0,
                  },
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
                    <Typography variant="filterLabel">{type.name}</Typography>
                  }
                />
                <Chip
                  label={`${type.count} item${type.count === 1 ? "" : "s"}`}
                  size="small"
                  color={selectedType === type.name ? "secondary" : "default"}
                  sx={{
                    backgroundColor:
                      selectedType === type.name
                        ? "white"
                        : "rgba(0, 0, 0, 0.1)",
                    color:
                      selectedType === type.name ? "primary.main" : "inherit",
                    minWidth: 32,
                  }}
                />
              </ListItemButton>
            ))}
            {selectedType && (
              <ListItemButton onClick={() => setSelectedType("")}>
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
        </SidebarSection> */}
      </Box>
      <Box sx={sidebarBoxSx()}>
        <Divider sx={{ my: 1 }} />
        {/* 3. Tech Skills */}
        <SidebarSection
          title={
            <Typography variant="sideSectionTitle">Tech Skills</Typography>
          }
          open={openTechs}
          toggleOpen={() => setOpenTechs(!openTechs)}
        >
          {sidebarTechs.length === 0 ? (
            <Typography variant="noticeText" color="text.secondary">
              No tech skills present in data.
            </Typography>
          ) : (
            <FilterPanel
              switchFilters={sidebarTechs.map((tech) => ({
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
                setCurrentPage(1);
              }}
            />
          )}
        </SidebarSection>
      </Box>
    </Box>
  );

  // --- Main Render
  return (
    <>
      <title>Members Directory</title>
      <Box sx={{ display: "flex", flex: 1 }}>
        <Box
          component="main"
          sx={{ flex: 1, display: "flex", flexDirection: "column" }}
        >
          {/* Header */}
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
                backgroundImage: `url(${headerImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                {isMobile && (
                  <IconButton onClick={() => setMobileOpen(true)}>
                    <MenuIcon />
                  </IconButton>
                )}
                <Typography
                  variant="mainHeading"
                  sx={{
                    color: "var(--color-white)",
                  }}
                >
                  Members Directory
                </Typography>
              </Box>
              <TextField
                size="small"
                placeholder="Search by Name"
                value={pendingSearchText}
                onChange={(e) => setPendingSearchText(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      {pendingSearchText && (
                        <IconButton
                          onClick={() => {
                            setPendingSearchText("");
                            setSearchText("");
                            setCurrentPage(1);
                          }}
                          size="small"
                        >
                          <ClearIcon />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSearchText(pendingSearchText);
                          setCurrentPage(1);
                        }}
                      >
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
            </Toolbar>
          </AppBar>

          <Box sx={{ display: "flex", p: 2 }}>
            {/* Sidebar */}
            {isMobile ? (
              <Drawer
                variant="temporary"
                open={mobileOpen}
                onClose={() => setMobileOpen(false)}
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

            {/* Table */}
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
                Members in Category{" "}
                {!loading && (
                  <Typography
                    variant="cardLabel"
                    color="text.secondary"
                    component="span"
                  >
                    ({sortedMembers.length})
                  </Typography>
                )}
              </Typography>
              {loading ? (
                <Loader />
              ) : error ? (
                <ErrorMessage error={error} />
              ) : (
                <>
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
                    ref={memTableContainerRef}
                  >
                    <Table stickyHeader aria-label="members table">
                      <TableHead sx={{ borderBottom: "2px solid #007bff" }}>
                        <TableRow>
                          <TableHeaderWithSort
                            label={
                              <Typography variant="tableLabel">
                                Member Name
                              </Typography>
                            }
                            sortBy={sortBy}
                            sortField="name"
                            sortOrder={sortOrder}
                            setSortBy={setSortBy}
                            setSortOrder={setSortOrder}
                            width="25%"
                          />
                          <TableHeaderWithSort
                            label={
                              <Typography variant="tableLabel">
                                Organization
                              </Typography>
                            }
                            sortBy={sortBy}
                            sortField="organization"
                            sortOrder={sortOrder}
                            setSortBy={setSortBy}
                            setSortOrder={setSortOrder}
                            width="25%"
                          />
                          <TableCell sx={{ width: "25%", fontWeight: 600 }}>
                            <Typography variant="tableLabel">Type</Typography>
                          </TableCell>
                          <TableCell sx={{ width: "25%", fontWeight: 600 }}>
                            <Typography variant="tableLabel">
                              Ranking
                            </Typography>
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {currentMembers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} align="center">
                              <Typography variant="noticeText">
                                No developers match the current filters.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          currentMembers.map((m) => (
                            <TableRow
                              key={m.id}
                              hover
                              sx={{ cursor: "pointer" }}
                              onClick={() => navigate(`/member/${m.userId}`)}
                            >
                              <TableCell>
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                  }}
                                >
                                  <Typography variant="tableValue">
                                    {m.name || "N/A"}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Typography variant="tableValue">
                                  {m.organization || "N/A"}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={
                                    <Typography variant="tableValue">
                                      {m.type || "N/A"}
                                    </Typography>
                                  }
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={
                                    <Typography variant="tableValue">
                                      {m.ranking || "N/A"}
                                    </Typography>
                                  }
                                  size="small"
                                  sx={{
                                    minWidth: 30,
                                    textAlign: "center",
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <PaginationBar
                    totalPages={totalPages}
                    currentPage={currentPage}
                    onPageChange={(e, page) => setCurrentPage(page)}
                    loading={loading}
                  />
                </>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
}

export default MembersDashboard;
