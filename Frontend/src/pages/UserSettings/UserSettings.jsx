import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Chip,
  Divider,
  Avatar,
  Dialog,
  DialogTitle,
  DialogActions,
  Button,
  Snackbar,
  Alert,
} from "@mui/material";

import PersonIcon from "@mui/icons-material/Person";
import NotificationsIcon from "@mui/icons-material/Notifications";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";

import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import StyledField from "../../components/StyledField";

const BASE_API = process.env.REACT_APP_BASE_API;
const API_BASE = `${BASE_API}/api/users/contributors`;
const PUT_API_Base = `${BASE_API}/api/users/edit/profile`;

const UserSettings = () => {
  const [userData, setUserData] = useState(null);
  const [formData, setFormData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const navigate = useNavigate();
  const { setUser } = useAuth();

  const authData = JSON.parse(localStorage.getItem("authData") || "{}");
  const userId = authData?.userId;
  const token = authData?.token;

  // Fetch user data
  useEffect(() => {
    if (!userId) {
      console.error("No userId found");
      setLoading(false);
      return;
    }

    const fetchUser = async () => {
      try {
        const response = await fetch(`${API_BASE}/${userId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) throw new Error("Failed to fetch user data");

        const data = await response.json();

        const contributor =
          data?.contributor || data?.data || data?.result || data?.user || data;

        const org = data.organization;

        if (contributor.userId !== userId && contributor.id !== userId) {
          setSnackbar({
            open: true,
            message: "Unauthorized",
            severity: "error",
          });
          setLoading(false);
          return;
        }

        const finalData = {
          ...contributor,
          organizationName: org?.name,
          organizationId: contributor.organization,
          profilePhoto: contributor.profile,
        };

        setUserData(finalData);
        setFormData(finalData);
      } catch (err) {
        console.error("Fetch error:", err);
        setSnackbar({
          open: true,
          message: err.message || "Failed to load profile",
          severity: "error",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId, token]);

  if (loading) return <Typography>Loading...</Typography>;
  if (!formData) return <Typography>Error loading profile.</Typography>;

  const handleEdit = () => setIsEditing(true);

  const handleSave = async () => {
    if (!formData || !userId) return;

    const hasChanges =
      JSON.stringify({
        name: userData.name,
        primaryEmail: userData.primaryEmail,
        organization: userData.organizationId,
        discordId: userData.discordId,
        githubUrl: userData.githubUrl,
      }) !==
      JSON.stringify({
        name: formData.name,
        primaryEmail: formData.primaryEmail,
        organization: formData.organizationId,
        discordId: formData.discordId,
        githubUrl: formData.githubUrl,
      });

    if (!hasChanges) {
      setIsEditing(false);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        userId,
        name: formData.name?.trim(),
        primaryEmail: formData.primaryEmail?.trim(),
        organization: formData.organizationId, // always send ID
        githubUrl: formData.githubUrl?.trim() || null,
        discordId: formData.discordId?.trim() || null,
      };

      const response = await fetch(`${PUT_API_Base}/${userId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to save changes");
      }

      const updatedData = await response.json();

      const updatedContributor =
        updatedData?.contributor ||
        updatedData?.data ||
        updatedData?.user ||
        updatedData;

      // preserve org name (backend does not return org.name on save)
      const finalData = {
        ...updatedContributor,
        organizationName: userData.organizationName,
        organizationId: updatedContributor.organization,
        profilePhoto: updatedContributor.profile,
      };

      setUserData(finalData);
      setFormData(finalData);

      setSnackbar({
        open: true,
        message: "Profile updated successfully!",
        severity: "success",
      });

      setIsEditing(false);

      const newAuthData = { ...authData, name: updatedContributor.name };
      localStorage.setItem("authData", JSON.stringify(newAuthData));
    } catch (err) {
      console.error("Save error:", err);
      setSnackbar({
        open: true,
        message: err.message || "Could not save changes",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setFormData(userData);
    setIsEditing(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const confirmLogout = () => {
    localStorage.clear();
    setUser(null);
    navigate("/projects");
  };

  const handleCloseSnackbar = () =>
    setSnackbar((prev) => ({ ...prev, open: false }));

  const tabs = [
    { key: "profile", label: "Public Profile", icon: <PersonIcon /> },
    {
      key: "notifications",
      label: "Notifications",
      icon: <NotificationsIcon />,
    },
    { key: "legals", label: "Legals", icon: <AccountBalanceIcon /> },
  ];

  return (
    <>
      <title>User Settings - Badal</title>
      <Box sx={{ p: 3, width: "100%" }}>
        <Typography variant="h6">{formData.name}</Typography>

        <Box
          sx={{
            border: "1px solid #000",
            borderRadius: 2,
            boxShadow: "3px 3px 0 #000",
            mt: 2,
            width: "100%",
          }}
        >
          <Box
            sx={{
              display: "flex",
              gap: 3,
              p: 3,
              flexWrap: "wrap",
              justifyContent: "space-between",
              flexDirection: { xs: "column-reverse", md: "row" },
            }}
          >
            {/* LEFT SIDEBAR */}
            <Box
              sx={{
                width: { xs: "100%", md: "20%" },
                height: "fit-content",
                border: "2px solid #000",
                borderRadius: "12px",
                boxShadow: "3px 3px 0 #000",
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                py: 2,
                px: 2,
              }}
            >
              {tabs.map((tab) => (
                <Box
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  sx={{
                    display: "flex",
                    gap: 1.5,
                    alignItems: "center",
                    p: 1.5,
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    bgcolor:
                      activeTab === tab.key
                        ? "var(--color-primary-gold)"
                        : "transparent",
                    color: activeTab === tab.key ? "#ffffffff" : "inherit",
                    fontWeight: activeTab === tab.key ? "bold" : "normal",
                  }}
                >
                  {tab.icon}
                  <Typography variant="body2">{tab.label}</Typography>
                </Box>
              ))}
            </Box>

            {/* MAIN MIDDLE CONTENT */}
            <Box
              sx={{
                width: { xs: "100%", md: "50%" },
                border: "1px solid #ddd",
                borderRadius: 2,
                p: 4,
                minHeight: 500,
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              {activeTab === "profile" && (
                <>
                  <StyledField
                    name="name"
                    label="Name"
                    value={formData.name || ""}
                    onChange={handleChange}
                    isEditing={isEditing}
                    editable={true}
                  />

                  <StyledField
                    name="primaryEmail"
                    label="Primary Email"
                    value={formData.primaryEmail || ""}
                    onChange={handleChange}
                    isEditing={isEditing}
                    editable={true}
                  />

                  <StyledField
                    name="phoneNumber"
                    label="Phone Number"
                    value={formData.phoneNumber || ""}
                    isEditing={isEditing}
                    editable={false}
                  />

                  <Divider />

                  <Typography variant="subtitle1">Affiliation</Typography>

                  <StyledField
                    name="organizationName"
                    label="Organization"
                    value={formData.organizationName || ""}
                    isEditing={isEditing}
                    editable={false}
                  />

                  <StyledField
                    name="orgType"
                    label="Org Type"
                    value={formData.orgType || ""}
                    isEditing={isEditing}
                    editable={false}
                  />

                  <Divider />

                  <Typography variant="subtitle1">Social</Typography>

                  <StyledField
                    name="githubUrl"
                    label="GitHub URL"
                    value={formData.githubUrl || ""}
                    onChange={handleChange}
                    isEditing={isEditing}
                    editable={true}
                  />

                  <StyledField
                    name="discordId"
                    label="Discord ID"
                    value={formData.discordId || ""}
                    onChange={handleChange}
                    isEditing={isEditing}
                    editable={true}
                  />
                </>
              )}

              {activeTab === "notifications" && (
                <Box sx={{ textAlign: "center", color: "#666", mt: 8 }}>
                  <NotificationsIcon sx={{ fontSize: 80, opacity: 0.3 }} />
                  <Typography variant="h5" sx={{ mt: 2, fontWeight: "bold" }}>
                    Notifications Settings
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 2 }}>
                    Email notifications, project updates, and mentions are
                    managed here.
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 4 }}
                  >
                    (Coming soon – you’ll be able to customize everything!)
                  </Typography>
                </Box>
              )}

              {activeTab === "legals" && (
                <Box sx={{ mt: 4 }}>
                  <Typography variant="h5" gutterBottom>
                    Legal & Compliance
                  </Typography>
                  <Divider sx={{ mb: 3 }} />

                  <Typography variant="subtitle2" gutterBottom>
                    Contributor Agreement
                  </Typography>
                  <Typography variant="body2" paragraph color="text.secondary">
                    By contributing, you agree to our open-source licensing and
                    code of conduct.
                  </Typography>

                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
                    Privacy Policy
                  </Typography>
                  <Typography variant="body2" paragraph color="text.secondary">
                    Your data is used only to manage contributions and
                    communication.
                  </Typography>

                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
                    Terms of Service
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Last updated: November 2025
                  </Typography>
                </Box>
              )}
            </Box>

            {/* RIGHT SIDEBAR */}
            <Box
              sx={{
                width: { xs: "100%", md: "20%" },
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: "100%",
                  height: 200,
                  borderRadius: 2,
                  bgcolor: "#65626228",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Avatar
                  alt="Profile"
                  src={formData.profilePhoto || ""}
                  sx={{ width: 120, height: 120 }}
                />
              </Box>

              {activeTab === "profile" && (
                <>
                  {!isEditing ? (
                    <Chip
                      label="Edit Profile"
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
                </>
              )}

              <Chip
                label="Logout"
                color="error"
                size="small"
                sx={{ mt: 2 }}
                onClick={() => setLogoutDialogOpen(true)}
              />
            </Box>
          </Box>
        </Box>

        <Dialog
          open={logoutDialogOpen}
          onClose={() => setLogoutDialogOpen(false)}
        >
          <DialogTitle>Are you sure you want to logout?</DialogTitle>
          <DialogActions>
            <Button onClick={() => setLogoutDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmLogout} color="error">
              Logout
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity={snackbar.severity}
            variant="filled"
            sx={{
              bgcolor: `${snackbar.severity}.main`,
              color: "white",
            }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </>
  );
};

export default UserSettings;
