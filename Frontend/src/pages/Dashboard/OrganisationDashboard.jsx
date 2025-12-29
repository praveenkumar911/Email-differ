import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  ListItemButton,
  ListItemText,
  Chip,
  Divider,
  Card,
  CardContent,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Cancel";
import { useTheme } from "@mui/material/styles";
import SidebarSection from "../../components/SidebarSection";
import TableHeaderWithSort from "../../components/TableHeaderWithSort";
import FilterPanel from "../../components/FilterPanel";
import PaginationBar from "../../components/PaginationBar";
import { Loader, ErrorMessage } from "../../components/Loader";
import DetailedCard from "../../components/DetailedCard";
import headerImage from "../../assets/header-background.png";
import CardList from "../../components/CardList";

const BASE_API = process.env.REACT_APP_BASE_API;

// ---- Utility: Normalize Organisation ----
function normalizeOrg(org, idx = 0) {
  return {
    id: org._id || org.org_id || idx,
    orgId: org.org_id || "",
    name: org.orgName || "Untitled Org",
    description: org.description || "No description available",

    // SIMPLE fallback like repo
    domain:
      Array.isArray(org.domain) && org.domain.length > 0
        ? org.domain
        : ["General"],

    createdAt: org.created_at ? new Date(org.created_at).toISOString() : "N/A",
    githubUrl: org.githubUrl || "",
    orgtype: org.orgtype ?? "Unknown",
    techStack: Array.isArray(org.techStack)
      ? org.techStack.map((t) => String(t).trim().toLowerCase())
      : [],
    contact: org.contact || "",
    ranking: org.ranking || 0,
    rating: org.rating || 0,
    source: org.source || "Unknown",
    status: org.projectStatus?.toLowerCase() || "unknown",
    totalProjects: org.totalProjects || 0,
    openCount: org.openCount || 0,
    closedCount: org.closedCount || 0,
  };
}



