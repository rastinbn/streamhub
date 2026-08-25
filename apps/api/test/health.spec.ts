import { HealthController } from '../src/health/health.controller';

describe('HealthController', () => {
  it('returns an ok status', () => {
    const controller = new HealthController();
    const result = controller.check();
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('ok');
  });
});
