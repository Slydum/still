const styleId = 'still-desktop-home-layout';

if (!document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
@media (min-width: 1024px) {
  .app {
    padding-left: 252px;
    padding-bottom: 0;
  }

  .app .bottom-nav {
    position: fixed;
    inset: 0 auto 0 0;
    left: 0;
    right: auto;
    top: 0;
    bottom: 0;
    z-index: 30;
    width: 252px;
    height: 100dvh;
    margin: 0;
    padding: 126px 22px 92px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    gap: 7px;
    transform: none !important;
    overflow: visible;
    border: 0;
    border-right: 1px solid rgba(91, 76, 116, .09);
    border-radius: 0;
    background: rgba(255, 251, 248, .78);
    box-shadow: none;
    backdrop-filter: blur(24px) saturate(115%);
  }

  .app .bottom-nav::before {
    content: 'Still.';
    position: absolute;
    top: 42px;
    left: 31px;
    color: #4b4363;
    font-family: var(--font-display);
    font-size: 38px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -1.5px;
  }

  .app .bottom-nav .nav-item {
    flex: none;
    width: 100%;
    min-width: 0;
    min-height: 46px;
    margin: 0;
    padding: 0 13px;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;
    transform: none;
    border-radius: 15px;
    color: #5e586d;
    font-size: 13px;
    text-align: left;
  }

  .app .bottom-nav .nav-item svg {
    flex: none;
  }

  .app .bottom-nav .nav-item > span:last-child {
    position: static;
    width: auto;
    height: auto;
    margin: 0;
    display: inline;
    overflow: visible;
    clip: auto;
    opacity: 1;
    white-space: nowrap;
  }

  .app .bottom-nav .nav-item.active {
    color: #51456e;
    background: linear-gradient(90deg, rgba(255, 228, 218, .66), rgba(244, 234, 255, .58));
  }

  .app .bottom-nav .add-button {
    flex: none;
    width: 22px;
    height: 22px;
    margin: 0;
    display: grid;
    place-items: center;
    transform: none;
    border-radius: 0;
    color: inherit;
    background: transparent;
    box-shadow: none;
  }

  .app .bottom-nav .add-button svg { width: 21px; height: 21px; }

  .app .sync-confidence-indicator {
    position: fixed;
    left: 28px;
    right: auto;
    bottom: 28px;
    z-index: 35;
  }

  .shell.dashboard-v2,
  .dashboard-v2.shell,
  .dashboard-v2 {
    width: 100%;
    max-width: none;
    min-height: 100dvh;
    margin: 0;
    padding: 48px 58px 64px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 560px));
    grid-template-areas:
      'hero hero'
      'focus focus'
      'upcoming checkin'
      'areas areas'
      'weekly weekly';
    justify-content: center;
    align-content: start;
    gap: 28px 30px;
  }

  .dashboard-v2::before {
    background:
      radial-gradient(circle at 82% 8%, rgba(220, 211, 255, .34), transparent 30rem),
      radial-gradient(circle at 23% 88%, rgba(255, 224, 210, .34), transparent 32rem),
      linear-gradient(120deg, #fffaf6 0%, #fdf9ff 54%, #f8f5ff 100%);
  }

  .dashboard-v2 .topbar-v2 {
    grid-area: hero;
    z-index: 4;
    align-self: stretch;
    margin: 0;
    padding: 0;
    pointer-events: none;
  }

  .dashboard-v2 .topbar-v2 > div {
    position: absolute;
    left: 0;
    top: 88px;
  }

  .dashboard-v2 .topbar-v2 .brand { display: none; }

  .dashboard-v2 .topbar-date {
    margin: 0;
    color: #7e758d;
    font-size: 10px;
    font-weight: 750;
    letter-spacing: .17em;
    text-transform: uppercase;
  }

  .dashboard-v2 .topbar-v2 .icon-button {
    margin-left: auto;
    pointer-events: auto;
  }

  .dashboard-v2 .hero.hero-v3 {
    grid-area: hero;
    min-height: 132px;
    margin: 0;
    padding: 3px 74px 30px 0;
    overflow: visible;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
  }

  .dashboard-v2 .hero-v3-copy {
    position: static;
    max-width: none;
  }

  .dashboard-v2 .hero-v3 h1 {
    margin: 0;
    color: #4a4262;
    font-size: clamp(43px, 3.4vw, 55px);
    line-height: 1;
    letter-spacing: -1.8px;
  }

  .dashboard-v2 .hero-v3-title-line { display: inline; }
  .dashboard-v2 .hero-v3-title-line + .hero-v3-title-line { margin-left: .22em; }
  .dashboard-v2 .hero-v3-quote,
  .dashboard-v2 .hero-v3-art,
  .dashboard-v2 .hero-v3-weather { display: none; }

  .dashboard-v2 .dashboard-two-column { display: contents; }
  .dashboard-v2 .dashboard-two-column::before { display: none; }

  .dashboard-v2 .focus-card,
  .dashboard-v2 .upcoming-card,
  .dashboard-v2 .section-v2 {
    margin: 0;
    border: 1px solid rgba(91, 76, 116, .10);
    border-radius: 26px;
    background: rgba(255, 255, 255, .72) !important;
    box-shadow: 0 18px 42px rgba(72, 57, 98, .065);
    backdrop-filter: blur(18px) saturate(112%);
  }

  .dashboard-v2 .focus-card {
    grid-area: focus;
    min-height: 132px;
    padding: 25px 28px;
  }

  .dashboard-v2 .upcoming-card {
    grid-area: upcoming;
    min-height: 214px;
    padding: 26px 28px;
    border-top: 1px solid rgba(91, 76, 116, .10);
  }

  .dashboard-v2 .section-v2 {
    grid-area: checkin;
    min-height: 214px;
    padding: 26px 28px;
  }

  .dashboard-v2 .focus-task-heading .section-kicker,
  .dashboard-v2 .upcoming-heading .section-kicker,
  .dashboard-v2 .section-v2 .section-kicker {
    color: #4c455f;
    font-family: var(--font-display);
    font-size: 21px;
    font-weight: 700;
    letter-spacing: -.25px;
    text-transform: none;
  }

  .dashboard-v2 .section-v2 .section-head { margin-bottom: 12px; }

  .dashboard-v2 .section-v2 .checkin-combined-card {
    padding: 2px 0 0;
    border: 0;
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
  }

  .dashboard-v2 .checkin-answer-front blockquote {
    max-width: 420px;
    margin-inline: auto;
    font-size: 17px;
    line-height: 1.55;
  }

  .dashboard-v2 .life-garden-section {
    grid-area: areas;
    margin: 8px 0 0;
  }

  .dashboard-v2 .life-garden-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }

  .dashboard-v2 .garden-card {
    min-height: 82px;
    padding: 18px 20px;
    border: 1px solid rgba(91, 76, 116, .09);
    border-radius: 22px;
    background: rgba(255, 255, 255, .68) !important;
    box-shadow: 0 12px 28px rgba(72, 57, 98, .045);
  }

  .dashboard-v2 .garden-card-head { justify-content: center; gap: 10px; }
  .dashboard-v2 .garden-card-head img { width: 28px; height: 28px; }
  .dashboard-v2 .garden-card-head strong { font-size: 15px; }
  .dashboard-v2 .garden-status { display: none; }

  .dashboard-v2 .weekly-reflection-entry {
    grid-area: weekly;
    margin: -4px 0 0;
  }

  .dashboard-v2 .weekly-reflection-entry-card {
    min-height: 64px;
    border-radius: 20px;
    background: rgba(255, 255, 255, .5);
  }
}
`;
  document.head.appendChild(style);
}

export {};
