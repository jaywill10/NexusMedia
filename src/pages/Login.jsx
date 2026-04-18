import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function Login() {
  const { login, register, needsSetup, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(needsSetup ? 'setup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (needsSetup) setMode('setup');
  }, [needsSetup]);

  useEffect(() => {
    if (isAuthenticated) {
      const from = params.get('from');
      try {
        if (from) {
          const url = new URL(from, window.location.origin);
          if (url.origin === window.location.origin) {
            navigate(url.pathname + url.search + url.hash, { replace: true });
            return;
          }
        }
      } catch { /* ignore */ }
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate, params]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'setup') {
        await register({ email, password, full_name: fullName });
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err?.data?.error || err?.message || 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-lg">
        <h1 className="text-2xl font-semibold mb-1">NexusMedia</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === 'setup'
            ? 'Create the first admin account.'
            : 'Sign in to continue.'}
        </p>
        <form onSubmit={submit} className="space-y-4">
          {mode === 'setup' && (
            <div>
              <label className="block text-sm font-medium mb-1">Display name</label>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              type="password"
              required
              minLength={mode === 'setup' ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
            />
            {mode === 'setup' && (
              <p className="text-xs text-muted-foreground mt-1">Minimum 8 characters.</p>
            )}
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary text-primary-foreground py-2 font-medium disabled:opacity-50"
          >
            {busy ? 'Please wait…' : mode === 'setup' ? 'Create admin account' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
