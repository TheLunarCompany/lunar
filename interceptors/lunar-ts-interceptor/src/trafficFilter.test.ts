
import { TrafficFilter } from './trafficFilter';

describe('TrafficFilter Internal & External IP Validation', () => {

  describe('isAllowed', () => {
    const trafficFilter = TrafficFilter.getInstance();
    trafficFilter.setManaged(false);

    it('should block Internal IP', () => {
      const internalIPs = [
        '192.168.0.0',
        '192.168.1.100',
        '10.0.0.0',
        '10.0.0.1',
        '172.16.0.0',
        '172.16.0.5',
        '192.168.0.1',
        '169.254.0.1',
        '127.0.0.1',
      ];


      for (const internalIP of internalIPs) {
        const isAllowed = trafficFilter.isAllowed(internalIP);
        expect(isAllowed).toBe(false);
      }

    });

    it('should allow External IP', () => {
      const externalIPs = [
        '203.0.113.2',
        '203.0.113.100',
        '104.16.249.5',
        '185.199.108.153',
        '8.8.8.8',
        '137.117.235.131',
      ];  
      
      for (const externalIP of externalIPs) {
        const isAllowed = trafficFilter.isAllowed(externalIP);
        expect(isAllowed).toBe(true);
      }
    });

    it('should allow by header', () => {
        let isAllowed = trafficFilter.isAllowed('somedomain.com', { "x-lunar-allow": 'true'});
        expect(isAllowed).toBe(true);

        isAllowed = trafficFilter.isAllowed('somedomain.com', { "x-lunar-allow": "true"});
        expect(isAllowed).toBe(true);
      });

    it('should disallow by header', () => {
      let isAllowed = trafficFilter.isAllowed('somedomain.com', { "x-lunar-allow": 'false'});
      expect(isAllowed).toBe(false);

      isAllowed = trafficFilter.isAllowed('somedomain.com', { "x-lunar-allow": "false"});
      expect(isAllowed).toBe(false);
    });
  });
});
