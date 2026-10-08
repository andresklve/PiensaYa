import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

const build = (username: unknown) =>
  plainToInstance(RegisterDto, {
    username,
    password: 'Password123',
    firstName: 'Juan',
    lastName: 'Perez',
  });

describe('RegisterDto - username', () => {
  it('normaliza a minúsculas y quita espacios', async () => {
    const dto = build('  Carlos_Andres ');
    expect(dto.username).toBe('carlos_andres');
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each(['ab', 'a'.repeat(31), 'con espacio', 'carlos@upc.edu.pe', 'ñandú'])(
    'rechaza "%s"',
    async (username) => {
      const errors = await validate(build(username));
      expect(errors.map((e) => e.property)).toContain('username');
    },
  );

  it.each(['u202320371', 'parrish', 'carlos.andres', 'ana_gomez'])(
    'acepta "%s"',
    async (username) => {
      expect(await validate(build(username))).toHaveLength(0);
    },
  );
});
