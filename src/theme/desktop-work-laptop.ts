const styleId = 'still-desktop-work-laptop';

if (!document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
@media (min-width: 1024px) {
  .work-hub-page {
    width: min(100%, 1180px);
    max-width: 1180px;
    min-height: 100dvh;
    margin: 0 auto;
    padding: 28px clamp(28px, 3vw, 44px) 68px;
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 16px 18px;
    align-items: start;
  }

  .work-hub-page .work-hub-header {
    grid-column: 1 / -1;
    min-height: 60px;
    margin: 0;
    align-items: flex-start;
  }

  .work-hub-page .work-hub-back { display: none; }
  .work-hub-page .work-hub-header h1 { font-size: 2.45rem; }
  .work-hub-page .work-hub-header > div > p:last-child { max-width: 620px; margin-top: 4px; }

  .work-hub-page .work-live-card {
    grid-column: 1 / span 7;
    min-height: 166px;
    margin: 0;
    padding: 19px 21px;
    border-color: rgba(100, 79, 153, .11);
    border-radius: 23px;
    background:
      radial-gradient(circle at 94% 5%, rgba(226, 218, 255, .34), transparent 12rem),
      linear-gradient(135deg, rgba(255,255,255,.84), rgba(250,247,255,.72));
    box-shadow: 0 14px 34px rgba(72, 57, 98, .045);
    backdrop-filter: blur(16px) saturate(108%);
  }

  .work-hub-page .work-live-actions button:not(:disabled) {
    border-color: transparent;
    color: #fff;
    background: linear-gradient(135deg, #8972c9, #745cad);
    box-shadow: 0 7px 18px rgba(105, 82, 158, .14);
  }

  .work-hub-page .work-live-actions button:disabled { background: rgba(255,255,255,.52); }
  .work-hub-page .work-live-eye { transition: background .16s ease, transform .16s ease; }
  .work-hub-page .work-live-eye:hover { background: rgba(255,255,255,.9); transform: translateY(-1px); }

  /* One quiet status surface instead of four competing dashboard cards. */
  .work-hub-page .work-overview {
    grid-column: 8 / -1;
    align-self: stretch;
    margin: 0;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0;
    overflow: hidden;
    border: 1px solid rgba(93,78,119,.09);
    border-radius: 22px;
    background: rgba(255,255,255,.48);
    box-shadow: none;
    backdrop-filter: blur(12px);
  }

  .work-hub-page .work-overview article {
    min-height: 82px;
    padding: 13px 15px;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .work-hub-page .work-overview article:nth-child(odd) { border-right: 1px solid rgba(93,78,119,.07); }
  .work-hub-page .work-overview article:nth-child(-n+2) { border-bottom: 1px solid rgba(93,78,119,.07); }
  .work-hub-page .work-overview strong { margin-top: 4px; font-size: 1.05rem; }
  .work-hub-page .work-overview span { opacity: .78; }

  /* The workday itself is the second visual tier. */
  .work-hub-page .work-meetings {
    grid-column: 1 / span 5;
    margin: 0;
  }

  .work-hub-page .work-board {
    grid-column: 6 / -1;
    min-height: 232px;
    margin: 0;
    padding: 17px;
    border-color: rgba(93,78,119,.09);
    border-radius: 22px;
    background: rgba(255,255,255,.58);
    box-shadow: none;
    backdrop-filter: blur(14px);
  }

  .work-hub-page .work-section-head { margin-bottom: 9px; }
  .work-hub-page .work-meetings .work-list-card {
    max-height: 180px;
    overflow: auto;
    scrollbar-gutter: stable;
    border-color: rgba(93,78,119,.09);
    background: rgba(255,255,255,.5);
    box-shadow: none;
  }

  .work-hub-page .work-board .work-queue-list {
    max-height: 146px;
    overflow: auto;
    scrollbar-gutter: stable;
  }

  /* Operational areas live below the workday and collapse into quiet shortcuts when empty. */
  .work-hub-page > .work-section:nth-of-type(5) {
    grid-column: 1 / span 4;
    margin: 8px 0 0;
  }

  .work-hub-page > .work-section:nth-of-type(6) {
    grid-column: 5 / span 4;
    margin: 8px 0 0;
  }

  .work-hub-page > .work-section:nth-of-type(7) {
    grid-column: 9 / -1;
    margin: 8px 0 0;
  }

  .work-hub-page > .work-section:nth-of-type(5):not(:has(.work-empty)),
  .work-hub-page > .work-section:nth-of-type(6):not(:has(.work-empty)),
  .work-hub-page > .work-section:nth-of-type(7):not(:has(.work-empty)) {
    grid-column: 1 / -1;
  }

  .work-hub-page > .work-section:nth-of-type(5):has(.work-list-card > .work-empty),
  .work-hub-page > .work-section:nth-of-type(6):has(.work-list-card > .work-empty),
  .work-hub-page > .work-section:nth-of-type(7):has(.work-list-card > .work-empty) {
    min-width: 0;
  }

  .work-hub-page > .work-section:nth-of-type(5):has(.work-list-card > .work-empty) .work-list-card,
  .work-hub-page > .work-section:nth-of-type(6):has(.work-list-card > .work-empty) .work-list-card,
  .work-hub-page > .work-section:nth-of-type(7):has(.work-list-card > .work-empty) .work-list-card {
    display: none;
  }

  .work-hub-page > .work-section:nth-of-type(5):has(.work-list-card > .work-empty) .work-section-head,
  .work-hub-page > .work-section:nth-of-type(6):has(.work-list-card > .work-empty) .work-section-head,
  .work-hub-page > .work-section:nth-of-type(7):has(.work-list-card > .work-empty) .work-section-head {
    min-height: 58px;
    margin: 0;
    padding: 0 14px 0 16px;
    border: 1px solid rgba(93,78,119,.075);
    border-radius: 17px;
    background: rgba(255,255,255,.36);
  }

  .work-hub-page > .work-section:nth-of-type(5):has(.work-list-card > .work-empty) .work-section-head h2,
  .work-hub-page > .work-section:nth-of-type(6):has(.work-list-card > .work-empty) .work-section-head h2,
  .work-hub-page > .work-section:nth-of-type(7):has(.work-list-card > .work-empty) .work-section-head h2 {
    font-family: inherit;
    font-size: .88rem;
    font-weight: 800;
    letter-spacing: 0;
  }

  .work-hub-page > .work-section:nth-of-type(5):has(.work-list-card > .work-empty) .work-section-head p,
  .work-hub-page > .work-section:nth-of-type(6):has(.work-list-card > .work-empty) .work-section-head p,
  .work-hub-page > .work-section:nth-of-type(7):has(.work-list-card > .work-empty) .work-section-head p { display: none; }

  .work-hub-page > .work-section:nth-of-type(5) .work-list-card,
  .work-hub-page > .work-section:nth-of-type(6) .work-list-card,
  .work-hub-page > .work-section:nth-of-type(7) .work-list-card {
    max-height: 252px;
    overflow: auto;
    scrollbar-gutter: stable;
  }

  .work-hub-page .work-details-link {
    grid-column: 1 / -1;
    margin: 2px 0 0;
    padding: 14px 4px;
    border: 0;
    border-top: 1px solid rgba(93,78,119,.075);
    border-radius: 0;
    background: transparent;
  }

  .work-hub-page .work-details-link:hover { background: transparent; }

  .work-hub-page .work-record,
  .work-hub-page .work-queue-row,
  .work-hub-page .work-section-head > button,
  .work-hub-page .work-task-add button,
  .work-hub-page .work-details-link {
    transition: background .16s ease, border-color .16s ease, transform .16s ease;
  }

  .work-hub-page .work-record:hover,
  .work-hub-page .work-queue-row:hover { background: rgba(118, 96, 172, .04); }
  .work-hub-page .work-section-head > button:hover,
  .work-hub-page .work-task-add button:hover { background: rgba(113,94,168,.12); }

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
    padding-top: 18px;
    gap: 12px 16px;
  }

  .work-hub-page .work-hub-header { min-height: 50px; }
  .work-hub-page .work-hub-header h1 { font-size: 2.18rem; }
  .work-hub-page .work-hub-header > div > p:last-child { margin-top: 2px; }

  .work-hub-page .work-live-card {
    min-height: 148px;
    padding: 15px 18px;
  }

  .work-hub-page .work-live-icon { width: 42px; height: 42px; border-radius: 13px; }
  .work-hub-page .work-live-copy strong { font-size: 1.68rem; }
  .work-hub-page .work-live-meta { margin: 9px 0; padding-top: 9px; }
  .work-hub-page .work-live-actions button { min-height: 44px; }

  .work-hub-page .work-overview article { min-height: 68px; padding: 9px 11px; }
  .work-hub-page .work-overview strong { margin-top: 1px; font-size: 1rem; }

  .work-hub-page .work-meetings .work-list-card { max-height: 148px; }
  .work-hub-page .work-record { min-height: 50px; padding-block: 7px; }

  .work-hub-page .work-board { min-height: 204px; padding: 13px 15px; }
  .work-hub-page .work-tabs { margin: 8px 0 6px; }
  .work-hub-page .work-tabs button { padding-block: 7px; }
  .work-hub-page .work-board .work-queue-list { max-height: 112px; }
  .work-hub-page .work-queue-row { min-height: 44px; padding-block: 5px; }
  .work-hub-page .work-task-add { margin-top: 6px; }

  .work-hub-page > .work-section:nth-of-type(5):has(.work-list-card > .work-empty) .work-section-head,
  .work-hub-page > .work-section:nth-of-type(6):has(.work-list-card > .work-empty) .work-section-head,
  .work-hub-page > .work-section:nth-of-type(7):has(.work-list-card > .work-empty) .work-section-head {
    min-height: 52px;
  }
}

@media (min-width: 1440px) {
  .work-hub-page { max-width: 1220px; }
}
`;
  document.head.appendChild(style);
}

export {};
