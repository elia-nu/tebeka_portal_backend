import * as Joi from 'joi';

export interface SignAgreementDto {
  nonCircumventionAck: boolean;
  platformFeeAck: boolean;
  confidentialityAck: boolean;
  signerName: string;
}

export const SignAgreementSchema = Joi.object({
  nonCircumventionAck: Joi.boolean().valid(true).required().messages({
    'any.only': 'You must acknowledge and agree to the Non-Circumvention clause.',
    'any.required': 'Non-circumvention acknowledgement is required.',
  }),
  platformFeeAck: Joi.boolean().valid(true).required().messages({
    'any.only': 'You must acknowledge and agree to the Platform Escrow & Fee clause.',
    'any.required': 'Platform fee acknowledgement is required.',
  }),
  confidentialityAck: Joi.boolean().valid(true).required().messages({
    'any.only': 'You must acknowledge and agree to the Confidentiality and Professional Conduct clause.',
    'any.required': 'Confidentiality acknowledgement is required.',
  }),
  signerName: Joi.string().trim().min(2).max(100).required().messages({
    'string.min': 'Signer legal name must be at least 2 characters.',
    'any.required': 'Signer legal name is required.',
  }),
});

export interface DeclineAgreementDto {
  reason: string;
}

export const DeclineAgreementSchema = Joi.object({
  reason: Joi.string().trim().min(5).max(500).required().messages({
    'string.min': 'Decline reason must be at least 5 characters.',
    'any.required': 'Decline reason is required.',
  }),
});
