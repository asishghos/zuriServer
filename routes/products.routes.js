import express from "express";
import { getProducts } from "../controllers/product.controllers.js";
// import { getNykaaProducts } from "../controllers/product.controllers/product.nykaa.controllers.js";

const router = express.Router();

router.post("/", getProducts);
// router.post("/nykaa", getNykaaProducts);

export default router;