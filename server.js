import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { config } from "dotenv";
import { PythonShell } from "python-shell";
import { encode } from "base64-arraybuffer";
import SerpApi from "google-search-results-nodejs";
import { GoogleGenAI, Modality, createUserContent } from "@google/genai";
import { randomInt } from "crypto";
import OpenAI from "openai";
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GoogleSearch = SerpApi.GoogleSearch;
const search = new GoogleSearch(
  "23e98fae95697e622bef128e771b2943da278a9dfa7cbafdd22d6235a1dca998"
);
const openai = new OpenAI({
  apiKey: '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',
});
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const cache = {
  bodyShapeAnalysis: new Map(),
  outfitSuggestions: new Map(),
  products: new Map(),
};

const CACHE_EXPIRATION = 30 * 60 * 1000;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync("./uploads")) fs.mkdirSync("./uploads");
    cb(null, "./uploads/");
  },
  filename: (req, file, cb) => {
    cb(
      null,
      Date.now() +
        "-" +
        Math.round(Math.random() * 1e9) +
        path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new Error("Only image files are allowed!"));
  },
});

const app = express();

const prototypePrompt1 = fs.readFileSync("prompts/prompt1.txt", "utf8");
const prototypePrompt2 = fs.readFileSync("prompts/prompt2.txt", "utf8");
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Welcome to the Fashion AI server.");
});

function getCacheKey(data) {
  try {
    const normalized = JSON.stringify(data, (key, value) => {
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        return Object.keys(value)
          .sort()
          .reduce((result, key) => {
            result[key] = value[key];
            return result;
          }, {});
      }
      return value;
    });

    return normalized;
  } catch (error) {
    console.warn("Error generating cache key:", error.message);
    return `fallback-${Date.now()}`;
  }
}

function getFromCache(cacheStore, key) {
  const cacheItem = cacheStore.get(key);
  if (!cacheItem) return null;
  if (Date.now() > cacheItem.expiry) {
    cacheStore.delete(key);
    return null;
  }
  return cacheItem.data;
}

function saveToCache(cacheStore, key, data) {
  cacheStore.set(key, {
    data: data,
    expiry: Date.now() + CACHE_EXPIRATION,
  });
}

