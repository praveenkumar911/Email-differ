import React from "react";
import { Box, Divider, Typography } from "@mui/material";

const StatPair = ({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  gap = 3,
}) => {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap,
        width: "100%",   // ensures equal distribution inside parent
      }}
    >
      {/* Left Stat */}
      <Box
        flex={1}
        textAlign="center"
        display="flex"
        flexDirection="column"
        justifyContent="center"
      >
        <Typography variant="cardLabel" color="text.secondary">
          {leftLabel}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: "bold" }}>
          {leftValue ?? "-"}
        </Typography>
      </Box>

      {/* Divider */}
      <Divider orientation="vertical" flexItem />

      {/* Right Stat */}
      <Box
        flex={1}
        textAlign="center"
        display="flex"
        flexDirection="column"
        justifyContent="center"
      >
        <Typography variant="cardLabel" color="text.secondary">
          {rightLabel}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: "bold" }}>
          {rightValue ?? "-"}
        </Typography>
      </Box>
    </Box>
  );
};

export default StatPair;
