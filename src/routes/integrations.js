import { Router } from 'express';
import { receiveZohoBooking } from '../controllers/zohoWebhookController.js';

const router = Router();
router.post('/zoho/bookings', receiveZohoBooking);

export default router;
