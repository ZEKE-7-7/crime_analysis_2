const csv = require("csvtojson");
const fs = require("fs");

csv()
  .fromFile("data.csv")
  .then((json) => {
    fs.writeFileSync("data.json", JSON.stringify(json, null, 2));
    console.log("CSV → JSON done ✅");
  });