// CardList.jsx
import React from "react";
import { Grid } from "@mui/material";

const CardList = ({ items, renderCard }) => (
  <Grid container spacing={2}>
    {items.map((item, idx) => (
      <Grid item sx={{width:"100%"}} key={item.id || item.name || idx}>
        {renderCard(item)}
      </Grid>
    ))}
  </Grid>
);

export default CardList;
