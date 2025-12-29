// TableHeaderWithSort.jsx
import React from "react";
import { TableCell } from "@mui/material";
import TableSortLabel from "@mui/material/TableSortLabel";

const TableHeaderWithSort = ({ label, sortBy, sortField, sortOrder, setSortBy, setSortOrder, width }) => (
  <TableCell sx={{ fontWeight: 600, width }}>
    <TableSortLabel
      active={sortBy === sortField}
      direction={sortBy === sortField ? sortOrder : "asc"}
      onClick={() => {
        if (sortBy === sortField) {
          setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
          setSortBy(sortField);
          setSortOrder("asc");
        }
      }}
      hideSortIcon={false}
    >
      {label}
    </TableSortLabel>
  </TableCell>
);

export default TableHeaderWithSort;
