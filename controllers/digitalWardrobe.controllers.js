import { DigitalWardrobe } from "../models/digitalWardrobe.models.js";

// GET all tag options (hardcoded here for UI dropdowns)
export const getTags = async (req, res) => {
    res.json({
        fabric: ["Cotton", "Linen", "Denim", "Satin", "Silk", "Chiffon", "Velvet", "Knit", "Lace", "Sequin", "Sheer"],
        occasion: ["Work", "Casual", "Semi-formal", "Formal", "Party", "Beach Vacation", "Mountain Vacation", "Weddings & Festivals", "Brunch", "Gym/Sports", "Travel"],
        // season: ["Winter", "Summer", "Autumn", "Monsoon"],
        category: ["Tops", "Bottoms", "Jeans", "Dresses", "Co-ords", "Jackets", "Sarees", "Kurta Sets", "Lehengas", "Indowestern", "Swimwear", "Lingerie", "Footwear", "Accessories", "Gowns"]
    });
};

export const addGarmentToDigitalWardrobe = async (req, res) => {
    try {
        const userId = req.user._id;
        const garmentData = req.body;
        const wardrobe = await DigitalWardrobe.findOneAndUpdate({ userId }, { push: { garments: garmentData } });
        if (!wardrobe) {
            return res.status(404).json({ message: "Wardrobe not found" });
        }
        res.status(200).json({ message: "Garment added to digital wardrobe", wardrobe });
    } catch (error) {
        console.error("Error adding garment to digital wardrobe:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const getMyWardrobe = async (req, res) => {
    try {
        const wardrobe = await DigitalWardrobe.findOne({ userId: req.user._id });
        if (!wardrobe) return res.status(404).json({ message: 'No wardrobe found' });
        res.status(200).json(wardrobe);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch wardrobe', error: err.message });
    }
};

export const updateGarment = async (req, res) => {
    try {
        const userId = req.user._id;
        const { garmentId } = req.params;
        const updatedFields = req.body;

        const wardrobe = await DigitalWardrobe.findOne({ userId });
        if (!wardrobe) return res.status(404).json({ message: 'Wardrobe not found' });

        const garment = wardrobe.garments.id(garmentId);
        if (!garment) return res.status(404).json({ message: 'Garment not found' });

        Object.assign(garment, updatedFields);
        await wardrobe.save();

        res.status(200).json({ message: 'Garment updated successfully', data: garment });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update garment', error: err.message });
    }
};

export const deleteGarment = async (req, res) => {
    try {
        const userId = req.user._id;
        const { garmentId } = req.params;

        const wardrobe = await DigitalWardrobe.findOne({ userId });
        if (!wardrobe) return res.status(404).json({ message: 'Wardrobe not found' });

        const garment = wardrobe.garments.id(garmentId);
        if (!garment) return res.status(404).json({ message: 'Garment not found' });

        garment.remove();
        await wardrobe.save();

        res.status(200).json({ message: 'Garment deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete garment', error: err.message });
    }
};

export const getGarmentsByCategory = async (req, res) => {
    try {
        const { category } = req.params;

        if (!category) {
            return res.status(400).json({ message: 'Category is required' });
        }
        const wardrobe = await DigitalWardrobe.findOne({ userId: req.user._id });

        if (!wardrobe || wardrobe.garments.length === 0) {
            return res.status(404).json({ message: 'No garments found in wardrobe' });
        }

        const filtered = wardrobe.garments.filter(g => g.category === category);

        res.json(filtered);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch garments by category' });
    }
};

export const getGarmentsByFabric = async (req, res) => {
    try {
        const { fabric } = req.params;

        if (!fabric) {
            return res.status(400).json({ message: 'Fabric is required' });
        }
        const wardrobe = await DigitalWardrobe.findOne({ userId: req.user._id });

        if (!wardrobe || wardrobe.garments.length === 0) {
            return res.status(404).json({ message: 'No garments found in wardrobe' });
        }

        const filtered = wardrobe.garments.filter(g => g.fabric === fabric);

        res.json(filtered);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch garments by fabric' });
    }
}

export const getGarmentsByOccasion = async (req, res) => {
    try {
        const { occasion } = req.params;

        if (!occasion) {
            return res.status(400).json({ message: 'Occasion is required' });
        }
        const wardrobe = await DigitalWardrobe.findOne({ userId: req.user._id });

        if (!wardrobe || wardrobe.garments.length === 0) {
            return res.status(404).json({ message: 'No garments found in wardrobe' });
        }

        const filtered = wardrobe.garments.filter(g => g.occasion.includes(occasion));

        res.json(filtered);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch garments by occasion' });
    }
}