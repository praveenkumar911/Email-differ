// Loader.jsx
import { CircularProgress, Box } from "@mui/material";
// ErrorMessage.jsx
import { Typography } from "@mui/material";


const Loader = () => (
  <Box sx={{ textAlign: "center", my: 4 }}>
    <CircularProgress />
  </Box>
);


const ErrorMessage = ({ error }) => (
  <Box sx={{ textAlign: "center", my: 4 }}>
    <Typography color="error">{error}</Typography>
  </Box>
);

export { Loader, ErrorMessage };
