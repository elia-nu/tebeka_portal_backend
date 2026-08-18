import { PipeTransform, Injectable, BadRequestException, ArgumentMetadata } from '@nestjs/common';
import { ObjectSchema } from 'joi';

@Injectable()
export class JoiValidationPipe implements PipeTransform {
  constructor(private schema: ObjectSchema) {}

  transform(value: any, metadata?: ArgumentMetadata) {
    if (!this.schema) {
      return value;
    }

    // Skip validation for non-data parameters like @Req() req or @Res() res
    if (metadata && metadata.type !== 'query' && metadata.type !== 'body' && metadata.type !== 'param') {
      return value;
    }

    // Skip validation for empty query parameters if this pipe is validating a body schema
    if (metadata && metadata.type === 'query' && (!value || Object.keys(value).length === 0)) {
      return value;
    }

    const { error, value: validatedValue } = this.schema.validate(value, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map((detail) => detail.message).join(', ');
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Validation failed: ${messages}`,
        details: error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
    }

    return validatedValue;
  }
}