function OrganisationDashboard() {
  // ---- Dashboard State ----
  const [orgs, setOrgs] = useState([]);
  const [techSkills, setTechSkills] = useState({});
  const [searchText, setSearchText] = useState("");
  const [isDetailedView, setIsDetailedView] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedTechs, setSelectedTechs] = useState([]);
  const [selectedOrgType, setSelectedOrgType] = useState("");
  const [showOpenOnly, setShowOpenOnly] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sidebar expands/collapses
  const [openSource, setOpenSource] = useState(true);
  const [openDomain, setOpenDomain] = useState(false);
  const [openTechs, setOpenTechs] = useState(false);
  const [openOrgType, setOpenOrgType] = useState(false);
  const [openFilters, setOpenFilters] = useState(false);

  const orgsPerPage = 10;
  const drawerWidth = 280;
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
  }, [
    currentPage,
    selectedSource,
    selectedDomain,
    selectedOrgType,
    selectedTechs,
    showOpenOnly,
    sortBy,
    sortOrder,
    searchText,
    isDetailedView,
  ]);

  // ---- Fetch Data ----
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${BASE_API}/api/orgs/all`)
      .then((res) => res.json())
      .then((json) => {
        const rawOrgs = Array.isArray(json.orgs) ? json.orgs : [];
        setTechSkills(json.techSkills || {});
        setOrgs(rawOrgs.map((o, idx) => normalizeOrg(o, idx)));
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setOrgs([]);
        setLoading(false);
      });
  }, []);

  // ---- Combination/Linked Filters Logic ----
  const orgsForSidebar = useMemo(
    () =>
      !selectedSource
        ? orgs
        : orgs.filter(
            (o) =>
              String(o.source || "")
                .trim()
                .toLowerCase() ===
              String(selectedSource || "")
                .trim()
                .toLowerCase()
          ),
    [orgs, selectedSource]
  );

  const sidebarDomains = useMemo(
    () =>
      Array.from(
        new Set(orgsForSidebar.flatMap((o) => o.domain).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [orgsForSidebar]
  );

  const sidebarTechs = useMemo(() => {
    const all = orgsForSidebar
      .flatMap((o) => o.techStack || [])
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean);
    return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b));
  }, [orgsForSidebar]);

  useEffect(() => {
    if (selectedDomain && !sidebarDomains.includes(selectedDomain)) {
      setSelectedDomain("");
    }
    setSelectedTechs((techs) => techs.filter((t) => sidebarTechs.includes(t)));

    const availableOrgTypes = Array.from(
      new Set(
        orgsForSidebar.map((o) => (o.orgtype || "Unknown").toString().trim())
      )
    );
    if (selectedOrgType && !availableOrgTypes.includes(selectedOrgType)) {
      setSelectedOrgType("");
    }
  }, [
    selectedSource,
    orgsForSidebar,
    sidebarDomains,
    sidebarTechs,
    selectedOrgType,
  ]);

  const sourceList = useMemo(() => {
    const map = {};
    orgs.forEach((o) => {
      const src = o.source || "Unknown";
      map[src] = (map[src] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orgs]);

  const orgTypeList = useMemo(() => {
    const map = {};
    orgsForSidebar.forEach((o) => {
      const type = (o.orgtype || "Unknown").toString().trim();
      map[type] = (map[type] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orgsForSidebar]);

  // ---- Filtering Logic ----
  const filteredOrgs = useMemo(
    () =>
      orgs.filter((org) => {
        const matchesSearch = org.name
          .toLowerCase()
          .includes(searchText.toLowerCase());

        const matchesDomain =
          !selectedDomain || org.domain.includes(selectedDomain);

        const matchesSource = !selectedSource || org.source === selectedSource;

        const matchesOrgType =
          !selectedOrgType || org.orgtype === selectedOrgType;

        const matchesTech =
          selectedTechs.length === 0 ||
          selectedTechs.every((tech) =>
            org.techStack.includes(tech.toLowerCase())
          );

        // 🔥 NEW RULE: Open org = openCount > 0
        const matchesOpen = !showOpenOnly || org.openCount > 0;

        return (
          matchesSearch &&
          matchesDomain &&
          matchesSource &&
          matchesOrgType &&
          matchesTech &&
          matchesOpen
        );
      }),
    [
      orgs,
      searchText,
      selectedDomain,
      selectedSource,
      selectedOrgType,
      selectedTechs,
      showOpenOnly,
    ]
  );

  // ---- Sorting Logic ----
  const sortedOrgs = useMemo(() => {
    const orgsCopy = [...filteredOrgs];
    orgsCopy.sort((a, b) => {
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
        const domA = (a.domain?.[0] || "").toLowerCase();
        const domB = (b.domain?.[0] || "").toLowerCase();

        return sortOrder === "asc"
          ? domA.localeCompare(domB)
          : domB.localeCompare(domA);
      }
      return 0;
    });
    return orgsCopy;
  }, [filteredOrgs, sortBy, sortOrder]);

  // ---- Pagination ----
  const indexOfLast = currentPage * orgsPerPage;
  const indexOfFirst = indexOfLast - orgsPerPage;
  const currentOrgs = sortedOrgs.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(sortedOrgs.length / orgsPerPage);

  // ---- Sidebar Content ----
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
            <Typography variant="sideSectionTitle">Browse By Source</Typography>
          }
          open={openSource}
          toggleOpen={() => setOpenSource(!openSource)}
        >
          {sourceList.map((src) => (
            <ListItemButton
              key={src.name}
              selected={selectedSource === src.name}
              onClick={() => {
                setSelectedSource(src.name);
                setSelectedDomain("");
                setSelectedTechs([]);
                setCurrentPage(1);
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
                    {src.name} ({src.count})
                  </Typography>
                }
              />
            </ListItemButton>
          ))}
          {selectedSource && (
            <ListItemButton
              onClick={() => {
                setSelectedSource("");
                setSelectedDomain("");
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
        </SidebarSection>

        <SidebarSection
          title={<Typography variant="sideSectionTitle">Domains</Typography>}
          open={openDomain}
          toggleOpen={() => setOpenDomain(!openDomain)}
        >
          {sidebarDomains.map((domain) => (
            <ListItemButton
              key={domain}
              selected={selectedDomain === domain}
              onClick={() => {
                setSelectedDomain(domain);
                setCurrentPage(1);
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
                  <Typography variant="filterLabel">{domain}</Typography>
                }
              />
              <Chip
                label={`${
                  orgsForSidebar.filter((o) => o.domain.includes(domain)).length
                } orgs`}
                size="small"
                sx={{
                  ml: 1,
                  minWidth: 32,
                  backgroundColor:
                    selectedDomain === domain ? "white" : "rgba(0,0,0,0.1)",
                  color: selectedDomain === domain ? "primary.main" : "inherit",
                }}
              />
            </ListItemButton>
          ))}
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
        </SidebarSection>

        <SidebarSection
          title={<Typography variant="sideSectionTitle">Org Type</Typography>}
          open={openOrgType}
          toggleOpen={() => setOpenOrgType(!openOrgType)}
        >
          <Box>
            {orgTypeList.map((type) => (
              <ListItemButton
                key={type.name}
                selected={selectedOrgType === type.name}
                onClick={() => {
                  setSelectedOrgType(type.name);
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
                  color={
                    selectedOrgType === type.name ? "secondary" : "default"
                  }
                  sx={{
                    backgroundColor:
                      selectedOrgType === type.name
                        ? "white"
                        : "rgba(0, 0, 0, 0.1)",
                    color:
                      selectedOrgType === type.name
                        ? "primary.main"
                        : "inherit",
                    minWidth: 32,
                  }}
                />
              </ListItemButton>
            ))}
            {selectedOrgType && (
              <ListItemButton onClick={() => setSelectedOrgType("")}>
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
                  <Typography variant="filterLabel">Show Open Orgs</Typography>
                ),
                checked: showOpenOnly,
                name: "open",
              },
            ]}
            onSwitchChange={(name, checked) => setShowOpenOnly(checked)}
          />
        </SidebarSection>

        <SidebarSection
          title={<Typography variant="sideSectionTitle">Tech Stack</Typography>}
          open={openTechs}
          toggleOpen={() => setOpenTechs(!openTechs)}
        >
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
        </SidebarSection>
      </Box>
    </Box>
  );

  const ellipsize = (text, max = 15) => {
    if (!text) return "";
    return text.length > max ? text.substring(0, max) + "..." : text;
  };

  // ---- Main Render ----
  return (
    <>
      <title>Organisation Directory</title>
      <Box sx={{ display: "flex", flex: 1 }}>
        <Box
          component="main"
          sx={{ flex: 1, display: "flex", flexDirection: "column" }}
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
                backgroundImage: `url(${headerImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                {isMobile && (
                  <IconButton
                    sx={{ color: "var(--color-white)" }}
                    onClick={() => setMobileOpen(true)}
                  >
                    <MenuIcon />
                  </IconButton>
                )}
                <Typography
                  variant="mainHeading"
                  sx={{ color: "var(--color-white)" }}
                >
                  Organisation Directory
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <TextField
                  size="small"
                  placeholder="Search by Org's Name"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        {searchText && (
                          <IconButton
                            onClick={() => setSearchText("")}
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
                  onSwitchChange={(name, value) => setIsDetailedView(value)}
                />
              </Box>
            </Toolbar>
          </AppBar>

          <Box sx={{ display: "flex", p: 2 }}>
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
                Organisations in Category
                <Typography
                  variant="cardLabel"
                  color="text.secondary"
                  component="span"
                >
                  ({sortedOrgs.length})
                </Typography>
              </Typography>

              {loading && <Loader />}
              {error && <ErrorMessage error={error} />}

              {/* Table View */}
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
                  <Table stickyHeader aria-label="organisation table">
                    <TableHead>
                      <TableRow>
                        <TableHeaderWithSort
                          label={
                            <Typography variant="tableLabel">
                              Organisation Name
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
                              Created At
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
                      {currentOrgs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} align="center">
                            <Typography variant="noticeText">
                              No Organisations match the current filters.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        currentOrgs.map((org) => (
                          <TableRow
                            key={org.id}
                            hover
                            sx={{ cursor: "pointer" }}
                            onClick={() =>
                              navigate(`/organisation/${org.orgId}`)
                            }
                          >
                            <TableCell>
                              <Typography variant="tableValue">
                                {org.name}
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
                                {org.description}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: "flex", flexWrap: "wrap" }}>
                                {org.domain[0] && (
                                  <Chip
                                    label={ellipsize(org.domain[0], 15)}
                                    size="small"
                                    sx={{ mr: 0.5 }}
                                  />
                                )}

                                {org.domain.length === 2 && (
                                  <Chip
                                    label={ellipsize(org.domain[1], 15)}
                                    size="small"
                                    sx={{ mr: 0.5 }}
                                  />
                                )}

                                {org.domain.length > 2 && (
                                  <Chip
                                    label={`+${org.domain.length - 1} more`}
                                    size="small"
                                    sx={{ mr: 0.5 }}
                                  />
                                )}
                              </Box>
                            </TableCell>

                            <TableCell>
                              <Typography variant="tableValue">
                                {org.createdAt
                                  ? new Date(org.createdAt).toLocaleDateString()
                                  : "-"}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Detailed Card View */}
              {!loading &&
                !error &&
                isDetailedView &&
                (currentOrgs.length === 0 ? (
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
                      No Organisations match the current filters.
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
                      data={currentOrgs}
                      renderConfig={(org) => ({
                        key: org.id,
                        iconName: null,
                        title: org.name,
                        secondaryLabel: "Creation Date:",
                        secondaryValue: org.createdAt
                          ? new Date(org.createdAt).toLocaleDateString()
                          : "-",
                        description: org.description,
                        items: [
                          { label: "Domain:", value: org.domain, type: "chip" },
                          {
                            label: "Org Type:",
                            value: org.orgtype,
                            type: "chip",
                          },
                          { label: "Tech Need:", value: org.techStack, type: "chip" },
                          { label: "Open Tasks:", value: org.openCount },
                        ],
                        onClick: () => navigate(`/organisation/${org.orgId}`),
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
                onPageChange={(e, page) => setCurrentPage(page)}
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
}

export default OrganisationDashboard;
