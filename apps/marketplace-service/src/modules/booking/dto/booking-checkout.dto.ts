import * as Joi from 'joi';

export interface BookingCheckoutDto {
  provider?: 'CHAPA' | 'STRIPE' | 'TELEBIRR' | 'CBE_BIRR';
  phone?: string;
  email?: string;
  returnUrl?: string;
}

export const BookingCheckoutSchema = Joi.object({
  provider: Joi.string().valid('CHAPA', 'STRIPE', 'TELEBIRR', 'CBE_BIRR').optional(),
  phone: Joi.string().optional(),
  email: Joi.string().email().optional(),
  returnUrl: Joi.string().uri().optional(),
}).options({ allowUnknown: true, stripUnknown: true });
