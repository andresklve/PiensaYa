'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AuthLayout } from '@/components/auth-layout';
import { Button, ErrorText, Input, Label, TextLink } from '@/components/ui';

const USERNAME_PATTERN = '[a-zA-Z0-9_.]{3,30}';

export default function RegistroPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(form);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-[32px] font-extrabold leading-tight tracking-[-0.02em]">
        Abre tu <span className="mark">cuaderno</span>
      </h1>
      <p className="mt-2 text-fg-muted">Solo necesitas un nombre de usuario y una contraseña.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-3">
          <div>
            <Label htmlFor="firstName">Nombre</Label>
            <Input id="firstName" value={form.firstName} onChange={set('firstName')} autoComplete="given-name" required />
          </div>
          <div>
            <Label htmlFor="lastName">Apellido</Label>
            <Input id="lastName" value={form.lastName} onChange={set('lastName')} autoComplete="family-name" required />
          </div>
        </div>
        <div>
          <Label htmlFor="username" hint="3–30 · letras, números, _ o .">
            Usuario
          </Label>
          <Input
            id="username"
            value={form.username}
            onChange={set('username')}
            placeholder="tu_usuario"
            autoComplete="username"
            autoCapitalize="none"
            pattern={USERNAME_PATTERN}
            title="De 3 a 30 caracteres: letras, números, guion bajo o punto"
            required
          />
        </div>
        <div>
          <Label htmlFor="password" hint="Mínimo 8 caracteres">
            Contraseña
          </Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <ErrorText error={error} />

        <Button type="submit" disabled={busy} size="lg" className="w-full">
          {busy ? 'Creando cuenta…' : 'Crear cuenta'}
        </Button>
      </form>

      <p className="mt-10 text-[15px] text-fg-muted">
        ¿Ya tienes una cuenta?{' '}
        <TextLink href="/login">Inicia sesión</TextLink>
      </p>
    </AuthLayout>
  );
}
