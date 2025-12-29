import React from "react";
import { Box, Pagination } from "@mui/material";

const PaginationBar = ({
  totalPages,
  currentPage,
  onPageChange,
  loading,
}) => (
  !loading && totalPages > 1 && (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", mt: 2 }}>
      <Pagination
        count={totalPages}
        page={currentPage}
        onChange={onPageChange}
        color="primary"
        showFirstButton
        showLastButton
      />
    </Box>
  )
);

export default PaginationBar;