import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/components/use-auth';
import { supabase } from '../../../integrations/supabase/client';

const dashboardCards = [
  {
    title: 'Safety Status',
    value: 'Ready',
    detail: 'No active site warnings for today.',
    accent: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  {
    title: 'Open Jobs',
    value: '3',
    detail: '2 scheduled, 1 awaiting review.',
    accent: 'bg-blue-50 text-brand-700 border-blue-200'
  },
  {
    title: 'Recent Hazard Reports',
    value: '1',
    detail: 'Latest report needs pilot acknowledgement.',
    accent: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  {
    title: 'Aircraft/Pilot Readiness',
    value: '92%',
    detail: 'Pilot documents and aircraft checks mostly current.',
    accent: 'bg-slate-100 text-slate-700 border-slate-200'
  }
];

export function DashboardPage() {
  const { session } = useAuth();
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isLoadingCompany, setIsLoadingCompany] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadCompanyName() {
      if (!session?.user?.id) {
        setIsLoadingCompany(false);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('company_name')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!isMounted) return;

      setCompanyName(data?.company_name ?? null);
      setIsLoadingCompany(false);
    }

    void loadCompanyName();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  const displayName = isLoadingCompany ? 'Loading company...' : companyName ?? 'Your flight operation';

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Dashboard</p>
            <h1 className="mt-1 text-2xl font-semibold text-brand-900">{displayName}</h1>
            <p className="mt-2 text-sm text-slate-600">Today&apos;s safety, job, and readiness snapshot.</p>
          </div>
          <Link
            to="/jobs"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 sm:min-h-0 sm:py-2"
          >
            Create Job
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {dashboardCards.map((card) => (
          <article key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-semibold text-brand-900">{card.title}</h2>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${card.accent}`}>{card.value}</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{card.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
