import express from "express";
import { upload } from "../middleware/upload.js";
import { imageCheck } from "../controllers/checkimage.controllers.js";

const router = express.Router();

router.post("/", upload.single("image"), imageCheck);

export default router;