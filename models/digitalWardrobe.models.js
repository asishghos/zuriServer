import mongoose from 'mongoose';

const GarmentSchema = new mongoose.Schema({
    // imageUrl: {
    //     type: String,
    //     required: true,
    // },
    category: {
        type: [String],      // e.g., "Top", "Bottom", "Dress", etc.
        required: true
    },
    color: {
        name: String
    },
    fabric: {
        type: String,      // e.g., "Cotton", "Silk", etc.
        required: true
    },
    pattern: {
        type: String,      // e.g., "Solid", "Striped", "Floral"
    },
    ai_tags: {
        type: [String],   // e.g., "Casual", "Formal", etc.
    },
    occasion: {
        type: [String],    // e.g., ["Casual", "Office", "Party"]
        required: true
    },
    season: {
        type: [String],    
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const DigitalWardrobeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        unique: true,
        required: true,
    },
    garments: [GarmentSchema],
}, {
    timestamps: true
});

export const DigitalWardrobe = mongoose.model('DigitalWardrobe', DigitalWardrobeSchema);