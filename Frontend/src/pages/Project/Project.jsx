import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import programsData from "../../Data/projects_with_programs.json";
import {
  Box,
  Typography,
  Button,
  Grid,
  Switch,
  FormControlLabel,
  Checkbox,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Chip,
  Pagination,
  IconButton,
  TextField,
} from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";
import orgimg from "../../assets/badal_logo.png";

function Project() {
  const { programName, projectName } = useParams();
  const navigate = useNavigate();

  // Find the program
  const program = programsData.Programs.find(
    (p) => p.ProgramName === programName
  );
  // Find the project within the program
  const project =
    program &&
    program.Projects.find((proj) => proj.ProjectName === projectName);

  const [showOpenOnly, setShowOpenOnly] = useState(false);
  const [selectedTechs, setSelectedTechs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const modulesPerPage = 2;
  const [isEditing, setIsEditing] = useState(false);
  const [tempDescription, setTempDescription] = useState(
    project.shortDescription
  );

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    // Replace this with actual save logic (API call, state update, etc.)
    project.shortDescription = tempDescription;
    setIsEditing(false);
  };

  const handleDiscard = () => {
    setTempDescription(project.shortDescription);
    setIsEditing(false);
  };

  if (!project) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" color="error">
          Project not found
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate("/projects")}
          sx={{ mt: 2 }}
        >
          Back to Projects
        </Button>
      </Box>
    );
  }

  // Get all unique technologies from all modules
  const getAllProjectTechs = () => {
    const allTechs = project.Modules.flatMap(
      (module) => module.TechStack || []
    );
    return Array.from(new Set(allTechs)).sort((a, b) => a.localeCompare(b));
  };

  const allProjectTechs = getAllProjectTechs();

  // filter modules
  const filteredModules = project.Modules.filter((mod) => {
    const matchesOpen = !showOpenOnly || mod.Status === "opened";
    const matchesTech =
      selectedTechs.length === 0 ||
      selectedTechs.some((tech) =>
        (mod.TechStack || [])
          .map((t) => t.toLowerCase())
          .includes(tech.toLowerCase())
      );
    return matchesOpen && matchesTech;
  });

  // pagination
  const totalPages = Math.ceil(filteredModules.length / modulesPerPage);
  const startIndex = (currentPage - 1) * modulesPerPage;
  const currentModules = filteredModules.slice(
    startIndex,
    startIndex + modulesPerPage
  );

  return (
    <>
    <title>Project - Badal</title>
    <Box sx={{ p: { xs: 2, md: 3 }, width: "100%", boxSizing: "border-box" }}>
      {/* Project Title */}
      <Typography
        variant="h5"
        gutterBottom
        sx={{ fontSize: { xs: "1.2rem", md: "1.5rem" } }}
      >
        {project.ProjectName}
      </Typography>

      <Box
        sx={{
          p: { xs: 1, md: 3 },
          border: "2px solid #000",
          borderRadius: "12px",
          boxShadow: "3px 3px 0 #000",
          width: "100%",
          height: "calc(100vh - 150px)",
          overflowY: "auto",
          "&::-webkit-scrollbar": { display: "none" },
          msOverflowStyle: "none",
          scrollbarWidth: "none",
          boxSizing: "border-box",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 2,
            mb: 3,
            width: "100%",
            height: "50%",
          }}
        >
          {/* Project Info */}
          <Box
            sx={{ mb: 3, flexGrow: 1, boxSizing: "border-box", width: "70%" }}
          >
            {isEditing ? (
              <TextField
                fullWidth
                multiline
                minRows={6}
                label="Description"
                value={tempDescription}
                onChange={(e) => setTempDescription(e.target.value)}
                sx={{
                  height: "200px",
                  "& .MuiInputBase-root": {
                    height: "100%",
                    alignItems: "flex-start", // keeps text at top
                  },
                  "& .MuiInputBase-input": {
                    height: "100% !important",
                    overflow: "auto",
                  },
                }}
              />
            ) : (
              <Typography variant="body1" gutterBottom sx={{ height: "200px" }}>
                <strong>Description:</strong> {project.shortDescription}
              </Typography>
            )}
            <Typography variant="body1">
              <strong>Domain:</strong>{" "}
              <Chip label={project.Domain} variant="outlined" size="small" />
            </Typography>
          </Box>

          {/* Organization Info */}
          <Box
            sx={{
              mb: 3,
              gap: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              boxSizing: "border-box",
              width: "30%",
            }}
          >
            <Box
              sx={{
                height: "200px",
                backgroundColor: "#65626228",
                display: "flex",
                alignItems: "center",
                p: 2,
                width: "100%",
                boxSizing: "border-box",
                borderRadius: 2,
              }}
            >
              <Box
                component="img"
                src={orgimg}
                alt="orgimage"
                sx={{
                  width: 100,
                  height: 100,
                  objectFit: "cover",
                  borderRadius: 2,
                  mr: 2,
                  justifyItems: "center",
                }}
              />
              <Box
                sx={{
                  backgroundColor: "#fff",
                  p: 2,
                  borderRadius: 1,
                  flexGrow: 1,
                  height: "100%",
                }}
              >
                <Typography variant="body2">
                  {"<Organization Description>"}
                </Typography>
              </Box>
            </Box>

            {/* Edit / Save / Discard */}
            <Typography variant="body1">
              {!isEditing ? (
                <Chip
                  label="Edit repository details"
                  size="small"
                  onClick={handleEdit}
                />
              ) : (
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Chip
                    label="Save"
                    color="success"
                    size="small"
                    onClick={handleSave}
                  />
                  <Chip
                    label="Discard"
                    color="error"
                    size="small"
                    onClick={handleDiscard}
                  />
                </Box>
              )}
            </Typography>
          </Box>
        </Box>

        <Grid
          container
          spacing={3}
          sx={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 3fr" },
          }}
        >
          {/* LEFT FILTERS */}
          <Grid
            item
            xs={12}
            md={3}
            sx={{
              p: 2,
              border: "2px solid #000",
              borderRadius: "12px",
              boxShadow: "3px 3px 0 #000",
              height: "fit-content",
            }}
          >
            <Typography variant="h6" gutterBottom>
              Filter Modules
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {/* Show Open Modules */}
            <FormControlLabel
              sx={{
                justifyContent: "space-between",
                width: "100%",
                px: 1,
                m: 0,
              }}
              control={
                <Switch
                  checked={showOpenOnly}
                  onChange={() => setShowOpenOnly(!showOpenOnly)}
                />
              }
              label="Open Tasks"
              labelPlacement="start"
            />

            {/* Tech Stack Filter */}
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Filter by Tech Stack
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {allProjectTechs.length > 0 ? (
              allProjectTechs.map((tech, idx) => (
                <FormControlLabel
                  key={idx}
                  control={
                    <Checkbox
                      checked={selectedTechs.includes(tech)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTechs([...selectedTechs, tech]);
                        } else {
                          setSelectedTechs(
                            selectedTechs.filter((t) => t !== tech)
                          );
                        }
                        setCurrentPage(1); // Reset to first page when filter changes
                      }}
                    />
                  }
                  label={tech}
                />
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                No technologies available
              </Typography>
            )}
          </Grid>

          {/* RIGHT MODULES */}
          <Grid item xs={12} md={9} sx={{ flexGrow: 1 }}>
            {/* Cards list */}
            <Box>
              {currentModules.map((mod, idx) => (
                <Box key={idx} sx={{ mb: 2 }}>
                  <Card
                    variant="outlined"
                    sx={{
                      cursor: "pointer",
                      border: "1px solid #000",
                      borderRadius: "12px",
                    }}
                    onClick={() =>
                      window.open(
                        mod.GithubLink ? mod.GithubLink : "https://github.com",
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        p: 2,
                        pb: 0,
                        borderBottom: "2px solid #007bff",
                      }}
                    >
                      <Typography
                        variant="h6"
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <GitHubIcon fontSize="small" />
                        {mod.ModuleName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Creation Date </strong>{" "}
                        {mod.CreationDate
                          ? new Date(mod.CreationDate).toLocaleDateString()
                          : "-"}
                      </Typography>
                    </Box>

                    <CardContent>
                      <Typography variant="body2" gutterBottom>
                        {mod.Description}
                      </Typography>

                      <Box
                        sx={{
                          mt: 1,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 2,
                          flexWrap: "wrap",
                        }}
                      >
                        {/* Complexity */}
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 1,
                          }}
                        >
                          <Typography variant="body2" fontWeight="bold">
                            Complexity:
                          </Typography>
                          <Chip
                            label={
                              mod.Complexity ? mod.Complexity : "Not specified"
                            }
                            size="small"
                          />
                        </Box>

                        {/* Tech Stack */}
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 1,
                          }}
                        >
                          <Typography variant="body2" fontWeight="bold">
                            Tech Need:
                          </Typography>
                          {mod.TechStack && mod.TechStack.length > 0 ? (
                            mod.TechStack.map((tech, i) => (
                              <Chip key={i} label={tech} size="small" />
                            ))
                          ) : (
                            <Chip
                              label="Not specified"
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Box>

                        {/* Status */}
                        <Typography
                          variant="body2"
                          color={
                            mod.Status === "opened"
                              ? "success.main"
                              : "error.main"
                          }
                        >
                          <strong>Status:</strong> {mod.Status}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              ))}

              {filteredModules.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No modules match the current filters.
                </Typography>
              )}
            </Box>

            {/* Pagination */}
            {totalPages > 1 && (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  onChange={(e, page) => setCurrentPage(page)}
                  color="primary"
                />
              </Box>
            )}
          </Grid>
        </Grid>
      </Box>
    </Box>
    </>
  );
}

export default Project;
