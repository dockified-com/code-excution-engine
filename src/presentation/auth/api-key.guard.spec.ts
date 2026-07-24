import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

function mockContext(authHeader?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { authorization: authHeader },
      }),
    }),
  } as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  const original = process.env.API_KEYS;

  beforeEach(() => {
    process.env.API_KEYS = 'secret-a,secret-b';
  });

  afterAll(() => {
    process.env.API_KEYS = original;
  });

  it('allows valid bearer key', () => {
    const guard = new ApiKeyGuard();
    expect(guard.canActivate(mockContext('Bearer secret-a'))).toBe(true);
  });

  it('sets clientId to the key on success', () => {
    const req: { headers: { authorization?: string }; clientId?: string } = {
      headers: { authorization: 'Bearer secret-b' },
    };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as ExecutionContext;

    const guard = new ApiKeyGuard();
    expect(guard.canActivate(ctx)).toBe(true);
    expect(req.clientId).toBe('secret-b');
  });

  it('rejects missing header', () => {
    const guard = new ApiKeyGuard();
    expect(() => guard.canActivate(mockContext(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects wrong key', () => {
    const guard = new ApiKeyGuard();
    expect(() => guard.canActivate(mockContext('Bearer nope'))).toThrow(
      UnauthorizedException,
    );
  });
});
