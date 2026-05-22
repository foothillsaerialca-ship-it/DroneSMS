import { Link } from 'react-router-dom';

export function LoginPage() {
  return (
    <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 className="text-xl font-semibold text-brand-900">Pilot Login</h1>
      <p className="mt-2 text-sm text-slate-600">Sign in placeholder for Phase 1 authentication flow.</p>
      <form className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="email" placeholder="pilot@company.com" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="password" placeholder="••••••••" />
        </label>
        <button type="button" className="w-full rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white">Sign In</button>
      </form>
      <p className="mt-4 text-sm text-slate-600">Need an account? <Link className="text-brand-700" to="/register">Register</Link></p>
    </section>
  );
}
