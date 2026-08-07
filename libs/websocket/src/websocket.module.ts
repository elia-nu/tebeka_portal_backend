import { Global, Module } from '@nestjs/common';
import { BaseWebsocketGateway } from './websocket.gateway';

@Global()
@Module({
  providers: [BaseWebsocketGateway],
  exports: [BaseWebsocketGateway],
})
export class WebsocketModule {}
