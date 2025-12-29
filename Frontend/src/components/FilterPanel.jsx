// FilterPanel.jsx
import { FormControlLabel, Switch, Checkbox, Box } from "@mui/material";

const FilterPanel = ({
  switchFilters = [],
  checkboxFilters = [],
  onSwitchChange,
  onCheckboxChange,
}) => (
  <Box>
    {switchFilters.map(({ label, checked, name, color, labelColor }, idx) => (
      <FormControlLabel
        key={name || idx}
        control={
          <Switch
            checked={checked}
            onChange={(e) => onSwitchChange(name, e.target.checked)}
            sx={{
              "& .MuiSwitch-switchBase.Mui-checked": {
                color: color || undefined,
              },
              "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                backgroundColor: color || undefined,
              },
            }}
          />
        }
        label={label}
        labelPlacement="start"
        sx={{
          px: 1,
          justifyContent: "space-between",
          display: "flex",
          m: 0,
          "& .MuiFormControlLabel-label": {
            color: labelColor || "inherit",
          },
        }}
      />
    ))}

    {checkboxFilters.map(
      ({ label, checked, name, color, labelColor }, idx) => (
        <FormControlLabel
          key={name || idx}
          control={
            <Checkbox
              checked={checked}
              onChange={(e) => onCheckboxChange(name, e.target.checked)}
              sx={{
                color: color || undefined,
                "&.Mui-checked": {
                  color: color || undefined,
                },
              }}
            />
          }
          label={label}
          sx={{
            px: 1,
            display: "flex",
            "& .MuiFormControlLabel-label": {
              color: labelColor || "inherit",
            },
          }}
        />
      )
    )}
  </Box>
);

export default FilterPanel;
