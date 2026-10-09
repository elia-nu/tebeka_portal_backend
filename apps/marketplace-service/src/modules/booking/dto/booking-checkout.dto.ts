import * as Joi from 'joi';

export interface BookingCheckoutDto {
  provider?: 'CHAPA' | 'STRIPE' | 'TELEBIRR' | 'CBE_BIRR';
  phone?: string;
  email?: string;
  returnUrl?: string;
  clientId?: string;
}

export const BookingCheckoutSchema = Joi.object({
  provider: Joi.string().valid('CHAPA', 'STRIPE', 'TELEBIRR', 'CBE_BIRR').optional(),
  phone: Joi.string().allow('', null).optional(),
  email: Joi.string().email().allow('', null).optional(),
  returnUrl: Joi.string().uri().allow('', null).optional(),
  clientId: Joi.string().allow('', null).optional(),
}).options({ allowUnknown: true, stripUnknown: true }).default({});
