import { FormEvent, useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/use-auth';

export function LoginPage() {
  const { signInWithPassword, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/dashboard', { replace: true });
    }
  }, [status, navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await signInWithPassword(email, password);

    setIsSubmitting(false);

    if (result.errorMessage) {
      setError(result.errorMessage);
      return;
    }

    const from = (location.state as { from?: string } | null)?.from;
    navigate(from || '/dashboard', { replace: true });
  }

  return (
    <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 className="text-xl font-semibold text-brand-900">Pilot Login</h1>
      <p className="mt-2 text-sm text-slate-600">Sign in to continue to your operational dashboard.</p>
      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="pilot@company.com" required />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button disabled={isSubmitting} type="submit" className="w-full rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">{isSubmitting ? 'Signing in…' : 'Sign In'}</button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Need an account?{' '}
        <NavLink className="inline-block text-brand-700 underline underline-offset-2" to="/register">
          Register
        </NavLink>
      </p>
    </section>
  );
}
