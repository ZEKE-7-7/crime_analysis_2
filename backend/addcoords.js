const fs = require("fs");

const data = require("./data.json");

// Nagpur center
const baseLat = 21.15;
const baseLon = 79.09;

const updated = data.map((item) => {
  const lat = baseLat + (Math.random() - 0.5) * 0.1;
  const lon = baseLon + (Math.random() - 0.5) * 0.1;

  return {
    ...item,
    LATITUDE: lat,
    LONGITUDE: lon,
    CRIME_TYPE: item["Crime Head"] || "Crime",
    DATE_TIME: "2024-01-01",
    STATUS: "Open"
  };
});

fs.writeFileSync("finalData.json", JSON.stringify(updated, null, 2));

console.log("Coordinates added ✅");