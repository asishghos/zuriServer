import {addEvent, updateEvent, deleteEvent, getEventDetails, styleForEvent, fetchAllEvents } from '../controllers/events.controllers.js';
import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware.js';

const router = Router();

// Route to add a new event
router.post("/addEvent", verifyJWT, addEvent);
// Route to update an existing event
router.patch("/updateEvent/:id", verifyJWT, updateEvent);
// Route to delete an event
router.delete("/deleteEvent/:id", verifyJWT, deleteEvent);
// Route to get details of an event
router.get("/getEventDetails/:id", verifyJWT, getEventDetails);
// Route to get styled images for an event
// router.post("/styleForEvent/:id", verifyJWT, styleForEvent);
// Route to get all events for a user
router.get("/getAllEvents", verifyJWT, fetchAllEvents);

export default router;
