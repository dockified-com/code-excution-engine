import { ServiceUnavailableException } from '@nestjs/common';
import { PistonClient } from './piston.client';

describe('PistonClient', () => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.PISTON_URL;
  const originalHttpTimeout = process.env.PISTON_HTTP_TIMEOUT_MS;

  beforeEach(() => {
    process.env.PISTON_URL = 'http://piston:2000';
    process.env.PISTON_HTTP_TIMEOUT_MS = '5000';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.PISTON_URL = originalUrl;
    process.env.PISTON_HTTP_TIMEOUT_MS = originalHttpTimeout;
  });

  describe('run', () => {
    it('POSTs execute and maps stdout from wire JSON', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            language: 'javascript',
            version: '18.15.0',
            run: {
              stdout: '2\n',
              stderr: '',
              code: 0,
              signal: null,
              status: null,
            },
          }),
      });

      const client = new PistonClient();
      const res = await client.run({
        language: 'javascript',
        version: '*',
        files: [{ content: 'console.log(1+1)' }],
        stdin: '',
        runTimeoutMs: 3000,
      });

      expect(res.stdout).toBe('2\n');
      expect(res.stderr).toBe('');
      expect(res.code).toBe(0);
      expect(res.signal).toBeNull();
      expect(res.engineStatus).toBeNull();
      expect(res.language).toBe('javascript');
      expect(res.version).toBe('18.15.0');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://piston:2000/api/v2/execute',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [
        string,
        RequestInit,
      ];
      const body = JSON.parse(init.body as string) as {
        language: string;
        version: string;
        files: { content: string }[];
        stdin: string;
        run_timeout: number;
      };
      expect(body).toEqual({
        language: 'javascript',
        version: '*',
        files: [{ content: 'console.log(1+1)' }],
        stdin: '',
        run_timeout: 3000,
      });
    });

    it('maps engineStatus from Piston run.status', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            language: 'javascript',
            version: '18.15.0',
            run: {
              stdout: '',
              stderr: 'Time limit exceeded',
              code: null,
              signal: 'SIGKILL',
              status: 'TO',
            },
          }),
      });

      const client = new PistonClient();
      const res = await client.run({
        language: 'javascript',
        version: '*',
        files: [{ content: 'while(true){}' }],
        stdin: '',
        runTimeoutMs: 1000,
      });

      expect(res.engineStatus).toBe('TO');
      expect(res.signal).toBe('SIGKILL');
      expect(res.code).toBeNull();
    });

    it('strips trailing slash from PISTON_URL', async () => {
      process.env.PISTON_URL = 'http://piston:2000/';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            language: 'javascript',
            version: '1',
            run: {
              stdout: '',
              stderr: '',
              code: 0,
              signal: null,
            },
          }),
      });

      const client = new PistonClient();
      await client.run({
        language: 'javascript',
        version: '*',
        files: [{ content: '' }],
        stdin: '',
        runTimeoutMs: 1000,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://piston:2000/api/v2/execute',
        expect.any(Object),
      );
    });

    it('throws ServiceUnavailableException on non-OK HTTP', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'engine overloaded' }),
      });

      const client = new PistonClient();
      await expect(
        client.run({
          language: 'javascript',
          version: '*',
          files: [{ content: 'x' }],
          stdin: '',
          runTimeoutMs: 1000,
        }),
      ).rejects.toThrow(ServiceUnavailableException);

      await expect(
        client.run({
          language: 'javascript',
          version: '*',
          files: [{ content: 'x' }],
          stdin: '',
          runTimeoutMs: 1000,
        }),
      ).rejects.toThrow('engine overloaded');
    });

    it('throws ServiceUnavailableException on network failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed'));

      const client = new PistonClient();
      await expect(
        client.run({
          language: 'javascript',
          version: '*',
          files: [{ content: 'x' }],
          stdin: '',
          runTimeoutMs: 1000,
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('listRuntimes', () => {
    it('GETs runtimes and maps to RunnerRuntime[]', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve([
            {
              language: 'javascript',
              version: '18.15.0',
              aliases: ['node-javascript', 'js', 'node'],
              runtime: 'node',
            },
          ]),
      });

      const client = new PistonClient();
      const runtimes = await client.listRuntimes();

      expect(runtimes).toEqual([
        {
          language: 'javascript',
          version: '18.15.0',
          aliases: ['node-javascript', 'js', 'node'],
        },
      ]);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://piston:2000/api/v2/runtimes',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('throws ServiceUnavailableException when runtimes fail', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({}),
      });

      const client = new PistonClient();
      await expect(client.listRuntimes()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
