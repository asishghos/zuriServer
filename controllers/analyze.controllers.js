import { PythonShell } from "python-shell";
import axios from "axios";
import fs from "fs";

const prototypePrompt1 = fs.readFileSync("prompts/prompt1.txt", "utf8");

// Use environment variable for API key
const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY ||
  "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";

async function runPoseDetector(imagePath) {
  return new Promise((resolve, reject) => {
    // Validate file exists
    if (!fs.existsSync(imagePath)) {
      return reject(new Error("Image file not found"));
    }

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
    // Validate file exists
    if (!fs.existsSync(imagePath)) {
      return reject(new Error("Image file not found"));
    }

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
          ### 1. Pose Landmarks Data/ Body shape: ${JSON.stringify(landmarkResponse)}
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

  try {
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
  } catch (error) {
    console.error("OpenAI API error:", error.response?.data || error.message);
    throw new Error("Failed to analyze body shape");
  }
}

export const analyzeAuto = async (req, res) => {
  const imagePath = req.file?.path;
  if (!imagePath) return res.status(400).json({ error: "No image uploaded" });

  try {
    const landmarkResponse = await runPoseDetector(imagePath);
    const toneResponse = await runToneDetector(imagePath, landmarkResponse);

    let bodyShapeResult = await getBodyShapeFromGPT(
      landmarkResponse,
      toneResponse,
      imagePath
    );

    console.log("Tone response:", toneResponse);
    console.log("Keypoints response:", landmarkResponse);
    console.log("GPT response 1: ", bodyShapeResult);

    res.json({
      bodyShapeResult,
    });
  } catch (error) {
    console.error("analyzeAuto error:", error);
    res.status(500).json({ error: error.message || "Processing failed" });
  } finally {
    // Safe file cleanup
    if (imagePath && fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
      } catch (cleanupError) {
        console.error("File cleanup error:", cleanupError);
      }
    }
  }
};

export const analyzeManual = async (req, res) => {
  try {
    // Input validation
    if (!req.body.body_shape || !req.body.skin_tone) {
      return res
        .status(400)
        .json({ error: "Missing required fields: body_shape and skin_tone" });
    }

    const requestData = {
      body_shape: req.body.body_shape,
      gender: req.body.gender || "female", // Allow gender to be specified
      skin_tone: req.body.skin_tone,
    };

    let bodyShapeResult = await getBodyShapeFromGPT(
      JSON.stringify(requestData),
      JSON.stringify(requestData),
      null
    );

    res.json({
      bodyShapeResult
    });
  } catch (error) {
    console.error("analyzeManual error:", error);
    res.status(500).json({ error: error.message || "Processing failed" });
  }
};

export const analyzeHybrid = async (req, res) => {
  const imagePath = req.file?.path;
  if (!imagePath) return res.status(400).json({ error: "No image uploaded" });
      if (!req.body.body_shape) {
      return res
        .status(400)
        .json({ error: "Missing required fields: body_shape" });
    }

  try {
    const landmarkResponse = await runPoseDetector(imagePath);
    const toneResponse = await runToneDetector(imagePath, landmarkResponse);

    const requestData = {
      body_shape: req.body.body_shape,
      gender: req.body.gender || "female",
    };

    let bodyShapeResult = await getBodyShapeFromGPT(
      requestData,
      toneResponse,
      imagePath
    );

    console.log("Tone response:", toneResponse);
    console.log("Keypoints response:", landmarkResponse);
    console.log("GPT response 1: ", bodyShapeResult);

    res.json({
      bodyShapeResult,
    });
  } catch (error) {
    console.error("analyzeHybrid error:", error);
    res.status(500).json({ error: error.message || "Processing failed" });
  } finally {
    // Safe file cleanup
    if (imagePath && fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
      } catch (cleanupError) {
        console.error("File cleanup error:", cleanupError);
      }
    }
  }
};
