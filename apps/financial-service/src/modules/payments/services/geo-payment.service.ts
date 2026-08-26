import { Injectable, Logger } from '@nestjs/common';
import * as geoip from 'geoip-lite';

export interface GeoGatewayResolution {
  provider: 'CHAPA' | 'STRIPE';
  currency: 'ETB' | 'USD';
  country: string;
  countryName: string;
  isDomestic: boolean;
  availableProviders: string[];
  clientIp: string;
}

@Injectable()
export class GeoPaymentService {
  private readonly logger = new Logger(GeoPaymentService.name);

  /**
   * Resolves the user's client IP address from express request headers or connection.
   */
  extractClientIp(req: any): string {
    if (!req) return '127.0.0.1';

    // Support manual debug/override header for testing
    const overrideIp = req.headers?.['x-client-ip'] || req.headers?.['x-override-ip'];
    if (overrideIp) return String(overrideIp).trim();

    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      const parts = String(forwarded).split(',');
      const first = parts[0]?.trim();
      if (first) return first;
    }

    const cfConnectingIp = req.headers?.['cf-connecting-ip'];
    if (cfConnectingIp) return String(cfConnectingIp).trim();

    const realIp = req.headers?.['x-real-ip'];
    if (realIp) return String(realIp).trim();

    return req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
  }

  /**
   * Resolves payment gateway and currency based on IP and Geo-location.
   * If country is Ethiopia ('ET'), returns Chapa with ETB.
   * Outside Ethiopia, returns Stripe with USD.
   */
  resolveGateway(clientIp: string, overrideCountry?: string): GeoGatewayResolution {
    let countryCode = overrideCountry ? overrideCountry.toUpperCase() : null;

    // Check if IP is localhost / private loopback
    const isLocalhost =
      clientIp === '127.0.0.1' ||
      clientIp === '::1' ||
      clientIp === 'localhost' ||
      clientIp.startsWith('192.168.') ||
      clientIp.startsWith('10.');

    if (!countryCode) {
      if (isLocalhost) {
        // In local development default to Ethiopia (ET) unless specified
        countryCode = process.env.DEFAULT_DEV_COUNTRY || 'ET';
      } else {
        const geo = geoip.lookup(clientIp);
        countryCode = geo?.country || 'US';
      }
    }

    this.logger.log(`Resolved IP [${clientIp}] -> Country [${countryCode}]`);

    if (countryCode === 'ET' || countryCode === 'ETH') {
      return {
        provider: 'CHAPA',
        currency: 'ETB',
        country: 'ET',
        countryName: 'Ethiopia',
        isDomestic: true,
        availableProviders: ['CHAPA', 'TELEBIRR', 'CBE_BIRR', 'BOA'],
        clientIp,
      };
    }

    return {
      provider: 'STRIPE',
      currency: 'USD',
      country: countryCode,
      countryName: countryCode === 'US' ? 'United States' : countryCode,
      isDomestic: false,
      availableProviders: ['STRIPE'],
      clientIp,
    };
  }
}
