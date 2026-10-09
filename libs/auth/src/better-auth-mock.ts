import { SetMetadata } from '@nestjs/common';

export const AllowAnonymous = () => SetMetadata('allowAnonymous', true);
export const OptionalAuth = () => SetMetadata('optionalAuth', true);
export const AuthModule = {
  forRoot: () => ({ module: class AuthModuleMock {} }),
  forRootAsync: () => ({ module: class AuthModuleMock {} }),
};
