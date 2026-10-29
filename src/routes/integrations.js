import { Router } from 'express';
import { receiveCalendlyWebhook } from '../controllers/calendlyWebhookController.js';
import { receiveZohoBooking } from '../controllers/zohoWebhookController.js';

const router = Router();
router.post('/zoho/bookings', receiveZohoBooking);
router.post('/calendly/webhooks', receiveCalendlyWebhook);

export default router;
