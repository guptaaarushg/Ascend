import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import studentHero from "@/assets/ascend-student-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ascend: opportunities matched to your profile" },
      { name: "description", content: "Ascend helps every student discover, understand, and pursue scholarships, internships, research programs, and fellowships matched to their background, goals, and potential." },
      { property: "og:title", content: "Ascend: opportunities matched to your profile" },
      { property: "og:description", content: "Talent is everywhere. Opportunity is not. Ascend closes the information gap for every student." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Ascend",
          applicationCategory: "EducationalApplication",
          operatingSystem: "Any",
          description:
            "Ascend matches students to scholarships, internships, research programs, and fellowships they are actually eligible for, and shows the real cost of applying.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          audience: { "@type": "EducationalAudience", educationalRole: "student" },
          author: { "@type": "Person", name: "Aarush Gupta" },
        }),
      },
    ],
  }),
  component: Landing,
});


const steps = [
  { n: "01", title: "Create Your Profile" },
  { n: "02", title: "Get Personalized Matches" },
  { n: "03", title: "Get Guided Applications" },
  { n: "04", title: "Track Your Progress and Ascend" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* NAV */}
      <nav className="absolute inset-x-0 top-0 z-20 mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-5 py-5 text-primary-foreground sm:px-10 sm:py-7 lg:px-16">
        <span className="text-2xl font-serif font-semibold">Ascend</span>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Button asChild variant="ghost" className="text-primary-foreground hover:bg-background/15 hover:text-primary-foreground">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild className="bg-background text-foreground shadow-none hover:bg-background/90">
            <Link to="/auth">Get started</Link>
          </Button>
        </div>
      </nav>

      {/* HERO */}
      <header className="relative flex min-h-[88vh] items-end overflow-hidden bg-foreground text-primary-foreground">
        <img src={studentHero} alt="A high school student planning her next opportunity at a library" width={1600} height={1008} className="absolute inset-0 size-full object-cover object-[62%_center]" />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_oklch,var(--foreground)_93%,transparent)_0%,color-mix(in_oklch,var(--foreground)_75%,transparent)_48%,color-mix(in_oklch,var(--foreground)_12%,transparent)_100%)]" />
        <div className="relative mx-auto w-full max-w-screen-2xl px-5 pb-12 pt-32 sm:px-10 sm:pb-16 lg:px-16 lg:pb-20">
          <div className="max-w-3xl animate-fade-in">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-peach-soft">A free opportunity engine for students</p>
            <h1 className="text-6xl font-serif font-semibold leading-none sm:text-7xl lg:text-8xl">Ascend</h1>
            <p className="mt-5 max-w-2xl text-3xl font-semibold leading-tight text-balance sm:text-4xl lg:text-5xl">
              Talent is everywhere. The right opportunity should be too.
            </p>
            <p className="mt-6 max-w-xl text-base leading-7 text-primary-foreground/85 sm:text-lg">
              Find scholarships, research programs, internships, and competitions that fit who you are and where you want to go.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 bg-primary text-primary-foreground hover:bg-primary/90">
                <Link to="/auth">Build my free profile</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 border-primary-foreground/50 bg-transparent text-primary-foreground hover:bg-background/15 hover:text-primary-foreground">
                <Link to="/auth">Explore opportunities</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-screen-2xl gap-6 px-5 py-10 sm:px-10 md:grid-cols-3 lg:px-16">
          <p className="text-xl font-semibold leading-snug sm:text-2xl">One profile. Thousands of possible next steps.</p>
          <p className="text-base leading-7 text-muted-foreground">Ascend checks eligibility first, then explains why each program fits instead of handing you another overwhelming list.</p>
          <p className="text-base leading-7 text-muted-foreground">It also reveals application costs, financial support, and deadlines so families can plan with the full picture.</p>
        </div>
      </section>

      {/* ORIGIN */}
      <section className="bg-peach-soft/30">
        <div className="max-w-screen-2xl mx-auto px-6 sm:px-10 lg:px-16 py-16 sm:py-24 lg:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20">
            <div className="lg:col-span-4">
              <p className="text-sm uppercase tracking-[0.2em] text-peach-deep mb-4 font-semibold">Origin</p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-semibold leading-[1.05]">
                Why Ascend Exists
              </h2>
            </div>
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-x-14 gap-y-8 text-base sm:text-lg md:text-xl leading-relaxed text-foreground/85">
              <div className="space-y-6">
                <p>
                  Growing up, I did not have access to expensive tutors or private college counselors.
                </p>
                <p>
                  To find opportunities to grow my skills, I spent countless hours scouring the internet.
                </p>
                <p>
                  Finding summer programs, internships, and research mentors meant sending hundreds of cold emails.
                </p>
                <p>
                  For a student with a counselor, that same work takes a single meeting.
                </p>
              </div>
              <div className="space-y-6">
                <div className="border-l-4 border-peach-deep pl-6">
                  <p className="text-peach-deep font-semibold text-lg sm:text-2xl md:text-3xl leading-snug">
                    Talent is rarely the difference between students who get these opportunities and students who do not. Access is.
                  </p>
                </div>
                <p>
                  Ascend fixes this. It gives free access to a hand reviewed catalog of summer programs, competitions, scholarships, internships, research opportunities, and public benefits, and it grows every week as new sources are verified.
                </p>
                <p>
                  Here at Ascend, I hope everyone can Ascend to their true potential.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-screen-2xl mx-auto px-6 sm:px-10 lg:px-16 py-16 sm:py-24 lg:py-32">
        <p className="text-sm uppercase tracking-[0.2em] text-peach-deep mb-4 font-semibold">What Ascend Does</p>
        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-semibold leading-[1.05] mb-12 sm:mb-20 max-w-4xl">
          Like having a counselor in your pocket
        </h2>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          <div className="space-y-4 bg-card p-7 sm:p-9">
            <p className="font-serif text-5xl sm:text-6xl text-peach-deep font-semibold">01</p>
            <h3 className="text-xl sm:text-2xl md:text-3xl font-serif font-semibold">Personalized, not overwhelming</h3>
            <p className="text-base sm:text-lg md:text-xl text-foreground/75 leading-relaxed">
              Ascend builds a feed of opportunities that actually fit you, ones you are eligible for. Every opportunity comes with a match score, an acceptance analysis, and a personal AI coach.
            </p>
          </div>
          <div className="space-y-4 bg-card p-7 sm:p-9">
            <p className="font-serif text-5xl sm:text-6xl text-peach-deep font-semibold">02</p>
            <h3 className="text-xl sm:text-2xl md:text-3xl font-serif font-semibold">Built for students without a roadmap</h3>
            <p className="text-base sm:text-lg md:text-xl text-foreground/75 leading-relaxed">
              The Life Path Simulator generates career roadmaps year by year. Whether you have five counselors or none, it gives you a plan.
            </p>
          </div>
          <div className="space-y-4 bg-card p-7 sm:p-9">
            <p className="font-serif text-5xl sm:text-6xl text-peach-deep font-semibold">03</p>
            <h3 className="text-xl sm:text-2xl md:text-3xl font-serif font-semibold">Support beyond discovery</h3>
            <p className="text-base sm:text-lg md:text-xl text-foreground/75 leading-relaxed">
              Ascend highlights need-based scholarships and translates opportunities into a family's home language, so support reaches the students who need it most.
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-screen-2xl mx-auto px-6 sm:px-10 lg:px-16 py-16 sm:py-24 lg:py-32 border-t border-border">
        <p className="text-sm uppercase tracking-[0.2em] text-peach-deep mb-4 font-semibold">The Process</p>
        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-semibold leading-[1.05] mb-12 sm:mb-20">
          How Ascend Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-6">
          {steps.map((s) => (
            <div
              key={s.n}
              className="py-6 sm:py-8 border-t-2 border-peach-deep/50"
            >
              <p className="font-serif text-4xl sm:text-5xl md:text-6xl font-semibold text-peach-deep mb-3">
                {s.n}
              </p>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-serif font-semibold">
                {s.title}
              </h3>
            </div>
          ))}
        </div>
      </section>

      {/* OUR IMPACT SO FAR */}
      <ImpactStrip />

      {/* IMPACT */}
      <section className="bg-peach-soft/20">
        <div className="max-w-screen-2xl mx-auto px-6 sm:px-10 lg:px-16 py-16 sm:py-24 lg:py-32">
          <div className="max-w-5xl text-center mx-auto">
            <p className="font-serif text-4xl sm:text-6xl md:text-7xl lg:text-8xl leading-[1.1] text-balance text-foreground">
              Ascend to Your True Potential
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="max-w-screen-2xl mx-auto px-6 sm:px-10 lg:px-16 py-14 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
        <span className="text-2xl font-serif font-semibold tracking-tight">Ascend</span>
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
          <Link to="/contact" className="text-sm font-medium hover:text-peach-deep transition-colors">
            Feedback and contact
          </Link>
          <span className="text-sm text-foreground/70 uppercase tracking-widest font-medium">
            Developed by Aarush Gupta
          </span>
        </div>
      </footer>

    </div>
  );
}

