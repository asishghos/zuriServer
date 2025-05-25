import { PythonShell } from "python-shell";
import axios from "axios";
import fs from "fs";
import { encode } from "base64-arraybuffer";
import { cache, CACHE_EXPIRATION } from "../utils/cache.js";
import { getCacheKey, getFromCache, saveToCache } from "../utils/cache.js";

const prototypePrompt1 = fs.readFileSync("prompts/prompt1.txt", "utf8");
const prototypePrompt2 = fs.readFileSync("prompts/prompt2.txt", "utf8");

const OPENAI_API_KEY = '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';

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
        Authorization: `Bearer ${OPENAI_API_KEY}`,
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
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
    }
  );

  return JSON.parse(gptResponse.data.choices[0].message.content);
}

export const analyzeAuto = async (req, res) => {
  const imagePath = req.file?.path;
  if (!imagePath) return res.status(400).json({ error: "No image uploaded" });

  try {
    const landmarkResponse = await runPoseDetector(imagePath);
    const toneResponse = await runToneDetector(imagePath, landmarkResponse);

    const requestData = {
      landmarkResponse,
      toneResponse,
      hasImage: true,
    };

    const bodyShapeCacheKey = getCacheKey(requestData);
    let bodyShapeResult = getFromCache(cache.bodyShapeAnalysis, bodyShapeCacheKey);
    
    if (!bodyShapeResult) {
      bodyShapeResult = await getBodyShapeFromGPT(landmarkResponse, toneResponse, imagePath);
      saveToCache(cache.bodyShapeAnalysis, bodyShapeCacheKey, bodyShapeResult);
    }

    const outfitRequestData = { ...requestData, bodyShapeResult };
    const outfitCacheKey = getCacheKey(outfitRequestData);
    let outfitSuggectionResult = getFromCache(cache.outfitSuggestions, outfitCacheKey);
    
    if (!outfitSuggectionResult) {
      outfitSuggectionResult = await getOutfitSuggectionsFromGPT(
        landmarkResponse,
        toneResponse,
        bodyShapeResult
      );
      saveToCache(cache.outfitSuggestions, outfitCacheKey, outfitSuggectionResult);
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
};

export const analyzeManual = async (req, res) => {
  try {
    const requestData = {
      body_shape: req.body.body_shape,
      gender: "female",
      skin_tone: req.body.skin_tone,
    };

    const bodyShapeCacheKey = getCacheKey(requestData);
    let bodyShapeResult = getFromCache(cache.bodyShapeAnalysis, bodyShapeCacheKey);
    
    if (!bodyShapeResult) {
      bodyShapeResult = await getBodyShapeFromGPT(
        JSON.stringify(requestData),
        JSON.stringify({ skin_tone: requestData.skin_tone }),
        null
      );
      saveToCache(cache.bodyShapeAnalysis, bodyShapeCacheKey, bodyShapeResult);
    }

    const outfitRequestData = { ...requestData, bodyShapeResult };
    const outfitCacheKey = getCacheKey(outfitRequestData);
    let outfitSuggectionResult = getFromCache(cache.outfitSuggestions, outfitCacheKey);
    
    if (!outfitSuggectionResult) {
      outfitSuggectionResult = await getOutfitSuggectionsFromGPT(
        JSON.stringify({ body_shape: requestData.body_shape }),
        JSON.stringify({ skin_tone: requestData.skin_tone }),
        bodyShapeResult
      );
      saveToCache(cache.outfitSuggestions, outfitCacheKey, outfitSuggectionResult);
    }

    console.log("GPT response 2: ", outfitSuggectionResult);

    res.json({
      bodyShapeAnalysis: bodyShapeResult,
      outfitSuggestions: outfitSuggectionResult,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Processing failed" });
  }
};

export const analyzeHybrid = async (req, res) => {
  const imagePath = req.file?.path;
  if (!imagePath) return res.status(400).json({ error: "No image uploaded" });
  
  try {
    const landmarkResponse = await runPoseDetector(imagePath);
    const toneResponse = await runToneDetector(imagePath, landmarkResponse);

    const requestData = {
      body_shape: req.body.body_shape,
      gender: "female",
      skin_tone: toneResponse,
      landmarkResponse,
      hasImage: true,
    };

    const bodyShapeCacheKey = getCacheKey(requestData);
    let bodyShapeResult = getFromCache(cache.bodyShapeAnalysis, bodyShapeCacheKey);
    
    if (!bodyShapeResult) {
      bodyShapeResult = await getBodyShapeFromGPT(landmarkResponse, toneResponse, imagePath);
      saveToCache(cache.bodyShapeAnalysis, bodyShapeCacheKey, bodyShapeResult);
    }

    const outfitRequestData = { ...requestData, bodyShapeResult };
    const outfitCacheKey = getCacheKey(outfitRequestData);
    let outfitSuggectionResult = getFromCache(cache.outfitSuggestions, outfitCacheKey);
    
    if (!outfitSuggectionResult) {
      outfitSuggectionResult = await getOutfitSuggectionsFromGPT(
        landmarkResponse,
        toneResponse,
        bodyShapeResult
      );
      saveToCache(cache.outfitSuggestions, outfitCacheKey, outfitSuggectionResult);
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
};