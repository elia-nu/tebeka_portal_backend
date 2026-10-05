import { PipeTransform, Injectable, BadRequestException, ArgumentMetadata } from '@nestjs/common';
import { ObjectSchema } from 'joi';

@Injectable()
export class JoiValidationPipe implements PipeTransform {
  constructor(private schema: ObjectSchema) {}

  transform(value: any, metadata?: ArgumentMetadata) {
    if (!this.schema) {
      return value;
    }

    if (metadata && metadata.type === 'param' && typeof value === 'string') {
      return value;
    }

    if (metadata && metadata.type === 'query' && (!value || Object.keys(value).length === 0)) {
      return value;
    }

    const { error, value: transformedValue } = this.schema.validate(value, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorDetails = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Validation failed: ${error.details.map((d) => d.message).join(', ')}`,
        details: errorDetails,
      });
    }

    return transformedValue;
  }
}
