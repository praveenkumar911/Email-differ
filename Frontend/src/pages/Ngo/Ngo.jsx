import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Typography,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  InputAdornment,
  Button,
  AppBar,
  Toolbar,
  useTheme,
  useMediaQuery,
} from "@mui/material";

import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import Swal from "sweetalert2";
import axios from "axios";

import headerImage from "../../assets/header-background.png";
import defaultNgoImage from "../../assets/ngo_image.webp";

const BASE_API = process.env.REACT_APP_BASE_API;

const Ngo = () => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [ngoData, setNgoData] = useState([]);

  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [form, setForm] = useState({
    projectName: "",
    ngoName: "",
    domain: "",
    problemStatement: "",
    imageUrl: "",
    contactName: "",
    phone: "",
    email: "",
    officeAddress: "",
  });

  const [errors, setErrors] = useState({});

  const isFormValid = () => {
    return (
      form.projectName &&
      form.ngoName &&
      form.domain &&
      form.problemStatement &&
      form.contactName &&
      form.phone &&
      form.email
    );
  };

  // ✅ FETCH NGOS (use trailing slash to avoid redirect)
  const fetchNGOs = async () => {
    try {
      const res = await axios.get(`${BASE_API}/api/ngos/`);
      setNgoData(res.data);
    } catch (err) {
      Swal.fire("Error", "Failed to load NGOs", "error");
    }
  };

  useEffect(() => {
    fetchNGOs();
  }, []);

  // ✅ SHOW ONLY VERIFIED NGOS
  const filteredNgoData = ngoData
    .filter((ngo) => ngo.verified === true) // FIXED ✔
    .filter((ngo) => {
      const s = searchTerm.toLowerCase();
      return (
        ngo.projectName?.toLowerCase().includes(s) ||
        ngo.ngoName?.toLowerCase().includes(s) ||
        ngo.domain?.toLowerCase().includes(s)
      );
    });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });

    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: false });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!form.projectName.trim()) newErrors.projectName = true;
    if (!form.ngoName.trim()) newErrors.ngoName = true;
    if (!form.domain.trim()) newErrors.domain = true;
    if (!form.problemStatement.trim()) newErrors.problemStatement = true;
    if (!form.contactName.trim()) newErrors.contactName = true;
    if (!form.phone.trim()) newErrors.phone = true;
    if (!form.email.trim()) newErrors.email = true;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // SUBMIT FORM
  const handleSubmit = async () => {
    if (!validateForm()) {
      Swal.fire("Missing Fields", "Please fill all required fields", "warning");
      return;
    }

    const payload = {
      ngo_id: "NGO" + Date.now(),
      ngoName: form.ngoName,
      ngoLogo: form.imageUrl,
      domain: form.domain,
      description: form.problemStatement,
      projectName: form.projectName,
      contact: form.phone,
      contactPerson: form.contactName,
      email: form.email,
      officeAddress: form.officeAddress,
      created_at: new Date().toISOString(),

      // 🔥 FIXED — Backend expects "verified"
      verified: false,
    };

    try {
      await axios.post(`${BASE_API}/api/ngos/`, payload); // FIXED ✔

      Swal.fire("Success!", "Your NGO project has been submitted!", "success");

      fetchNGOs();
      setOpen(false);

      setForm({
        projectName: "",
        ngoName: "",
        domain: "",
        problemStatement: "",
        imageUrl: "",
        contactName: "",
        phone: "",
        email: "",
        officeAddress: "",
      });

      setErrors({});
    } catch (err) {
      Swal.fire("Error", "Failed to submit project", "error");
    }
  };

  return (
    <Box sx={{ width: "100%", minHeight: "100vh", background: "#f5f7fa" }}>
      {/* HEADER */}
      <AppBar
        position="static"
        sx={{
          height: 80,
          backgroundImage: `url(${headerImage})`,
          backgroundSize: "cover",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Toolbar sx={{ px: 3, justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h4" sx={{ color: "white", fontWeight: 800 }}>
            NGOs
          </Typography>

          <Box sx={{ width: { xs: "100%", sm: 360, md: 400 } }}>
            <TextField
              placeholder="Search NGOs or Projects"
              size="small"
              fullWidth
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ bgcolor: "white", borderRadius: 3 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Toolbar>
      </AppBar>

      {/* HERO */}
      <Box sx={{ maxWidth: "1600px", mx: "auto", px: 4, py: 8 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems="center"
          justifyContent="space-between"
          spacing={4}
          sx={{
            background: "linear-gradient(135deg, #ffe0f0 0%, #ffd6eb 100%)",
            p: 6,
            borderRadius: 4,
            border: "1px solid #ffb3d9",
            boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
          }}
        >
          <Box sx={{ maxWidth: "65%" }}>
            <Typography variant="h4" sx={{ fontWeight: 800, color: "#b30059", mb: 2 }}>
              Got an NGO Project or a Real-World Problem?
            </Typography>

            <Typography sx={{ fontSize: "1.2rem", color: "#333" }}>
              Submit your project and get support from our team.
            </Typography>
          </Box>

          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon sx={{ fontSize: 34 }} />}
            onClick={() => setOpen(true)}
            sx={{
              bgcolor: "#ff4da6",
              px: 7,
              py: 3,
              fontSize: "1.2rem",
              borderRadius: 3,
              "&:hover": { bgcolor: "#cc007a" },
            }}
          >
            Submit Your Project Now
          </Button>
        </Stack>
      </Box>

      {/* NGO CARDS */}
      <Box sx={{ maxWidth: "1600px", mx: "auto", px: 3, pb: 10 }}>
        <Grid container spacing={4} justifyContent="center">
          {filteredNgoData.map((ngo, index) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
              <Card
                sx={{
                  maxWidth: 360,
                  mx: "auto",
                  borderRadius: "18px",
                  border: "3px solid #000",
                  boxShadow: "8px 8px rgba(0,0,0,0.25)",
                  transition: "0.2s",
                  "&:hover": { transform: "translateY(-5px)" },
                  height: "100%",
                }}
              >
                <CardMedia
                  component="img"
                  image={ngo.ngoLogo || defaultNgoImage}
                  alt={ngo.projectName}
                  sx={{ height: 180, borderRadius: "15px 15px 0 0", objectFit: "cover" }}
                />

                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                    {ngo.projectName}
                  </Typography>

                  <Typography sx={{ fontSize: "0.95rem", color: "#444", mb: 3 }}>
                    {ngo.description}
                  </Typography>

                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography sx={{ fontWeight: 600 }}>{ngo.ngoName}</Typography>

                    <Typography
                      sx={{
                        bgcolor: "#e3f2fd",
                        px: 2,
                        py: "4px",
                        borderRadius: 2,
                        fontWeight: 600,
                        color: "#1565c0",
                      }}
                    >
                      {ngo.domain}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* FORM DIALOG */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>Add New NGO Project</DialogTitle>

        <DialogContent dividers>
          <Stack spacing={3} sx={{ py: 2 }}>
            <TextField
              label="Project Name *"
              name="projectName"
              fullWidth
              value={form.projectName}
              onChange={handleChange}
              error={errors.projectName}
              helperText={errors.projectName && "Required"}
            />

            <TextField
              label="NGO Name *"
              name="ngoName"
              fullWidth
              value={form.ngoName}
              onChange={handleChange}
              error={errors.ngoName}
              helperText={errors.ngoName && "Required"}
            />

            <TextField
              label="Domain *"
              name="domain"
              fullWidth
              value={form.domain}
              onChange={handleChange}
              error={errors.domain}
              helperText={errors.domain && "Required"}
            />

            <TextField
              label="Describe the problem scenario *"
              name="problemStatement"
              fullWidth
              multiline
              rows={5}
              value={form.problemStatement}
              onChange={handleChange}
              error={errors.problemStatement}
              helperText={errors.problemStatement && "Required"}
            />

            {/* Contact Info */}
            <Typography sx={{ fontWeight: 700 }}>Contact Information *</Typography>

            <TextField
              label="Contact Person Name *"
              name="contactName"
              fullWidth
              value={form.contactName}
              onChange={handleChange}
              error={errors.contactName}
              helperText={errors.contactName && "Required"}
            />

            <TextField
              label="Phone Number *"
              name="phone"
              fullWidth
              value={form.phone}
              onChange={handleChange}
              error={errors.phone}
              helperText={errors.phone && "Required"}
            />

            <TextField
              label="Email Address *"
              name="email"
              fullWidth
              value={form.email}
              onChange={handleChange}
              error={errors.email}
              helperText={errors.email && "Required"}
            />

            <TextField
              label="Office Address (Optional)"
              name="officeAddress"
              fullWidth
              multiline
              rows={2}
              value={form.officeAddress}
              onChange={handleChange}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>

          <Button
            variant="contained"
            size="large"
            onClick={handleSubmit}
            disabled={!isFormValid()}
            sx={{
              bgcolor: !isFormValid() ? "#ccc" : "#1565c0",
              color: "white",
              "&:hover": { bgcolor: !isFormValid() ? "#ccc" : "#0d47a1" },
            }}
          >
            Submit Project
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Ngo;
