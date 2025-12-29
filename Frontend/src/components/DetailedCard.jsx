import React from "react";
import { Box, Card, CardContent, Typography, Chip, Icon } from "@mui/material";
import * as MuiIcons from "@mui/icons-material";

// Helper for dynamic MUI icon by name
const getDynamicIcon = (iconName) => {
  if (!iconName) return null;
  const IconComponent = MuiIcons[iconName];
  return IconComponent ? (
    <Icon component={IconComponent} fontSize="small" />
  ) : null;
};

const ellipsize = (text, max = 15) => {
  if (!text) return "";
  return text.length > max ? text.substring(0, max) + "..." : text;
};

const CHIP_STYLE = {
  maxWidth: 100,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const renderValue = (value, type = "auto") => {
  if (type === "chip") {
    const arr = Array.isArray(value) ? value : [value];
    const length = arr.length;

    if (length === 0) return <Typography variant="cardValue">-</Typography>;

    if (length === 1) {
      return (
        <Chip
          label={ellipsize(arr[0], 15)}
          size="small"
          title={arr[0]}
          sx={CHIP_STYLE}
        />
      );
    }

    return (
      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
        <Chip
          label={ellipsize(arr[0], 15)}
          size="small"
          title={arr[0]}
          sx={CHIP_STYLE}
        />
        <Chip label={`+${length - 1} more`} size="small" />
      </Box>
    );
  }

  // Auto mode — array behavior
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <Typography variant="cardValue" sx={{ textAlign: "center" }}>
          -
        </Typography>
      );
    }

    const displayItems = value.slice(0, 2);
    const extraCount = value.length - 2;

    return (
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 0.5,
          justifyContent: "center",
        }}
      >
        {displayItems.map((item, i) => (
          <Chip
            key={i}
            label={ellipsize(item, 15)}
            size="small"
            title={item}
            sx={CHIP_STYLE}
          />
        ))}

        {extraCount > 0 && (
          <Chip label={`+${extraCount} more`} size="small" variant="outlined" />
        )}
      </Box>
    );
  }

  // Fallback text
  return (
    <Typography variant="cardValue" sx={{ textAlign: "center" }}>
      {value !== null && value !== undefined && value !== "" ? value : "-"}
    </Typography>
  );
};

const SingleDetailedCard = ({
  iconName,
  title,
  secondaryLabel,
  secondaryValue,
  description,
  items = [],
  onClick,
  sx = {},
}) => {
  return (
    <Card
      variant="outlined"
      sx={{
        cursor: onClick ? "pointer" : "default",
        border: "1px solid #000",
        borderRadius: "12px",
        ...sx,
      }}
      onClick={onClick}
    >
      {/* Header: icon + title | secondaryLabel: secondaryValue */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          p: 2,
          pb: 1,
          borderBottom: "2px solid #007bff",
        }}
      >
        <Box
          display="flex"
          alignItems="center"
          gap={1}
          sx={{
            minWidth: 0, // REQUIRED to allow flex children to shrink
            flexGrow: 1, // allow title section to take available space
          }}
        >
          {getDynamicIcon(iconName)}

          <Typography
            variant="cardTitle"
            noWrap
            title={title}
            sx={{
              minWidth: 0,
              flexShrink: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "block",
            }}
          >
            {title && title.length > 70
              ? `${title.substring(0, 70)}...`
              : title}
          </Typography>
        </Box>

        {(secondaryLabel || secondaryValue) && (
          <Typography
            variant="cardLabel"
            sx={{ ml: 2, whiteSpace: "nowrap", textAlign: "right" }}
          >
            {secondaryLabel ? <span>{secondaryLabel} </span> : null}
            {secondaryValue}
          </Typography>
        )}
      </Box>

      <CardContent sx={{ pb: "16px !important" }}>
        {description === null ? null : (
          <Typography variant="cardValue" gutterBottom sx={{ mb: 2 }}>
            {description !== undefined && description !== ""
              ? description
              : "-"}
          </Typography>
        )}
        {/* Center-aligned Grid of Item Pairs */}
        {/* Center-aligned Grid of Item Pairs */}
        {items.length > 0 && (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(1, 1fr)",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
                lg: "repeat(auto-fit, minmax(200px, 1fr))",
              },
              gap: 2,
              mt: 1,
              width: "100%",
            }}
          >
            {items.map((item, idx) => (
              <Box
                key={idx}
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 1,
                  minWidth: 0, // prevent overflow from long chip text
                }}
              >
                {/* Label */}
                <Typography
                  variant="cardLabel"
                  sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
                >
                  {item.label}
                </Typography>

                {/* Value */}
                <Box
                  sx={{
                    flexGrow: 1,
                    overflow: "hidden",
                  }}
                >
                  {renderValue(item.value, item.type)}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

const DetailedCard = ({
  // Single card props
  iconName,
  title,
  secondaryLabel,
  secondaryValue,
  description,
  items = [],
  onClick,
  sx = {},

  // List mode props
  data,
  renderConfig,
  gap = 2,
  showEmpty = true,
  listSx = {},
  _mode,
}) => {
  const isListMode = data && renderConfig;
  const isArrayData = Array.isArray(data);
  const actualData = isListMode ? data : null;
  const actualRenderConfig = isListMode ? renderConfig : null;

  if (!isListMode) {
    return (
      <SingleDetailedCard
        iconName={iconName}
        title={title}
        secondaryLabel={secondaryLabel}
        secondaryValue={secondaryValue}
        description={description}
        items={items}
        onClick={onClick}
        sx={sx}
      />
    );
  }

  const processedData = isArrayData ? actualData : [actualData].filter(Boolean);

  if (processedData.length === 0 && showEmpty) {
    return (
      <Box sx={{ p: 2, textAlign: "center", ...listSx }}>
        <Typography variant="noticeText" color="text.secondary">
          No items
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap, ...listSx }}>
      {processedData.map((item, index) => {
        const cardProps = actualRenderConfig(item, index);
        return (
          <SingleDetailedCard
            key={cardProps.key || item.id || item.projectId || index}
            iconName={cardProps.iconName}
            title={cardProps.title}
            secondaryLabel={cardProps.secondaryLabel}
            secondaryValue={cardProps.secondaryValue}
            description={cardProps.description}
            items={cardProps.items}
            onClick={cardProps.onClick}
            sx={cardProps.sx}
          />
        );
      })}
    </Box>
  );
};

export default DetailedCard;
