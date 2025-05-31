import mongoose from "mongoose";

export const connectDB = async() => {
    try {
        const conn = await mongoose.connect('mongodb://localhost:27017/test1');
        console.log("Database connected successfully");
    } catch (err) {
        console.error(`Error: mongo dp peoblem ${err.message}`);
    }
}