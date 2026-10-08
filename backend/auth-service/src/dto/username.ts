import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;

export const normalizeUsername = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

// Se guarda en minúsculas para que "Carlos" y "carlos" no sean dos cuentas distintas.
export function IsUsername(): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    Transform(({ value }) => normalizeUsername(value))(target, propertyKey);
    Matches(USERNAME_PATTERN, {
      message:
        'El usuario debe tener entre 3 y 30 caracteres: letras, números, "_" o "."',
    })(target, propertyKey);
  };
}
