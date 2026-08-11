const styleId = 'still-desktop-work-laptop';

if (!document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
@media (min-width: 1024px) {
  .work-hub-page {
    width: min(100%, 1220px);
    max-width: 1220px;
    min-height: 100dvh;
    margin: 0 auto;
    padding: 30px clamp(28px, 3vw, 48px) 72px;
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 18px 20px;
    align-items: start;
  }

  .work-hub-page .work-hub-header {
    grid-column: 1 / -1;
    min-height: 66px;
    margin: 0;
    align-items: flex-start;
  }

  .work-hub-page .work-hub-back { display: none; }
  .work-hub-page .work-hub-header h1 { font-size: 2.55rem; }
  .work-hub-page .work-hub-header > div > p:last-child { max-width: 620px; margin-top: 5px; }

  .work-hub-page .work-live-card {
    grid-column: 1 / span 7;
    min-height: 176px;
    margin: 0;
    padding: 20px 22px;
    border-color: rgba(100, 79, 153, .13);
    border-radius: 24px;
    background:
      radial-gradient(circle at 92% 5%, rgba(223, 213, 255, .48), transparent 12rem),
      linear-gradient(135deg, rgba(255,255,255,.84), rgba(249,244,255,.74));
    box-shadow: 0 18px 44px rgba(72, 57, 98, .065);
    backdrop-filter: blur(18px) saturate(112%);
  }

  .work-hub-page .work-live-actions button:not(:disabled) {
    border-color: transparent;
    color: #fff;
    background: linear-gradient(135deg, #8972c9, #745cad);
    box-shadow: 0 8px 20px rgba(105, 82, 158, .17);
  }

  .work-hub-page .work-live-actions button:disabled { background: rgba(255,255,255,.58); }
  .work-hub-page .work-live-eye { transition: background .16s ease, transform .16s ease; }
  .work-hub-page .work-live-eye:hover { background: rgba(255,255,255,.9); transform: translateY(-1px); }

  .work-hub-page .work-overview {
    grid-column: 8 / -1;
    align-self: stretch;
    margin: 0;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .work-hub-page .work-overview article {
    min-height: 83px;
    padding: 13px 14px;
    border-radius: 18px;
    background: rgba(255,255,255,.68);
    box-shadow: 0 10px 28px rgba(72, 57, 98, .035);
    backdrop-filter: blur(14px);
  }

  .work-hub-page .work-overview strong { margin-top: 4px; font-size: 1.28rem; }

  .work-hub-page .work-meetings {
    grid-column: 1 / span 5;
    margin: 0;
  }

  .work-hub-page .work-board {
    grid-column: 6 / -1;
    min-height: 240px;
    margin: 0;
    padding: 18px;
    border-radius: 23px;
    background: rgba(255,255,255,.72);
    box-shadow: 0 16px 38px rgba(72, 57, 98, .05);
    backdrop-filter: blur(16px);
  }

  .work-hub-page .work-section-head { margin-bottom: 10px; }
  .work-hub-page .work-meetings .work-list-card {
    max-height: 188px;
    overflow: auto;
    scrollbar-gutter: stable;
    background: rgba(255,255,255,.65);
  }

  .work-hub-page .work-board .work-queue-list {
    max-height: 154px;
    overflow: auto;
    scrollbar-gutter: stable;
  }

  .work-hub-page > .work-section:nth-of-type(5) {
    grid-column: 1 / span 6;
    margin: 8px 0 0;
  }

  .work-hub-page > .work-section:nth-of-type(6) {
    grid-column: 7 / -1;
    margin: 8px 0 0;
  }

  .work-hub-page > .work-section:nth-of-type(7) {
    grid-column: 1 / -1;
    margin: 0;
  }

  .work-hub-page > .work-section:nth-of-type(5) .work-list-card,
  .work-hub-page > .work-section:nth-of-type(6) .work-list-card {
    max-height: 232px;
    overflow: auto;
    scrollbar-gutter: stable;
  }

  .work-hub-page > .work-section:nth-of-type(7) .work-list-card {
    max-height: 260px;
    overflow: auto;
    scrollbar-gutter: stable;
  }

  .work-hub-page .work-details-link {
    grid-column: 1 / -1;
    margin: 0;
    padding: 16px 18px;
    background: rgba(255,255,255,.6);
  }

  .work-hub-page .work-record,
  .work-hub-page .work-queue-row,
  .work-hub-page .work-section-head > button,
  .work-hub-page .work-task-add button,
  .work-hub-page .work-details-link {
    transition: background .16s ease, border-color .16s ease, transform .16s ease;
  }

  .work-hub-page .work-record:hover,
  .work-hub-page .work-queue-row:hover,
  .work-hub-page .work-details-link:hover { background: rgba(118, 96, 172, .045); }
  .work-hub-page .work-section-head > button:hover,
  .work-hub-page .work-task-add button:hover { background: rgba(113,94,168,.14); }

  .work-hub-page button:focus-visible,
  .work-hub-page input:focus-visible,
  .work-hub-page select:focus-visible,
  .work-hub-page textarea:focus-visible {
    outline: 3px solid rgba(122, 98, 184, .24);
    outline-offset: 2px;
  }

  .still-work-page {
    width: min(100%, 1080px);
    max-width: 1080px;
    margin-inline: auto;
    padding-left: 40px;
    padding-right: 40px;
  }
}

@media (min-width: 1024px) and (max-height: 820px) {
  .work-hub-page {
    padding-top: 20px;
    gap: 14px 18px;
  }

  .work-hub-page .work-hub-header { min-height: 54px; }
  .work-hub-page .work-hub-header h1 { font-size: 2.25rem; }
  .work-hub-page .work-hub-header > div > p:last-child { margin-top: 3px; }

  .work-hub-page .work-live-card {
    min-height: 154px;
    padding: 16px 18px;
  }

  .work-hub-page .work-live-icon { width: 44px; height: 44px; border-radius: 14px; }
  .work-hub-page .work-live-copy strong { font-size: 1.75rem; }
  .work-hub-page .work-live-meta { margin: 10px 0; padding-top: 10px; }
  .work-hub-page .work-live-actions button { min-height: 44px; }

  .work-hub-page .work-overview article { min-height: 72px; padding: 10px 12px; }
  .work-hub-page .work-overview strong { margin-top: 2px; font-size: 1.14rem; }

  .work-hub-page .work-meetings .work-list-card { max-height: 156px; }
  .work-hub-page .work-record { min-height: 52px; padding-block: 8px; }

  .work-hub-page .work-board { min-height: 212px; padding: 14px 16px; }
  .work-hub-page .work-tabs { margin: 9px 0 7px; }
  .work-hub-page .work-tabs button { padding-block: 7px; }
  .work-hub-page .work-board .work-queue-list { max-height: 118px; }
  .work-hub-page .work-queue-row { min-height: 46px; padding-block: 6px; }
  .work-hub-page .work-task-add { margin-top: 7px; }
}

@media (min-width: 1440px) {
  .work-hub-page { max-width: 1260px; }
}
`;
  document.head.appendChild(style);
}

export {};
