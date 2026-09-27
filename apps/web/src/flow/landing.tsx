import { SortLoop } from "./sort-motion";

const STATS = [
  ["Sheet", "One supplier, then the next", "Copied into the next row by hand"],
  ["Sourcenight", "One search", "The whole list comes back ordered"],
  ["Cap", "Stays in this browser", "Locked with commitRange before Jev runs"],
  ["Kept row", "commitVerify", "The fit, and nothing else"],
] as const;

const SENT = [
  ["Item", "What you are buying"],
  ["Quantity and unit", "How many, in piece, pair, box, or kg"],
  ["Destination", "Korea, the United States, Japan, or Singapore"],
  ["Keywords", "The words Jev searches with"],
  ["Needed by", "Optional. Used only to reject a late delivery"],
] as const;

const KEPT = [
  ["Maximum budget", "KRW. Never sent to Jev"],
  ["Salt", "Created in this browser. Not shown"],
  ["commitRange", "Locks the cap before the search"],
  ["commitVerify", "Checks the one row you keep"],
] as const;

const COLUMNS = [
  ["Supplier", "Name on the listing", "Jev"],
  ["Qty", "The buy, or the listing minimum when that is higher", "You, then the listing"],
  ["Unit price", "Catalog currency, per unit", "The listing"],
  ["Total", "Converted to KRW for the fit check", "Converted listing"],
  ["Lead", "Days until it can ship", "The listing"],
  ["Arrives", "Delivery date, checked against needed-by", "The listing"],
  ["Score", "Relevance, and how sure Jev is", "Jev"],
  ["Fit", "Within cap, over cap, or a missing date", "This browser"],
] as const;

export function Landing({ login, loading = false }: { login?: () => void; loading?: boolean }) {
  return (
    <div className="landing">
      <header className="landing-top">
        <span className="mark"><span className="mark-water">source</span>night</span>
        <nav className="landing-nav" aria-label="Sourcenight">
          <a href="#how">How a buy runs</a>
          <a href="#fields">The fields</a>
          <a href="#list">The list</a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-sky" aria-hidden="true" />
        <div className="hero-copy">
          <h1>Stop pasting suppliers into a sheet.</h1>
          <p className="hero-via">via Jev and Midnight</p>
          <div className="hero-actions">
            {login ? (
              <button className="hero-button" type="button" onClick={login} disabled={loading}>
                {loading ? "Checking the session" : "Open Sourcenight"}
              </button>
            ) : (
              <p>Set <code>VITE_PRIVY_APP_ID</code> in the root <code>.env</code> before signing in.</p>
            )}
            <a className="hero-link" href="#how">How a buy runs</a>
          </div>
        </div>
      </section>

      <section className="landing-section" id="how">
        <h2>One search. The whole list.</h2>
        <div className="land-panel">
          <span className="land-tag">Jev.Sort</span>
          <SortLoop total={6} fits={4} />
        </div>
        <div className="land-stats">
          {STATS.map(([name, value, note]) => (
            <p key={name} className="land-stat">
              <span className="land-stat-name">{name}</span>
              <span className="land-stat-value">{value}</span>
              <span className="land-stat-note">{note}</span>
            </p>
          ))}
        </div>
        <div className="landing-grid">
          <ol className="landing-steps">
            <li><strong>You enter the buy.</strong><span>Item, quantity, unit, country, keywords, a needed-by date, and a cap.</span></li>
            <li><strong>commitRange locks the cap.</strong><span>The cap and its salt stay in this browser. The search body does not include them.</span></li>
            <li><strong>Jev returns the rows in order.</strong><span>Supplier, quantity, unit price, total, lead, delivery, and score.</span></li>
            <li><strong>commitVerify checks the row you keep.</strong><span>The list is that same order, with one row marked kept.</span></li>
          </ol>
          <p className="landing-body">
            Searching each supplier and copying the row into a spreadsheet is the slow part. Sourcenight does that pass once. You still type the buy. Jev turns the public fields into a search and ranks what comes back. Midnight does not see the catalog. It checks whether the kept row fits the cap you already locked, and the proof does not reveal the cap. Sign-in is email or a social account through Privy. The page does not ask for a wallet seed, and it does not ask you to connect a Lace wallet.
          </p>
        </div>
      </section>

      <section className="land-band">
        <div className="landing-section">
          <h2>The cap never leaves this browser.</h2>
          <p className="land-sub">Jev ranks the public buy. Midnight checks the row you keep.</p>
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
            <div className="land-panel">
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
          <p className="landing-body land-band-body">
            A failed search clears the lock, so you can edit the buy and try again. After a lock, the public fields stay as entered until you start a new buy. Past buys store the offer, the commitVerify id, and the order status. They do not store the cap.
          </p>
        </div>
      </section>

      <section className="landing-section" id="fields">
        <h2>What each column is.</h2>
        <div className="v-table-wrap land-table">
          <table className="v-table">
            <thead>
              <tr>
                <th>Column</th>
                <th>What it shows</th>
                <th>Where it comes from</th>
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map(([column, shows, from]) => (
                <tr key={column}>
                  <td>{column}</td>
                  <td>{shows}</td>
                  <td className="v-muted">{from}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="landing-section" id="list">
        <h2>You leave with the list.</h2>
        <p className="land-sub">One kept row. The rest of the order still there.</p>
        <div className="land-doors">
          <div className="land-panel">
            <span className="land-tag">Buyer</span>
            <div className="land-door">
              <h3>Open a buy</h3>
              <ol className="land-door-steps">
                <li>Sign in. Sourcenight creates one Midnight address for that login.</li>
                <li>Enter the buy. Lock the cap. Jev sorts.</li>
                <li>Keep one row that fits. Open the list.</li>
              </ol>
              {login ? (
                <button className="hero-button" type="button" onClick={login} disabled={loading}>
                  {loading ? "Checking the session" : "Open Sourcenight"}
                </button>
              ) : null}
            </div>
          </div>
          <div className="land-panel">
            <span className="land-tag">List</span>
            <div className="land-door">
              <h3>What you keep</h3>
              <ol className="land-door-steps">
                <li>Every offer Jev returned, in that order.</li>
                <li>The row commitVerify accepted, marked kept.</li>
                <li>Past buys, when you want the earlier orders. The cap is not in them.</li>
              </ol>
              <a className="hero-link" href="#how">How a buy runs</a>
            </div>
          </div>
        </div>
      </section>

      <footer className="land-footer">
        <div className="land-footer-row">
          <span className="mark"><span className="mark-water">source</span>night</span>
          <nav className="landing-nav" aria-label="Footer">
            <a href="#how">How a buy runs</a>
            <a href="#fields">The fields</a>
            <a href="#list">The list</a>
          </nav>
        </div>
        <p className="land-footer-note">Built on Jev for the search, Midnight for the fit check, and Privy for sign-in.</p>
      </footer>
    </div>
  );
}
