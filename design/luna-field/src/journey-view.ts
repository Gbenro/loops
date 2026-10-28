export const journeyMarkup = `<div class="echo-journey">
  <section id="journey" class="intro">
    <div>
      <p class="eyebrow">RETURN TO ORIGINAL VOICE</p>
      <h1>A journey through your Echoes</h1>
      <p class="lead">Listen to the moments as they unfolded.<br>Find what meets you differently this time.</p>
    </div>
    <div class="intro-orbit" aria-hidden="true">
      <svg viewBox="0 0 110 110"><circle cx="55" cy="55" r="43"/><circle cx="55" cy="55" r="32"/><path d="M17 74Q55 41 95 72"/><circle class="orbit-dot" cx="87" cy="26" r="3"/></svg>
    </div>
  </section>

  <div class="cycle-nav-banner" aria-label="Lunar cycle navigation">
    <div class="cycle-nav-controls">
      <button id="prev-cycle" class="cycle-nav-btn" aria-label="Previous lunar cycle" title="Step back to previous lunar cycle">‹</button>
      <div class="cycle-nav-center">
        <span class="eyebrow cycle-badge" id="cycle-badge">LUNAR CYCLE</span>
        <select id="cycle-select" class="cycle-select" aria-label="Select lunar cycle"></select>
        <span id="cycle-range-label" class="cycle-range-text"></span>
      </div>
      <button id="next-cycle" class="cycle-nav-btn" aria-label="Next lunar cycle" title="Step forward to newer lunar cycle">›</button>
    </div>
  </div>

  <div class="journey-layout">
    <section class="listening" aria-labelledby="voice-label">
      <div class="listening-top">
        <span class="eyebrow" id="voice-label">ORIGINAL VOICE</span>
        <span class="test-label">Original recording</span>
      </div>
      <div class="atmosphere" aria-hidden="true">
        <svg viewBox="0 0 600 160" preserveAspectRatio="none"><path d="M0 75Q150 30 310 92T600 60M0 104Q170 65 330 113T600 90M0 133Q170 98 330 139T600 120"/></svg>
      </div>
      <div class="voice-heading">
        <p class="moment-date" id="moment-date"></p>
        <h2 id="voice-title"></h2>
        <button id="context" class="context-button" title="Filter the listening path by this lunar phase"></button>
      </div>
      <div class="voice-orbit">
        <svg class="orbit" viewBox="0 0 170 170" aria-hidden="true"><circle cx="85" cy="85" r="78"/><circle cx="85" cy="85" r="63"/><path d="M12 112Q82 52 158 108"/></svg>
        <button id="play" class="play" aria-label="Play recording"><span id="play-glyph" aria-hidden="true">▶</span></button>
      </div>
      <div class="wave-wrap">
        <svg id="wave" viewBox="0 0 600 72" preserveAspectRatio="none" aria-hidden="true"></svg>
        <input id="seek" type="range" min="0" max="1" step="0.05" value="0" aria-label="Listening position">
      </div>
      <div class="times">
        <span id="elapsed">0:00</span>
        <span id="duration">0:00</span>
      </div>
      <div class="transport">
        <button id="previous" class="icon-button" aria-label="Previous Echo">|‹</button>
        <span id="player-status" role="status" aria-live="polite">Ready when you are</span>
        <button id="next" class="icon-button" aria-label="Next Echo">›|</button>
      </div>
      <div class="place-actions">
        <button id="save" class="quiet-button">＋ Keep this place</button>
        <button id="return" class="quiet-button" disabled>↶ Return to saved place</button>
      </div>
      <p class="save-note" id="save-note">Keep a listening position to return to later.</p>
      <div class="continuation">
        <div>
          <span class="eyebrow">IN THIS CYCLE</span>
          <strong id="queue-count"></strong>
        </div>
        <progress id="queue-progress" max="1" value="0" aria-label="Journey progress"></progress>
        <p id="up-next"></p>
      </div>
    </section>

    <section class="path" id="moments" aria-labelledby="path-title">
      <div class="path-heading">
        <div>
          <p class="eyebrow" id="path-cycle-eyebrow">SELECTED CYCLE</p>
          <h2 id="path-title">Moments in time</h2>
        </div>
        <span id="available-count" class="count"></span>
      </div>
      <div class="filters">
        <fieldset>
          <legend>Group moments</legend>
          <div class="segments">
            <button data-group="day" aria-pressed="true">Day</button>
            <button data-group="phase" aria-pressed="false">Phase</button>
          </div>
        </fieldset>
        <label class="order-label">
          Listening order
          <select id="order">
            <option value="oldest">Oldest → newest</option>
            <option value="newest">Newest → oldest</option>
          </select>
        </label>
      </div>
      <div class="journey-subfilters">
        <label class="order-label">
          Phase
          <select id="phase-filter">
            <option value="">All phases</option>
          </select>
        </label>
        <label class="order-label">
          Day
          <select id="day-filter">
            <option value="">All days</option>
          </select>
        </label>
      </div>
      <p class="path-note">Continues across recordings in this cycle. Unavailable audio is left out.</p>
      <div id="groups"></div>
      <p class="zone-note">Days shown in <span id="timezone"></span>. Phase and cycle context follows each original moment.</p>
    </section>
  </div>

  <p class="zone-note">Your listening position is saved in this browser for this account. Audio uses local device storage first. <button id="clear" class="quiet-button">Clear saved place</button></p>
  <footer>One field. Many ways of seeing.<span>Original Voice · Echo Journey</span></footer>
  <aside id="mobile-dock" class="mobile-dock" aria-label="Journey controls while browsing" hidden>
    <button id="dock-return" class="dock-title" aria-label="Return to current recording"><span>LISTENING JOURNEY ↑</span><strong id="dock-title"></strong></button>
    <button id="dock-previous" class="icon-button" aria-label="Previous journey recording">|‹</button>
    <button id="dock-play" class="icon-button dock-play" aria-label="Play journey">▶</button>
    <button id="dock-next" class="icon-button" aria-label="Next journey recording">›|</button>
  </aside>
</div>`;
