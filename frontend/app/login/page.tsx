'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, ErrorText, Input, Label } from '@/components/ui';

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
    <Card className="mt-8">
      <h1 className="text-lg font-bold">Iniciar sesión</h1>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div>
          <Label>Usuario</Label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="carlos_andres"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <Label>Contraseña</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <ErrorText error={error} />
        <Button type="submit" disabled={busy}>
          {busy ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        ¿No tienes cuenta?{' '}
        <Link href="/registro" className="underline">
          Regístrate
        </Link>
      </p>
    </Card>
  );
}
