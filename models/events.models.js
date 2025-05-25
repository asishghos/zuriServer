import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    name: {
        type: String,
        required: true,
    },
    dayTime: {
        type: String,
        enum: ['morning', 'afternoon', 'evening', 'night'],
        default: 'evening',
    },
    date: {
        type: Date,
        required: true,
    },
    occasion: {
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
    isStyled: {
        type: Boolean,
        default: false,
    },
    generatedImages: [
        {
            type: String, // can be base64 string or a public URL
        }
    ],
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export const Event = mongoose.model('Event', eventSchema);