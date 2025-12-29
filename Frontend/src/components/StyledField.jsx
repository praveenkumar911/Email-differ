import React from "react";
import { TextField } from "@mui/material";

const StyledField = ({ isEditing, editable = true, sx = {}, ...props }) => {
  const isDisabled = isEditing ? !editable : true;

  return (
    <TextField
      {...props}
      disabled={isDisabled}
      fullWidth
      sx={{
        ...sx,

        // Text color when disabled
        "& .MuiInputBase-input.Mui-disabled": {
          WebkitTextFillColor: !isEditing
            ? "#000"
            : editable
            ? "#000"
            : "rgba(0,0,0,0.38)",
        },

        // Label color when disabled
        "& .MuiInputLabel-root.Mui-disabled": {
          color: !isEditing
            ? "#000" 
            : editable
            ? "#000"
            : "rgba(0,0,0,0.38)",
        },

        // Border color when disabled
        "& .MuiOutlinedInput-root.Mui-disabled .MuiOutlinedInput-notchedOutline": {
          borderColor: !isEditing
            ? "#000"
            : editable
            ? "#000"
            : "rgba(0,0,0,0.23)",
        },
      }}
    />
  );
};

export default StyledField;
