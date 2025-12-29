// src/theme.js
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  typography: {
    fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif',

    mainHeading: {
      fontSize: "var(--font-size-main-heading)",
      fontWeight: "var(--font-weight-hvy)",
      color: "var(--color-text-white)",
    },
    sectionTitle: {
      fontSize: "var(--font-size-section-title)",
      fontWeight: "var(--font-weight-bold)",
      color: "var(--color-text-dark-gray)",
      letterSpacing: "var(--ls-wide)",
    },
    cardTitle: {
      fontSize: "var(--font-size-card-title)",
      fontWeight: "var(--font-weight-bold)",
      color: "var(--color-text-black)",
      textTransform: "capitalize",
    },
    cardLabel: {
      fontSize: "var(--font-size-card-label)",
      fontWeight: "var(--font-weight-bold)",
      color: "var(--color-text-dark-gray)",
    },
    cardValue: {
      fontSize: "var(--font-size-card-value)",
      fontWeight: "var(--font-weight-regular)",
      color: "var(--color-text-black)",
    },
    sideSectionTitle: {
      fontSize: "var(--font-size-side-section-title)",
      fontWeight: "var(--font-weight-medium)",
      color: "var(--color-text-very-dark-gray)",
    },
    tableTitle: {
      fontSize: "var(--font-size-table-title)",
      fontWeight: "var(--font-weight-bold)",
      color: "var(--color-text-black)",
      textTransform: "capitalize",
    },
    tableLabel: {
      fontSize: "var(--font-size-table-label)",
      fontWeight: "var(--font-weight-bold)",
      color: "var(--color-text-black)",
    },
    tableValue: {
      fontSize: "var(--font-size-table-value)",
      fontWeight: "var(--font-weight-regular)",
      color: "var(--mui-text-primary)",
    },
    //for tabs
    tabLabel: {
      fontSize: "var(--font-size-table-label)",
      fontWeight: "var(--font-weight-bold)",
      color: "var(--color-white)",
    },

    filterLabel: {
      fontSize: "var(--font-size-filter-label)",
      fontWeight: "var(--font-weight-medium)",
      color: "var(--mui-text-secondary)",
    },
    noticeText: {
      fontSize: "var(--font-size-notice)",
      fontWeight: "var(--font-weight-light)",
      color: "var(--mui-text-secondary)",
    },
  },
  components: {
    MuiListItemText: {
      styleOverrides: {
        primary: {
          fontSize: "0.8rem",
        },
        secondary: {
          fontSize: "0.8rem",
        },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: {
        label: {
          fontSize: "0.8rem",
        },
      },
    },
  },
});

export default theme;
