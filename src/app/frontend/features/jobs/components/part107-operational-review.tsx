import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@frontend/lib/supabase';

type RegulatoryInputs = {
  visibility_distance_sm: number | null;
  cloud_clearance_below_ft: number | null;
  cloud_horizontal_distance_ft: number | null;
  atc_authorization_status: string | null;
  atc_authorization_reference: string | null;
  atc_authorization_expires_at: string | null;
};

const emptyInputs: RegulatoryInputs = {
  visibility_distance_sm: null,
  cloud_clearance_below_ft: null,
  cloud_horizontal_distance_ft: null,
  atc_authorization_status: null,
  atc_authorization_reference: null,
  atc_authorization_expires_at: null,
};

function numberValue(value: number | null) {
  return value === null ? '' : String(value);
}

export function Part107OperationalReview() {
  const { jobId } = useParams();
  const [values, setValues] = useState(emptyInputs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!jobId) {
        setError('Job not found.');
        setLoading(false);
        return;
      }
      const { data, error: loadError } = await supabase
        .from('jha_assessments')
        .select('visibility_distance_sm, cloud_clearance_below_ft, cloud_horizontal_distance_ft, atc_authorization_status, atc_authorization_reference, atc_authorization_expires_at')
        .eq('job_id', jobId)
        .maybeSingle();
      if (!active) return;
      if (loadError) {
        setError(loadError.message);
      } else if (data) {
        setValues({ ...emptyInputs, ...data } as RegulatoryInputs);
      }
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [jobId]);

  function update<K extends keyof RegulatoryInputs>(key: K, value: RegulatoryInputs[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  async function save() {
    if (!jobId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { data, error: saveError } = await supabase
        .from('jha_assessments')
        .update({
          visibility_distance_sm: values.visibility_distance_sm,
          cloud_clearance_below_ft: values.cloud_clearance_below_ft,
          cloud_horizontal_distance_ft: values.cloud_horizontal_distance_ft,
          atc_authorization_status: values.atc_authorization_status,
          atc_authorization_reference: values.atc_authorization_reference?.trim() || null,
          atc_authorization_expires_at: values.atc_authorization_expires_at || null,
        })
        .eq('job_id', jobId)
        .select('job_id')
        .maybeSingle();
      if (saveError) throw saveError;
      if (!data) throw new Error('Save JHA progress before saving these operating checks.');
      setMessage('Part 107 operation checks saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save Part 107 operation checks.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <fieldset className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <legend className="px-1 text-sm font-semibold text-amber-950">Part 107 operating conditions and authorization</legend>
      <p className="mb-3 text-sm text-amber-900">
        Enter conditions observed at the control station. §107.51 requires at least 3 statute miles visibility and cloud clearance of 500 feet below and 2,000 feet horizontally. Check conditions again before and during flight.
      </p>
      {loading ? <p className="text-sm text-slate-600">Loading operation checks…</p> : (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Visibility (statute miles)
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" min="0" step="0.1" value={numberValue(values.visibility_distance_sm)} onChange={(event) => update('visibility_distance_sm', event.target.value === '' ? null : Number(event.target.value))} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Distance below clouds (feet)
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" min="0" value={numberValue(values.cloud_clearance_below_ft)} onChange={(event) => update('cloud_clearance_below_ft', event.target.value === '' ? null : Number(event.target.value))} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Horizontal cloud distance (feet)
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" min="0" value={numberValue(values.cloud_horizontal_distance_ft)} onChange={(event) => update('cloud_horizontal_distance_ft', event.target.value === '' ? null : Number(event.target.value))} />
          </label>
        </div>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            ATC authorization
            <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={values.atc_authorization_status ?? ''} onChange={(event) => update('atc_authorization_status', event.target.value || null)}>
              <option value="">Not recorded</option>
              <option value="Approved">Approved before operation</option>
              <option value="Not Approved">Not approved</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Authorization reference
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={values.atc_authorization_reference ?? ''} onChange={(event) => update('atc_authorization_reference', event.target.value)} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Authorization expiration (if any)
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="date" value={values.atc_authorization_expires_at ?? ''} onChange={(event) => update('atc_authorization_expires_at', event.target.value || null)} />
          </label>
          <p className="text-sm text-amber-900 sm:col-span-3">Class B, C, D, and Class E designated surface areas require prior ATC authorization. LAANC is one way to request authorization; a “No” or pending request is not an approval. For Class E, confirm this is a designated surface area for an airport. Save JHA progress after changing the airspace fields so the database evaluates the correct class.</p>
      </div>
      {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-green-800" role="status">{message}</p> : null}
      <button type="button" className="mt-3 min-h-10 rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-950 disabled:opacity-60" onClick={() => void save()} disabled={loading || saving}>
        {saving ? 'Saving…' : 'Save operating checks'}
      </button>
    </fieldset>
  );
}
