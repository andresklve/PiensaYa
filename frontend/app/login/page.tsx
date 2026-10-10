'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AuthLayout } from '@/components/auth-layout';
import { Button, ErrorText, Input, Label, TextLink } from '@/components/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username, password);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-[32px] font-extrabold leading-tight tracking-[-0.02em]">
        Vuelve a tu <span className="mark">cuaderno</span>
      </h1>
      <p className="mt-2 text-fg-muted">Inicia sesión con tu nombre de usuario.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div>
          <Label htmlFor="username">Usuario</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="tu_usuario"
            autoComplete="username"
            autoCapitalize="none"
            required
          />
        </div>
        <div>
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <ErrorText error={error} />

        <Button type="submit" disabled={busy} size="lg" className="w-full">
          {busy ? 'Entrando…' : 'Iniciar sesión'}
        </Button>
      </form>

      <p className="mt-10 text-[15px] text-fg-muted">
        ¿No tienes una cuenta?{' '}
        <TextLink href="/registro">Regístrate</TextLink>
      </p>
    </AuthLayout>
  );
}
