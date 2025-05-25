import express from "express";
import { analyzeAuto, analyzeManual, analyzeHybrid } from "../controllers/analyze.controllers.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

router.post("/auto", upload.single("image"), analyzeAuto);
router.post("/manual", analyzeManual);
router.post("/hybrid", upload.single("image"), analyzeHybrid);

export default router;