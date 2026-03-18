const axios = require("axios");
const fs = require("fs");

const data = require("./your-dataset.json"); // convert CSV to JSON first

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function geocode() {
  const results = [];

  for (const item of data) {
    const location = item.LOCATION + ", Nagpur, India";

    try {
      const res = await axios.get("https://nominatim.openstreetmap.org/search", {
        params: {
          q: location,
          format: "json"
        }
      });

      if (res.data.length > 0) {
        results.push({
          ...item,
          LATITUDE: res.data[0].lat,
          LONGITUDE: res.data[0].lon
        });
      } else {
        results.push({
          ...item,
          LATITUDE: null,
          LONGITUDE: null
        });
      }

      console.log("Done:", location);

      await delay(1000); // IMPORTANT (avoid being blocked)
    } catch (err) {
      console.error("Error:", location);
    }
  }

  fs.writeFileSync("output.json", JSON.stringify(results, null, 2));
}

geocode();