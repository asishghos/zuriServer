import { randomInt } from "crypto";
import SerpApi from "google-search-results-nodejs";
import { cache } from "../utils/cache.js";
import { getCacheKey, getFromCache, saveToCache } from "../utils/cache.js";

const GoogleSearch = SerpApi.GoogleSearch;
const search = new GoogleSearch(
  "23e98fae95697e622bef128e771b2943da278a9dfa7cbafdd22d6235a1dca998"
);

export const getProducts = async (req, res) => {
  try {
    const { keywords } = req.body;

    if (!keywords || !keywords.length || !Array.isArray(keywords[0])) {
      return res.status(400).json({ error: "Invalid or missing keywords" });
    }

    const productsCacheKey = getCacheKey({ keywords });
    let finalResults = getFromCache(cache.products, productsCacheKey);
    
    if (finalResults) {
      return res.json(finalResults);
    }

    const searchGoogle = (keyword, platform) => {
      return new Promise((resolve, reject) => {
        search.json(
          {
            engine: "google",
            q: `${keyword} ${platform} + women `,
          },
          (data) => {
            if (data) resolve(data["inline_images"] || []);
            else reject(`No response from ${platform} search for keyword ${keyword}`);
          }
        );
      });
    };

    finalResults = [];
    const platformMap = {
      0: "ajio.com",
      1: "myntra.com",
      2: "nykaa.com",
    };

    for (let i = 0; i < Math.min(keywords.length, Object.keys(platformMap).length); i++) {
      const keyword = keywords[randomInt(3)][0];
      const platform = platformMap[i];

      try {
        const searchResults = await searchGoogle(keyword, platform);

        const convertedResults = await Promise.all(
          searchResults.map(async (item) => {
            const affiliatedLink = item.source;
            return {
              keyword,
              platform,
              title: item.title || "",
              original_link: item.source,
              affiliated_link: affiliatedLink,
              thumbnail: item.thumbnail || "",
            };
          })
        );

        finalResults.push(...convertedResults);
      } catch (error) {
        console.error(`Error searching ${platform} for ${keyword}:`, error);
      }
    }

    saveToCache(cache.products, productsCacheKey, finalResults);
    res.json(finalResults);
  } catch (error) {
    console.error("Error in /products:", error);
    res.status(500).json({ error: error.message || "Failed to fetch product results" });
  }
};
