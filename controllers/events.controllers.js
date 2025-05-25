import {Event} from '../models/events.models.js';
import { ai } from "../index.js";
import { Modality } from "@google/genai";
import path from "path";
import fs from "fs";

export const addEvent = async (req, res) => {
    const user = req.user;
    if (!user) {   
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const userId = user._id;
    const { name, date, dayTime, occasion, isStyled, description, generatedImages } = req.body;

    try {
        const newEvent = await Event.create({
            userId,
            name,
            date,
            dayTime,
            occasion,
            isStyled,
            description,
            generatedImages
        });

        res.status(201).json({ message: 'Event created successfully', event: newEvent });
    } catch (error) {
        res.status(500).json({ message: 'Error creating event', error: error.message });
    }
};

export const updateEvent = async (req, res) => {
    const { id } = req.params;
    const { name, date, dayTime, occasion, isStyled, description, generatedImages } = req.body;

    try {
        const event = await Event.findById(id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Check if the user is authorized to update this event
        if (event.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Unauthorized to update this event' });
        }

        // Update the event with the new data
        const updatedEvent = await Event.findByIdAndUpdate(
            id,
            { name, date, dayTime, occasion, isStyled, description, generatedImages },
            { new: true }
        );

        if (!updatedEvent) {
            return res.status(404).json({ message: 'Event not found' });
        }

        res.status(200).json({ message: 'Event updated successfully', event: updatedEvent });
    } catch (error) {
        res.status(500).json({ message: 'Error updating event', error: error.message });
    }
};

export const deleteEvent = async (req, res) => {
    const { id } = req.params;

    try {
        const event = await Event.findById(id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Check if the user is authorized to delete this event
        if (event.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Unauthorized to delete this event' });
        }

        // Delete the event        
        await Event.findByIdAndDelete(id);

        return res.status(200).json({ message: 'Event deleted successfully' });
    } catch (error) {
        return res.status(500).json({ message: 'Error deleting event', error: error.message });
    }
};

export const fetchAllEvents = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });   
        }
        const events = await Event.find({ userId: user._id });
        if (!events || events.length === 0) {
            return res.status(404).json({ message: 'No events found' });
        }

        return res.status(200).json({ message: 'Events fetched successfully', events });
    } catch (error) {
        console.error("Error fetching events:", error.message);
        return res.status(500).json({ message: 'Error fetching events', error: error.message });
    }
};

export const getEventDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const eventDetails = await Event.findById(id);
        if (!eventDetails) {
            return res.status(404).json({ message: 'Event not found' });
        };

        // Check if the user is authorized to view this event
        if (eventDetails.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Unauthorized to view this event' });
        }

        return res.status(200).json({ message: 'Event details fetched successfully', event: eventDetails });
    } catch (error) {
        console.log("error : ", error.message);
        return res.status(500).json({ message: 'Error fetching event details', error: error.message });
    }
}

function buildOutfitPrompt(occasion, dayTime, description, userBodyInfo) {
    const bodyShape = userBodyInfo?.bodyShapeAnalysis.bodyShape.classification || "not specified";
    const skinTone = userBodyInfo?.bodyShapeAnalysis.skinTone.toneCategory || "not specified";
    const gender = userBodyInfo?.bodyShapeAnalysis.gender.classification || "not specified";
    const desc = description?.trim() 
        ? `Additional styling notes: ${description.trim()}.` 
        : "Focus on classic, versatile styling suitable for everyday wear.";

    return `
        You are a professional fashion stylist and visual designer. Your task is to generate a **photorealistic, magazine-quality outfit image** based on the user's profile and occasion. Design a full outfit that is cohesive, stylish, and wearable.

        👤 USER PROFILE:
        - Body shape: ${bodyShape}
        - Skin tone: ${skinTone}
        - Gender: ${gender}

        📅 CONTEXT:
        - Occasion: ${occasion || "everyday wear"}
        - Time of day: ${dayTime || "anytime"}
        - ${desc}

        👗 OUTFIT DESIGN:
        - Include: top, bottom, shoes, and accessories (bag, jewelry, scarf, etc.)
        - Color and fabric choices should suit skin tone and occasion
        - Make it season-appropriate and culturally sensitive
        - The overall outfit must be harmonious, flattering, and elegant
        - Ensure each piece fits well and complements body shape

        🖼️ VISUAL STYLE:
        - High-resolution, clear fabric details
        - Natural, soft lighting with gentle shadows
        - Neutral background (light gray, beige, or off-white)
        - Position outfit clearly to showcase all components

        ✨ STYLE DIRECTION:
        - Blend timeless elegance with a modern twist
        - Colors should be balanced and fashion-forward
        - Add tasteful styling elements that elevate the look
        - Prioritize comfort, functionality, and real-world wearability

        Final goal: A visually stunning, realistic outfit that aligns with user traits and the specific occasion. The result should look like it belongs on the cover of a fashion magazine.
    `.replace(/\s+/g, ' ').trim();
}

async function generateOutfitAsPerRequirements(occasion, dayTime, description, userBodyInfo) {
    try {
        const prompt = buildOutfitPrompt(occasion, dayTime, description, userBodyInfo);

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-preview-image-generation",
            contents: prompt,
            config: {
                responseModalities: [Modality.TEXT, Modality.IMAGE],
            },
        });

        const result = {
            textDescription: "",
            imageUrl: "",
            status: "success",
        };

        for (const part of response.candidates[0].content.parts) {
            if (part.text) {
                result.textDescription = part.text;
            } else if (part.inlineData) {
                const imageDataB64 = part.inlineData.data;
                const buffer = Buffer.from(imageDataB64, "base64");

                // Ensure folder exists
                const imagesDir = path.join("static", "images");
                fs.mkdirSync(imagesDir, { recursive: true });

                const filename = `outfit_${Date.now()}.png`;
                const filepath = path.join(imagesDir, filename);
                fs.writeFileSync(filepath, buffer);

                // Set accessible image URL
                result.imageUrl = `/static/images/${filename}`;
            }
        }

        return {
            success: true,
            data: result,
        };

    } catch (error) {
        console.error("Generation Error:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

export const styleForEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const userId = req.user._id;
        // Check if the user is authorized to style this event
        if(event.userId.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Unauthorized to style this event' });
        }

        const userBodyInfo = req.user.userBodyInfo;

        // fetch user body data here to give more personalized outfit

        if (!event.isStyled || !event.generatedImages || event.generatedImages.length === 0) {
            const genResult = await generateOutfitAsPerRequirements(
                event.occasion,
                event.dayTime,
                event.description,
                userBodyInfo
            );

            // console.log("GEN RESULT:", genResult);

            if (!genResult.success || !genResult.data?.imageUrl) {
                return res.status(500).json({ message: 'Error generating outfit' });
            }

            // Save the image as base64 or link to image hosting
            event.isStyled = true;
            event.generatedImages = [genResult.data.imageUrl];
            await event.save();

            return res.status(200).json({
                message: 'Event styled successfully',
                description: genResult.data.textDescription,
                images: event.generatedImages,
            });
        }

        return res.status(200).json({
            message: 'Event already styled',
            images: event.generatedImages,
        });
    } catch (error) {
        console.error("Error styling event:", error.message);
        return res.status(500).json({ message: 'Error styling event', error: error.message });
    }
};