app.post("/analyzeAuto", upload.single("image"), async (req, res) => {
  const imagePath = req.file?.path;
  if (!imagePath) return res.status(400).json({ error: "No image uploaded" });

  try {
    const landmarkResponse = await runPoseDetector(imagePath);
    const toneResponse = await runToneDetector(imagePath, landmarkResponse);

    // Create request data structure for caching
    const requestData = {
      landmarkResponse,
      toneResponse,
      hasImage: true,
    };

    // Generate cache keys
    const bodyShapeCacheKey = getCacheKey(requestData);

    // Try to get body shape analysis from cache
    let bodyShapeResult = getFromCache(
      cache.bodyShapeAnalysis,
      bodyShapeCacheKey
    );
    if (!bodyShapeResult) {
      bodyShapeResult = await getBodyShapeFromGPT(
        landmarkResponse,
        toneResponse,
        imagePath
      );
      saveToCache(cache.bodyShapeAnalysis, bodyShapeCacheKey, bodyShapeResult);
    }

    // Generate outfit suggestions cache key by adding body shape result
    const outfitRequestData = { ...requestData, bodyShapeResult };
    const outfitCacheKey = getCacheKey(outfitRequestData);

    // Try to get outfit suggestions from cache
    let outfitSuggectionResult = getFromCache(
      cache.outfitSuggestions,
      outfitCacheKey
    );
    if (!outfitSuggectionResult) {
      outfitSuggectionResult = await getOutfitSuggectionsFromGPT(
        landmarkResponse,
        toneResponse,
        bodyShapeResult
      );
      saveToCache(
        cache.outfitSuggestions,
        outfitCacheKey,
        outfitSuggectionResult
      );
    }

    console.log("Tone response:", toneResponse);
    console.log("Keypoints response:", landmarkResponse);
    console.log("GPT response 1: ", bodyShapeResult);
    console.log("GPT response 2: ", outfitSuggectionResult);

    res.json({
      bodyShapeAnalysis: bodyShapeResult,
      outfitSuggestions: outfitSuggectionResult,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Processing failed" });
  } finally {
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  }
});

app.post("/analyzeManual", async (req, res) => {
  try {
    // Create request data structure
    const requestData = {
      body_shape: req.body.body_shape,
      gender: "female",
      skin_tone: req.body.skin_tone,
    };

    // Generate cache keys - use a string representation of request data
    const bodyShapeCacheKey = getCacheKey(requestData);

    // Try to get body shape analysis from cache
    let bodyShapeResult = getFromCache(
      cache.bodyShapeAnalysis,
      bodyShapeCacheKey
    );
    if (!bodyShapeResult) {
      // Manually construct the parameters for getBodyShapeFromGPT to match the original function call
      bodyShapeResult = await getBodyShapeFromGPT(
        JSON.stringify(requestData), // landmarkResponse (since we don't have landmarks, use request data)
        JSON.stringify({ skin_tone: requestData.skin_tone }), // toneResponse
        null // imagePath
      );
      saveToCache(cache.bodyShapeAnalysis, bodyShapeCacheKey, bodyShapeResult);
    }

    // Generate outfit suggestions cache key by adding body shape result to request data
    const outfitRequestData = { ...requestData, bodyShapeResult };
    const outfitCacheKey = getCacheKey(outfitRequestData);

    // Try to get outfit suggestions from cache
    let outfitSuggectionResult = getFromCache(
      cache.outfitSuggestions,
      outfitCacheKey
    );
    if (!outfitSuggectionResult) {
      // Manually construct parameters for getOutfitSuggectionsFromGPT to match the original function call
      outfitSuggectionResult = await getOutfitSuggectionsFromGPT(
        JSON.stringify({ body_shape: requestData.body_shape }), // landmarkResponse
        JSON.stringify({ skin_tone: requestData.skin_tone }), // toneResponse
        bodyShapeResult // bodyShapeResult
      );
      saveToCache(
        cache.outfitSuggestions,
        outfitCacheKey,
        outfitSuggectionResult
      );
    }

    console.log("GPT response 2: ", outfitSuggectionResult);

    res.json({
      bodyShapeAnalysis: bodyShapeResult,
      outfitSuggestions: outfitSuggectionResult,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Processing failed" });
  }
});

app.post("/analyzeHybrid", upload.single("image"), async (req, res) => {
  const imagePath = req.file?.path;
  if (!imagePath) return res.status(400).json({ error: "No image uploaded" });
  try {
    const landmarkResponse = await runPoseDetector(imagePath);
    const toneResponse = await runToneDetector(imagePath, landmarkResponse);

    // Create request data structure
    const requestData = {
      body_shape: req.body.body_shape,
      gender: "female",
      skin_tone: toneResponse, // Use detected skin tone
      landmarkResponse,
      hasImage: true,
    };

    // Generate cache keys
    const bodyShapeCacheKey = getCacheKey(requestData);

    // Try to get body shape analysis from cache
    let bodyShapeResult = getFromCache(
      cache.bodyShapeAnalysis,
      bodyShapeCacheKey
    );
    if (!bodyShapeResult) {
      bodyShapeResult = await getBodyShapeFromGPT(
        landmarkResponse,
        toneResponse,
        imagePath
      );
      saveToCache(cache.bodyShapeAnalysis, bodyShapeCacheKey, bodyShapeResult);
    }

    // Generate outfit suggestions cache key by adding body shape result
    const outfitRequestData = { ...requestData, bodyShapeResult };
    const outfitCacheKey = getCacheKey(outfitRequestData);

    // Try to get outfit suggestions from cache
    let outfitSuggectionResult = getFromCache(
      cache.outfitSuggestions,
      outfitCacheKey
    );
    if (!outfitSuggectionResult) {
      outfitSuggectionResult = await getOutfitSuggectionsFromGPT(
        landmarkResponse,
        toneResponse,
        bodyShapeResult
      );
      saveToCache(
        cache.outfitSuggestions,
        outfitCacheKey,
        outfitSuggectionResult
      );
    }

    console.log("Tone response:", toneResponse);
    console.log("Keypoints response:", landmarkResponse);
    console.log("GPT response 1: ", bodyShapeResult);
    console.log("GPT response 2: ", outfitSuggectionResult);

    res.json({
      bodyShapeAnalysis: bodyShapeResult,
      outfitSuggestions: outfitSuggectionResult,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Processing failed" });
  } finally {
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  }
});

app.post("/products", async (req, res) => {
  try {
    const { keywords } = req.body;

    if (!keywords || !keywords.length || !Array.isArray(keywords[0])) {
      return res.status(400).json({ error: "Invalid or missing keywords" });
    }

    // Generate cache key for products request
    const productsCacheKey = getCacheKey({ keywords });

    // Try to get products from cache
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
            else
              reject(
                `No response from ${platform} search for keyword ${keyword}`
              );
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

    for (
      let i = 0;
      i < Math.min(keywords.length, Object.keys(platformMap).length);
      i++
    ) {
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

    // Save search results to cache
    saveToCache(cache.products, productsCacheKey, finalResults);

    res.json(finalResults);
  } catch (error) {
    console.error("Error in /products:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to fetch product results" });
  }
});

app.post("/generate_image", upload.single("image"), async (req, res) => {
  try {
    const clothingType = req.body.bodyPart;
    const occasion = req.body.occasion;
    if (!req.file || !clothingType || !occasion) {
      return res
        .status(400)
        .json({ error: "Missing image or clothing type or occasion" });
    }
    const fileData = await fs.promises.readFile(req.file.path);
    const imageArrayBuffer = fileData.buffer || Buffer.from(fileData);
    const base64Image = encode(imageArrayBuffer);
    const promptResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert fashion stylist AI with deep knowledge of clothing, styling, and fashion trends. 
Your task is to analyze uploaded clothing items and create detailed prompts for AI image generation that will produce complete, stylish outfits.
Key requirements:
1. Analyze the garment's color, style, fabric, and design details
2. Create cohesive outfits appropriate for the specified occasion
3. Include complementary pieces (shoes, accessories, layers)
4. Consider current fashion trends and timeless styling principles
5. Ensure the outfit is practical and wearable for the occasion
Style guidelines:
- Use "invisible mannequin" or "flat lay" presentation
- Show clear details of all clothing items
- Maintain consistent lighting and background
- Focus on the complete outfit composition`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this ${clothingType} and create a complete outfit for a ${occasion.toLowerCase()} occasion.
Requirements:
- Incorporate the uploaded garment as the focal piece
- Add 3-4 complementary items (bottoms, shoes, accessories, outerwear if needed)
- Consider the season and formality level of "${occasion}"
- Present as a clean, professional fashion layout
Generate ONLY the detailed image generation prompt - no explanations or additional text.
The prompt should be specific enough to generate a high-quality, cohesive outfit image.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 800,
    });

    const generatedPrompt = promptResponse.choices[0].message.content.trim();
    console.log(generatedPrompt);
    const prompt = generatedPrompt;
    const contents = [
      { text: prompt },
      {
        inlineData: {
          mimeType: req.file.mimetype,
          data: base64Image,
        },
      },
    ];

    const results = [];
    // for (let i = 1; i <= 3; i++) {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents,
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });
    const parts = response.candidates[0].content.parts;
    const imagePart = parts.find((p) => p.inlineData);
    if (imagePart) {
      results.push({
        style: `${occasion}`,
        base64: imagePart.inlineData.data,
      });
    } else {
      results.push({
        style: `${occasion}`,
        error: "No image returned from Gemini",
      });
    }
    //}
    res.json({ results });
  } catch (err) {
    console.error("Generation error:", err.message);
    res.status(500).json({ error: "Image generation failed" });
  }
});

async function runPoseDetector(imagePath) {
  return new Promise((resolve, reject) => {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");

    const pyshell = new PythonShell("tools/pose_detector.py");

    let output = "";

    pyshell.on("message", (message) => {
      output += message + "\n";
    });

    pyshell.on("stderr", (stderr) => {
      console.error("Python stderr:", stderr);
    });

    pyshell.send(JSON.stringify({ image: base64Image }));

    pyshell.end((err) => {
      if (err) return reject(err);
      resolve(output.trim());
    });
  });
}

async function runToneDetector(imagePath, landmarkResponse) {
  return new Promise((resolve, reject) => {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");

    const pyshell = new PythonShell("tools/skintone_detector.py");

    let output = "";

    pyshell.on("message", (message) => {
      output += message + "\n";
    });

    pyshell.on("stderr", (stderr) => {
      console.error("Python stderr:", stderr);
    });
    pyshell.send(
      JSON.stringify({
        image: base64Image,
        keypoints_text: landmarkResponse,
      })
    );

    pyshell.end((err) => {
      if (err) return reject(err);
      resolve(output.trim());
    });
  });
}

async function getBodyShapeFromGPT(landmarkResponse, toneResponse, imagePath) {
  const messages = [
    {
      role: "system",
      content: prototypePrompt1,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Human Analysis Request
          ## Input Data Analysis
          I need a comprehensive analysis of the human subject using the following data:
          ### 1. Pose Landmarks Data: ${JSON.stringify(landmarkResponse)}
          ### 2. Skin Tone Detection Results: ${JSON.stringify(toneResponse)}
          ${
            imagePath
              ? "### 3. Reference Image is included."
              : "### 3. No image was provided."
          }`,
        },
      ],
    },
  ];

  if (imagePath && fs.existsSync(imagePath)) {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");
    messages[1].content.push({
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${base64Image}`,
      },
    });
  }

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4-turbo",
      messages: messages,
      temperature: 0.3,
      response_format: { type: "json_object" },
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer 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`,
      },
    }
  );

  return JSON.parse(response.data.choices[0].message.content);
}

async function getOutfitSuggectionsFromGPT(
  landmarkResponse,
  toneResponse,
  bodyShapeResult
) {
  const gptResponse = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: prototypePrompt2,
        },
        {
          role: "user",
          content: `Given the following inputs:
          - Body Landmark Data: ${JSON.stringify(landmarkResponse)}
          - Detect gender from the Image
          - Overall Tone or Occasion: ${JSON.stringify(toneResponse)}
          - Body Analysis in JSON: ${JSON.stringify(bodyShapeResult)}`,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer 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`,
      },
    }
  );

  const recommendations = JSON.parse(
    gptResponse.data.choices[0].message.content
  );

  return recommendations;
}

function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of cache.bodyShapeAnalysis.entries()) {
    if (now > value.expiry) {
      cache.bodyShapeAnalysis.delete(key);
    }
  }

  // Clean up outfit suggestions cache
  for (const [key, value] of cache.outfitSuggestions.entries()) {
    if (now > value.expiry) {
      cache.outfitSuggestions.delete(key);
    }
  }

  // Clean up products cache
  for (const [key, value] of cache.products.entries()) {
    if (now > value.expiry) {
      cache.products.delete(key);
    }
  }
}

setInterval(cleanupCache, 15 * 60 * 1000);

app.listen(3000, "0.0.0.0", () => {
  console.log("Server running on http://localhost:3000");
});

export default app;