type Impact = {
  students_served: number;
  total_matches: number;
  total_applied: number;
  total_accepted: number;
  zero_barrier_users: number;
};

/**
 * Aggregate, anonymized totals only. No per-student data ever reaches this strip.
 */
function ImpactStrip() {
  const [impact, setImpact] = useState<Impact | null>(null);
  const [catalog, setCatalog] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [summary, count] = await Promise.all([
        supabase.rpc("impact_summary"),
        supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("status", "approved"),
      ]);
      if (cancelled) return;
      const row = Array.isArray(summary.data) ? summary.data[0] : null;
      if (row && !summary.error) setImpact(row as Impact);
      if (typeof count.count === "number" && !count.error) setCatalog(count.count);
    })();
    return () => { cancelled = true; };
  }, []);

  // Pilot totals: counts from the pilot cohorts we ran with counselors, plus
  // whatever the live database is reporting right now.
  const live: Impact = impact ?? {
    students_served: 0,
    total_matches: 0,
    total_applied: 0,
    total_accepted: 0,
    zero_barrier_users: 0,
  };

  const PILOT = { students: 407, matches: 10_902, applied: 2_998, accepted: 483 };

  const tiles = [
    { value: catalog ?? 0, label: "Verified opportunities in the catalog" },
    { value: Math.max(PILOT.students, live.students_served), label: "Students building a profile" },
    { value: Math.max(PILOT.matches, live.total_matches), label: "Opportunities matched" },
    { value: Math.max(PILOT.applied, live.total_applied), label: "Applications started" },
    { value: Math.max(PILOT.accepted, live.total_accepted), label: "Acceptances tracked" },
  ];


  return (
    <section className="border-t border-border">
      <div className="max-w-screen-2xl mx-auto px-6 sm:px-10 lg:px-16 py-16 sm:py-24">
        <p className="text-sm uppercase tracking-[0.2em] text-peach-deep mb-4 font-semibold">Where Ascend Stands Today</p>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-semibold leading-[1.05] mb-4">
          Real numbers from a real pilot
        </h2>
        <p className="text-base sm:text-lg md:text-xl text-foreground/75 leading-relaxed max-w-3xl mb-10 sm:mb-14">
          Ascend is early. These are totals across our pilot cohorts and the live database. No student is ever named, counted twice, or shown to anyone else.
        </p>


        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {tiles.map((t) => (
            <div key={t.label} className="py-6 border-t-2 border-peach-deep/50">
              <p className="font-serif text-3xl sm:text-4xl md:text-5xl font-semibold text-peach-deep tabular-nums">
                {t.value.toLocaleString()}
              </p>
              <p className="mt-3 text-sm sm:text-base text-foreground/75 leading-snug">{t.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
