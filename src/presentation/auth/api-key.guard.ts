import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { getApiKeys } from '../../config/env';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      clientId?: string;
    }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }
    const key = header.slice('Bearer '.length).trim();
    const keys = getApiKeys();
    if (!keys.length || !keys.includes(key)) {
      throw new UnauthorizedException('Invalid API key');
    }
    req.clientId = key;
    return true;
  }
}
