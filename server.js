// import express from "express";
// import { config } from "dotenv";
// import analyzeRoutes from "./routes/analyze.routes.js";
// import productRoutes from "./routes/products.routes.js";
// import imageRoutes from "./routes/imagegenerate.routes.js";
// import { cleanupCache } from "./utils/cache.js";

// config();

// const app = express();
// app.use(express.json());

// app.get("/", (req, res) => {
//   res.send("Welcome to the Fashion AI server.");
// });

// // Routes
// app.use("/api/analyze", analyzeRoutes);
// app.use("/api/products", productRoutes);
// app.use("/api/image", imageRoutes);

// // Cache cleanup interval
// setInterval(cleanupCache, 15 * 60 * 1000);

// app.listen(3000, "0.0.0.0", () => {
//   console.log("Server running on http://localhost:3000");
// });

// export default app;