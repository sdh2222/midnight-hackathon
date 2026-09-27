const SENT = [
  ["Item", "What you are buying"],
  ["Quantity and unit", "How many, in piece, pair, box, or kg"],
  ["Destination", "Korea, the United States, Japan, or Singapore"],
  ["Keywords", "The words Jev searches with"],
] as const;

const KEPT = [
  ["Maximum budget", "The amount you will pay. Never sent to Jev"],
  ["Requirements you hold back", "Detail the search does not need"],
  ["commitRange", "Locks those fields on this machine before the search"],
  ["commitVerify", "Checks them here. The result is not sent back"],
] as const;

function OpenButton({ login, loading }: { login?: () => void; loading: boolean }) {
  if (!login) return null;
  return (
    <button className="hero-button" type="button" onClick={login} disabled={loading}>
      {loading ? "Checking the session" : "Open Sourcenight"}
    </button>
  );
}

export function Landing({ login, loading = false }: { login?: () => void; loading?: boolean }) {
  return (
    <div className="landing">
      <header className="landing-top">
        <a className="land-mark" href="#top"><span>source</span>night</a>
        <nav className="landing-nav" aria-label="Sourcenight">
          <a href="#time">The time</a>
          <a href="#private">The private buy</a>
          <a href="#close">The list</a>
        </nav>
        <OpenButton login={login} loading={loading} />
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <h1>Sourcing still takes the day.</h1>
          <p className="hero-lede">
            Suppliers are still sorted one by one. The search still sees more of the buy than it needs.
          </p>
          <div className="hero-actions">
            <a className="hero-link" href="#time">The time</a>
            <OpenButton login={login} loading={loading} />
          </div>
        </div>
      </section>

      <section className="landing-section" id="time">
        <div className="land-section-head">
          <p className="land-index">01</p>
          <h2>Less time on the list.</h2>
        </div>
        <div className="land-copy">
          <p className="land-kicker">Jev.Sort</p>
          <p className="landing-body">
            Jev searches and ranks in one pass. That pass is the labor of sorting suppliers by hand, and the labor of a general model fetching the web to build the same list. What comes back is ordered. Each row has its unit price.
          </p>
          <dl className="land-compare">
            <div>
              <dt>By hand</dt>
              <dd>One supplier, then the next, copied into a sheet.</dd>
            </div>
            <div>
              <dt>A general model</dt>
              <dd>Fetch the web, then sort the pages it read.</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="landing-section" id="private">
        <div className="land-section-head">
          <p className="land-index">02</p>
          <h2>The private buy never reaches the agent.</h2>
        </div>
        <div className="land-copy">
          <p className="landing-body">
            The amount you will pay, and the requirements you want hidden, stay on this machine. Jev receives only the public fields the search needs, and it ranks from those alone. It does not learn the rest. Midnight checks the private fields here. That result is not sent back to Jev. No other agent can read them.
          </p>
          <div className="land-doors">
            <div className="land-panel">
              <span className="land-tag">Sent to Jev</span>
              <dl className="land-facts">
                {SENT.map(([name, note]) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd>{note}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="land-panel land-panel-keep">
              <span className="land-tag">Stays here</span>
              <dl className="land-facts">
                {KEPT.map(([name, note]) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd>{note}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" id="close">
        <div className="land-section-head">
          <p className="land-index">03</p>
          <h2>You leave with the order Jev made.</h2>
        </div>
        <div className="land-copy">
          <p className="landing-body">
            The list is ranked. The private check already happened on this machine, and the agent does not receive it.
          </p>
          <div className="hero-actions">
            <OpenButton login={login} loading={loading} />
          </div>
        </div>
      </section>

      <footer className="land-footer">
        <div className="land-footer-row">
          <a className="land-mark" href="#top"><span>source</span>night</a>
          <nav className="landing-nav" aria-label="Footer">
            <a href="#time">The time</a>
            <a href="#private">The private buy</a>
            <a href="#close">The list</a>
          </nav>
        </div>
        <p className="land-footer-note">Jev ranks the public search. Midnight checks the private buy on this machine.</p>
      </footer>
    </div>
  );
}
