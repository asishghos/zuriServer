import express from "express";
import { generateImage } from "../controllers/imagegenerate.controllers.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

router.post("/generate", upload.single("image"), generateImage);

export default router;