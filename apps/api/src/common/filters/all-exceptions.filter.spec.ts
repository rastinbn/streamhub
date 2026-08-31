import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function createMockHost(url = '/api/v1/whatever') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = { url };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('maps an HttpException to its own status and message', () => {
    const { host, status, json } = createMockHost();

    filter.catch(new BadRequestException('Invalid payload'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ message: 'Invalid payload' }),
      }),
    );
  });

  it('maps an unknown/non-HTTP exception to a generic 500 without leaking details', () => {
    const { host, status, json } = createMockHost();

    filter.catch(new Error('some internal secret detail'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const payload = json.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.error.message).toBe('Internal server error');
    expect(payload.error.message).not.toMatch(/secret/i);
  });

  it('always includes the request path and an ISO timestamp', () => {
    const { host, json } = createMockHost('/api/v1/streams/123');

    filter.catch(new BadRequestException(), host);

    const payload = json.mock.calls[0][0];
    expect(payload.path).toBe('/api/v1/streams/123');
    expect(() => new Date(payload.timestamp).toISOString()).not.toThrow();
  });
});
