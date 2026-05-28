import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/use-auth';

export function RegisterPage() {
  const { signUpWithPassword, status } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/dashboard', { replace: true });
    }
  }, [status, navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const result = await signUpWithPassword(email, password);

    setIsSubmitting(false);

    if (result.errorMessage) {
      setError(result.errorMessage);
      return;
    }

    setSuccessMessage('Account created. If email confirmation is enabled, check your inbox.');
    navigate('/dashboard', { replace: true });
  }

  return (
    <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 className="text-xl font-semibold text-brand-900">Operator Registration</h1>
      <p className="mt-2 text-sm text-slate-600">Create your account to access DroneSMS.</p>
      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="pilot@company.com" required />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Create password" required minLength={8} />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
        <button disabled={isSubmitting} type="submit" className="w-full rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">{isSubmitting ? 'Creating…' : 'Create Account'}</button>
      </form>
      <p className="mt-4 text-sm text-slate-600">Already registered? <Link className="text-brand-700" to="/login">Sign in</Link></p>
    </section>
  );
}
