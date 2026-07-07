'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

function readCookie(name: string): string | null {
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!match) return null;
  const value = match.slice(name.length + 1);
  return decodeURIComponent(value);
}

export function AuthGateway() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const [login, setLogin] = useState({ email: '', password: '' });
  const [register, setRegister] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    organizationName: ''
  });

  async function initCsrfToken(): Promise<string | null> {
    try {
      await fetch('/api/auth/csrf', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store'
      });
    } catch {
      // Surface a friendly auth error on submit instead of throwing here.
    }

    const tokenFromCookie = readCookie(CSRF_COOKIE);
    setCsrfToken(tokenFromCookie);
    return tokenFromCookie;
  }

  useEffect(() => {
    void initCsrfToken();
  }, []);

  async function submitLogin() {
    setLoading(true);
    setError(null);
    try {
      const token = csrfToken ?? (await initCsrfToken());
      if (!token) {
        setError('Could not initialize secure session token. Refresh and try again.');
        return;
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          [CSRF_HEADER]: token
        },
        body: JSON.stringify(login)
      });
      const body = await res.json();
      if (!body.ok) {
        setError(body.error?.message ?? 'Login failed');
        return;
      }
      window.location.href = '/dealer';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function submitRegister() {
    setLoading(true);
    setError(null);
    try {
      const token = csrfToken ?? (await initCsrfToken());
      if (!token) {
        setError('Could not initialize secure session token. Refresh and try again.');
        return;
      }

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          [CSRF_HEADER]: token
        },
        body: JSON.stringify(register)
      });
      const body = await res.json();
      if (!body.ok) {
        setError(body.error?.message ?? 'Registration failed');
        return;
      }
      window.location.href = '/dealer';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-3xl border border-border bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">DealerOS AI</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight">Production Dealer Dashboard</h1>
          <p className="mt-4 max-w-xl text-neutral-600">
            Acquire, value, and sell faster with live inventory management, VIN intelligence, CRM workflows, deal pipeline automation, and multichannel marketplace operations.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {['Inventory Control', 'VIN Decoder + AI', 'Customer CRM', 'Deal Pipeline', 'Auction Integrations', 'Analytics + Alerts'].map((item) => (
              <div key={item} className="rounded-xl border border-border bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700">{item}</div>
            ))}
          </div>
        </section>

        <Card className="p-6">
          <div className="mb-5 flex gap-2 rounded-lg bg-neutral-100 p-1">
            <button className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${mode === 'login' ? 'bg-white shadow-sm' : ''}`} onClick={() => setMode('login')}>Login</button>
            <button className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${mode === 'register' ? 'bg-white shadow-sm' : ''}`} onClick={() => setMode('register')}>Register</button>
          </div>

          {mode === 'login' ? (
            <div className="grid gap-3">
              <input type="hidden" name="csrfToken" value={csrfToken ?? ''} readOnly />
              <Input placeholder="Email" type="email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
              <Input placeholder="Password" type="password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
              <Button disabled={loading} onClick={submitLogin}>{loading ? 'Signing in...' : 'Sign in'}</Button>
            </div>
          ) : (
            <div className="grid gap-3">
              <input type="hidden" name="csrfToken" value={csrfToken ?? ''} readOnly />
              <Input placeholder="First name" value={register.firstName} onChange={(e) => setRegister({ ...register, firstName: e.target.value })} />
              <Input placeholder="Last name" value={register.lastName} onChange={(e) => setRegister({ ...register, lastName: e.target.value })} />
              <Input placeholder="Organization" value={register.organizationName} onChange={(e) => setRegister({ ...register, organizationName: e.target.value })} />
              <Input placeholder="Email" type="email" value={register.email} onChange={(e) => setRegister({ ...register, email: e.target.value })} />
              <Input placeholder="Password" type="password" value={register.password} onChange={(e) => setRegister({ ...register, password: e.target.value })} />
              <Button disabled={loading} onClick={submitRegister}>{loading ? 'Creating account...' : 'Create account'}</Button>
            </div>
          )}

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </Card>
      </div>
    </main>
  );
}
