import { Link } from 'react-router-dom';
import placeholderImage from '@backend/informaton-images/placeholder.svg';
import nicholasImage from '@backend/informaton-images/nblackson.jpeg';

type TeamMember = {
  name: string;
  role: string;
  bio: string;
  initials: string;
  image?: string;
  pronouns?: string;
  interests: string[];
  links?: Record<string, string>;
};

const teamMembers: TeamMember[] = [
  {
    name: 'Bryce Lastname',
    role: 'CEO',
    bio: 'Placeholder',
    initials: 'BL',
    image: placeholderImage,
    pronouns: 'He/Him',
    interests: ['Placeholder', 'Placeholder', 'Placeholder'],
    links: { github: 'Placeholder' }
  },
  {
    name: 'Nicholas Blackson',
    role: 'Lead Developer',
    bio: 'Nicholas brings a deep appreciation for robust systems and practical engineering, often connecting the discipline of embedded work with the flexibility of modern web applications.',
    initials: 'NB',
    image: nicholasImage,
    pronouns: 'He/Him/His',
    interests: ['Hiking', 'Cooking', 'Traveling', 'Family'],
    links: { github: 'http://github.com/TwoFang173', linkedin: 'http://www.linkedin.com/in/nblackson' }
  }
];

function renderLinks(links?: Record<string, string>) {
  if (!links) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(links).map(([label, url]) => (
        <a
          key={label}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700 transition hover:bg-brand-50"
        >
          {label}
        </a>
      ))}
    </div>
  );
}

export function AboutPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="max-w-3xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">About DroneSMS</p>
          <h1 className="text-3xl font-semibold tracking-tight text-brand-900">A team-built operations platform with a human-centered approach.</h1>
          <p className="text-sm leading-7 text-slate-600">
            DroneSMS was created to help operational teams manage planning, safety, document retention, and day-to-day execution in one place. The experience is designed to feel clear and practical, whether a crew is reviewing a proposal, preparing a mission packet, or closing out a completed job.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-brand-900">Meet the team</h2>
            <p className="mt-1 text-sm text-slate-600">The people behind the platform are shaping it around thoughtful operations, dependable systems, and a strong sense of collaboration.</p>
          </div>
          <Link to="/dashboard" className="text-sm font-semibold text-brand-700 transition hover:text-brand-900">
            Return to dashboard
          </Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {teamMembers.map((member) => (
            <article key={member.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">{member.role}</p>
                  <h3 className="mt-1 text-lg font-semibold text-brand-900">{member.name}</h3>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">
                  {member.initials}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-4">
                {member.image ? (
                  <img
                    src={member.image}
                    alt={member.name}
                    className="h-20 w-20 rounded-full border border-slate-200 object-cover shadow-sm"
                  />
                ) : null}
                <p className="text-sm leading-7 text-slate-700">{member.bio}</p>
              </div>

              {member.pronouns ? (
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Pronouns • {member.pronouns}</p>
              ) : null}

              {member.interests.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {member.interests.map((interest) => (
                    <span key={interest} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                      {interest}
                    </span>
                  ))}
                </div>
              ) : null}

              {renderLinks(member.links)}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
