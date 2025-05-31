import { randomInt } from "crypto";
import axios from "axios";

const GOOGLE_API_KEY = "AIzaSyD7jAiVV8_xZ6Sk3R2L4p_x2ue0f8vaT2Q";
const GOOGLE_CSE_ID = "b7b2fa60629424d7f";

const DELAY_BETWEEN_REQUESTS = 5000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 10000;

export const getProducts = async (req, res) => {
  try {
    const { keywords } = req.body;
    if (!keywords || !keywords.length || !Array.isArray(keywords[0])) {
      return res.status(400).json({ error: "Invalid or missing keywords" });
    }
    const customSearchResults = await searchWithGoogleCustom(keywords);
    res.json(customSearchResults);
  } catch (error) {
    console.error("Error in /products:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to fetch product results" });
  }
};

// Enhanced Google Custom Search function with proper rate limiting
const searchWithGoogleCustom = async (keywords) => {
  const results = [];

  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i][0];
    // Only do ONE search per keyword to reduce API usage
    try {
      const query = `${keyword} women`;
      const searchResults = await performGoogleCustomSearchWithRetry(query);
      const convertedResults = convertSearchResults(searchResults, keyword, "general");
      results.push(...convertedResults);
      
      // Add delay between requests (except for the last one)
      if (i < keywords.length - 1) {
        console.log(`Waiting ${DELAY_BETWEEN_REQUESTS}ms before next request...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
      }
    } catch (error) {
      console.error(`Error in Google Custom Search for ${keyword}:`, error);
    }
  }

  return results;
};

// Google Custom Search with retry logic and better error handling
const performGoogleCustomSearchWithRetry = async (query, retryCount = 0) => {
  try {
    const response = await axios.get(
      "https://www.googleapis.com/customsearch/v1",
      {
        params: {
          key: GOOGLE_API_KEY,
          cx: GOOGLE_CSE_ID,
          q: query,
          num: 10, // Get more results per request to maximize efficiency
        },
        timeout: 10000, // 10 second timeout
      }
    );

    return response.data.items || [];
  } catch (error) {
    const status = error.response?.status;
    const message = error.response?.data?.error?.message || error.message;
    
    console.error(`Google Custom Search API error (attempt ${retryCount + 1}):`, {
      status,
      message,
      query
    });

    // Handle specific error cases
    if (status === 429) {
      // For quota exceeded, don't retry - just throw immediately
      if (message && message.includes('Quota exceeded')) {
        throw new Error(`Daily API quota exceeded for query: ${query}. Please try again tomorrow or upgrade your plan.`);
      }
      
      // For other rate limiting, retry with backoff
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY * (retryCount + 1); // Exponential backoff
        console.log(`Rate limited. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return performGoogleCustomSearchWithRetry(query, retryCount + 1);
      } else {
        throw new Error(`Rate limit exceeded after ${MAX_RETRIES} retries for query: ${query}`);
      }
    } else if (status === 403) {
      throw new Error(`API quota exceeded or invalid credentials for query: ${query}`);
    } else if (status >= 500) {
      if (retryCount < MAX_RETRIES) {
        console.log(`Server error. Retrying in ${RETRY_DELAY}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return performGoogleCustomSearchWithRetry(query, retryCount + 1);
      }
    }

    throw error;
  }
};

// Convert search results to our format
const convertSearchResults = (searchResults, keyword, source) => {
  return searchResults.map((item) => {
    const productPageUrl = item.link || "";
    const imageUrl = extractImageUrl(item);

    return {
      keyword,
      source,
      title: cleanTitle(item.title || ""),
      original_link: productPageUrl,
      affiliated_link: productPageUrl,
      thumbnail: imageUrl
    };
  });
};

// Enhanced image extraction with more sources
const extractImageUrl = (item) => {
  const pagemap = item.pagemap || {};

  // Try different image sources in order of preference
  if (pagemap.cse_image && pagemap.cse_image[0]) {
    return pagemap.cse_image[0].src;
  }
  if (pagemap.cse_thumbnail && pagemap.cse_thumbnail[0]) {
    return pagemap.cse_thumbnail[0].src;
  }
  if (pagemap.metatags && pagemap.metatags[0]) {
    const metatag = pagemap.metatags[0];
    return (
      metatag["og:image"] ||
      metatag["twitter:image"] ||
      metatag["image"] ||
      metatag["thumbnail"] ||
      ""
    );
  }
  if (pagemap.product && pagemap.product[0] && pagemap.product[0].image) {
    return pagemap.product[0].image;
  }

  if (
    pagemap.imageobject &&
    pagemap.imageobject[0] &&
    pagemap.imageobject[0].url
  ) {
    return pagemap.imageobject[0].url;
  }

  return "";
};

// Enhanced title cleaning
const cleanTitle = (title) => {
  return title
    .replace(
      /\s*-\s*(Buy|Shop|Online|Price|India|Amazon|Flipkart|Myntra|Ajio|Nykaa).*$/gi,
      ""
    )
    .replace(/\s*\|\s*.*$/, "")
    .replace(/\s*–\s*.*$/, "")
    .replace(/\s*\.\.\.$/, "")
    .trim();
};

// Utility function to check API quota usage
export const checkApiQuota = async () => {
  try {
    const response = await axios.get(
      "https://www.googleapis.com/customsearch/v1",
      {
        params: {
          key: GOOGLE_API_KEY,
          cx: GOOGLE_CSE_ID,
          q: "test",
          num: 1,
        },
      }
    );
    console.log("API is working. Quota check successful.");
    return true;
  } catch (error) {
    console.error("API quota check failed:", error.response?.data || error.message);
    return false;
  }
};