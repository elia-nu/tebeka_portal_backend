import { SubmitAmendmentSchema } from './dto/attorney.dto';

describe('SubmitAmendmentSchema - lawFirmName preservation', () => {
  it('should accept and preserve lawFirmName in amendment submission payload', () => {
    const payload = {
      amendmentReply: 'Updated office and firm details as requested',
      lawFirmName: 'Solomon & Associates Law Firm PLC',
      officeAddress: 'Bole Road, Mega Building 5th Floor',
      consultationFee: 2000,
    };

    const { error, value } = SubmitAmendmentSchema.validate(payload, { stripUnknown: true });
    expect(error).toBeUndefined();
    expect(value.lawFirmName).toBe('Solomon & Associates Law Firm PLC');
    expect(value.officeAddress).toBe('Bole Road, Mega Building 5th Floor');
    expect(value.consultationFee).toBe(2000);
  });

  it('should allow lawFirmName to be optional', () => {
    const payload = {
      amendmentReply: 'Only updating consultation fee',
      consultationFee: 1500,
    };

    const { error, value } = SubmitAmendmentSchema.validate(payload, { stripUnknown: true });
    expect(error).toBeUndefined();
    expect(value.lawFirmName).toBeUndefined();
    expect(value.consultationFee).toBe(1500);
  });
});
