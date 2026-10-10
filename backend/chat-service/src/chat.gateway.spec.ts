import { JwtService } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

describe('ChatGateway', () => {
  let gateway: ChatGateway;

  beforeEach(() => {
    gateway = new ChatGateway({} as JwtService, {} as ChatService);
  });

  describe('isRateLimited', () => {
    it('deja pasar 30 mensajes por minuto y frena el 31', () => {
      const now = 1_000_000;
      for (let i = 0; i < 30; i++) {
        expect(gateway.isRateLimited('u1', now + i)).toBe(false);
      }
      expect(gateway.isRateLimited('u1', now + 30)).toBe(true);
      // Otro usuario no se ve afectado.
      expect(gateway.isRateLimited('u2', now + 30)).toBe(false);
    });

    it('libera el cupo cuando pasa el minuto', () => {
      const now = 1_000_000;
      for (let i = 0; i < 30; i++) gateway.isRateLimited('u1', now);
      expect(gateway.isRateLimited('u1', now + 60_001)).toBe(false);
    });
  });
});
