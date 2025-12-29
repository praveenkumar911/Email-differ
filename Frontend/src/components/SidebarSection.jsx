// SidebarSection.jsx
import React from "react";
import { Box, Typography, IconButton, Collapse, Divider } from "@mui/material";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";

const SidebarSection = ({
  title,
  open,
  toggleOpen,
  children,
  divider = true
}) => (
  <>
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Typography variant="h6">{title}</Typography>
      <IconButton size="small" onClick={toggleOpen}>
        {open ? <ExpandLess /> : <ExpandMore />}
      </IconButton>
    </Box>
    <Collapse in={open}>
      {children}
    </Collapse>
    {divider && <Divider sx={{ my: 1 }} />}
  </>
);

export default SidebarSection;
