import Image from 'next/image';
import Link from 'next/link';
import { IconLogo } from '@/components/icons';

export const metadata = { title: 'NUDGE — Capture intelligence passively' };

export default function LandingPage() {
  return (
    <div className="landing">
      <div className="landing-texture" aria-hidden="true" />

      <nav className="landing-nav" aria-label="Primary navigation">
        <Link className="landing-brand" href="/" aria-label="NUDGE home">
          <span className="landing-brand-mark"><IconLogo size={18} /></span>
          <span>NUDGE</span>
        </Link>

        <div className="landing-nav-links">
          <a className="landing-nav-link" href="#features">Features</a>
          <Link className="landing-nav-link" href="/login">Sign in</Link>
          <Link className="landing-nav-cta" href="/signup">Get started</Link>
        </div>
      </nav>

      <main className="landing-main">
        <section className="landing-hero">
          <p className="landing-eyebrow">Your internet memory, organized</p>
          <h1>Your bookmarks shouldn&rsquo;t become a graveyard.</h1>
          <p className="landing-lead">Capture intelligence passively. Access it when it matters.</p>
          <div className="landing-hero-actions">
            <Link className="landing-primary-cta" href="/signup">
              Get started <span aria-hidden="true">&rarr;</span>
            </Link>
            <form action="/api/auth/demo" method="post">
              <button className="landing-demo-cta" type="submit">Try the demo</button>
            </form>
          </div>
          <p className="landing-demo-note">Demo opens an isolated, pre-filled profile—no signup required.</p>
        </section>

        <section className="landing-scenes" id="features" aria-label="How NUDGE works">
          <article className="landing-scene">
            <div className="landing-artwork landing-artwork-capture">
              <Image
                src="/landing/capture-to-brain.png"
                alt="A saved post moving from X into NUDGE"
                width={1365}
                height={768}
                sizes="(max-width: 760px) 100vw, 50vw"
                priority
              />
            </div>
            <div className="landing-scene-caption">
              <span className="landing-step">01</span>
              <p>Save on X <span aria-hidden="true">&rarr;</span><br /><strong>NUDGE understands.</strong></p>
            </div>
          </article>

          <article className="landing-scene">
            <div className="landing-artwork landing-artwork-terms">
              <picture>
                <source media="(max-width: 640px)" srcSet="/landing/terms-review.png" />
                <img
                  src="/landing/terms-analysis.png"
                  alt="NUDGE reviewing terms and conditions and surfacing a clause worth attention"
                  width="1365"
                  height="768"
                  loading="lazy"
                />
              </picture>
            </div>
            <div className="landing-scene-caption">
              <span className="landing-step">02</span>
              <p>Visit terms <span aria-hidden="true">&rarr;</span><br /><strong>Know what matters.</strong></p>
            </div>
          </article>
        </section>
      </main>

      <footer className="landing-footer">
        <p>&copy; 2026 NUDGE</p>
        <div className="landing-footer-links">
          <a href="#features">Product</a>
          <span>Privacy-first</span>
          <span>Built for focus</span>
        </div>
      </footer>
    </div>
  );
}
