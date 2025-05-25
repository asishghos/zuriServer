import fs from "fs";
import OpenAI from "openai";
import { GoogleGenAI, Modality } from "@google/genai";
import { encode } from "base64-arraybuffer";

const openai = new OpenAI({
  apiKey: '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',
});

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const generateImage = async (req, res) => {
  try {
    const clothingType = req.body.bodyPart;
    const occasion = req.body.occasion;
    
    if (!req.file || !clothingType || !occasion) {
      return res.status(400).json({ error: "Missing image or clothing type or occasion" });
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

    const contents = [
      { text: generatedPrompt },
      {
        inlineData: {
          mimeType: req.file.mimetype,
          data: base64Image,
        },
      },
    ];

    const results = [];
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

    res.json({ results });
  } catch (err) {
    console.error("Generation error:", err.message);
    res.status(500).json({ error: "Image generation failed" });
  }
};