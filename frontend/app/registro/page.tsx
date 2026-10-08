'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, ErrorText, Input, Label } from '@/components/ui';

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
    <Card className="mt-8">
      <h1 className="text-lg font-bold">Crear cuenta</h1>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div>
          <Label>Usuario (3-30 caracteres: letras, números, _ o .)</Label>
          <Input
            value={form.username}
            onChange={set('username')}
            placeholder="carlos_andres"
            autoComplete="username"
            required
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label>Nombre</Label>
            <Input value={form.firstName} onChange={set('firstName')} required />
          </div>
          <div className="flex-1">
            <Label>Apellido</Label>
            <Input value={form.lastName} onChange={set('lastName')} required />
          </div>
        </div>
        <div>
          <Label>Contraseña (mínimo 8 caracteres)</Label>
          <Input
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete="new-password"
            required
          />
        </div>
        <ErrorText error={error} />
        <Button type="submit" disabled={busy}>
          {busy ? 'Creando...' : 'Crear cuenta'}
        </Button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="underline">
          Inicia sesión
        </Link>
      </p>
    </Card>
  );
}
