const styleId = 'still-desktop-work-laptop';

if (!document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
@media (max-width: 1023px) {
  .work-header-details,
  .work-quick-access {
    display: none !important;
  }
}

@media (min-width: 1024px) {
  .work-hub-page {
    width: min(100%, 1220px);
    max-width: 1220px;
    min-height: 100dvh;
    margin: 0 auto;
    padding: 28px clamp(28px, 3vw, 46px) 64px;
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 16px 18px;
    align-items: start;
  }

  .work-hub-page .work-hub-header {
    grid-column: 1 / -1;
    min-height: 62px;
    margin: 0;
    align-items: flex-start;
  }

  .work-hub-page .work-hub-back { display: none; }
  .work-hub-page .work-hub-header h1 { font-size: 2.45rem; }
  .work-hub-page .work-hub-header > div > p:last-child { max-width: 620px; margin-top: 4px; }

  .work-header-details {
    margin-left: auto;
    min-height: 38px;
    padding: 0 13px;
    border: 1px solid rgba(93,78,119,.09);
    border-radius: 12px;
    background: rgba(255,255,255,.52);
    color: #675982;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: .72rem;
    font-weight: 800;
  }

  .work-hub-page .work-live-card {
    grid-column: 1 / span 5;
    min-height: 166px;
    margin: 0;
    padding: 19px 21px;
    border: 1px solid rgba(100,79,153,.11);
    border-radius: 23px;
    background:
      radial-gradient(circle at 94% 8%, rgba(224,213,255,.46), transparent 12rem),
      linear-gradient(135deg, rgba(255,255,255,.86), rgba(249,244,255,.76));
    box-shadow: 0 15px 34px rgba(72,57,98,.045);
    backdrop-filter: blur(16px) saturate(108%);
  }

  .work-hub-page .work-live-actions button:not(:disabled) {
    border-color: transparent;
    color: #fff;
    background: linear-gradient(135deg, #8870c8, #7259ad);
    box-shadow: 0 7px 18px rgba(105,82,158,.15);
  }

  .work-hub-page .work-live-actions button:disabled { background: rgba(255,255,255,.5); }
  .work-hub-page .work-live-eye { transition: background .16s ease, transform .16s ease; }
  .work-hub-page .work-live-eye:hover { background: rgba(255,255,255,.92); transform: translateY(-1px); }

  .work-hub-page .work-overview {
    grid-column: 6 / -1;
    min-height: 166px;
    align-self: stretch;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0;
    overflow: hidden;
    border: 1px solid rgba(93,78,119,.09);
    border-radius: 22px;
    background: rgba(255,255,255,.48);
    box-shadow: none;
    backdrop-filter: blur(12px);
  }

  .work-hub-page .work-overview article {
    min-height: 164px;
    padding: 19px 15px;
    border: 0;
    border-right: 1px solid rgba(93,78,119,.07);
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .work-hub-page .work-overview article:last-child { border-right: 0; }
  .work-hub-page .work-overview strong { margin-top: 7px; font-size: 1.22rem; }
  .work-hub-page .work-overview span { margin-top: 4px; opacity: .74; white-space: normal; }

  .work-hub-page .work-meetings {
    grid-column: 1 / span 5;
    margin: 0;
  }

  .work-hub-page .work-board {
    grid-column: 6 / -1;
    min-height: 232px;
    margin: 0;
    padding: 17px;
    border: 1px solid rgba(93,78,119,.09);
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

  .work-quick-access {
    grid-column: 1 / -1;
    min-height: 64px;
    display: grid;
    grid-template-columns: 128px repeat(3, minmax(118px, 1fr)) minmax(240px, 1.55fr);
    overflow: hidden;
    border: 1px solid rgba(93,78,119,.085);
    border-radius: 18px;
    background: rgba(255,255,255,.43);
    box-shadow: 0 9px 28px rgba(72,57,98,.025);
    backdrop-filter: blur(12px);
  }

  .work-quick-label,
  .work-quick-access > button {
    min-width: 0;
    min-height: 62px;
    border: 0;
    border-right: 1px solid rgba(93,78,119,.07);
    background: transparent;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 14px;
    text-align: left;
  }

  .work-quick-label {
    color: #625672;
    font-size: .74rem;
    font-weight: 850;
  }

  .work-quick-label svg,
  .work-quick-access > button > svg:first-child { color: #7863b2; flex: 0 0 auto; }
  .work-quick-access > button:last-child { border-right: 0; }
  .work-quick-access > button:hover { background: rgba(116,92,173,.045); }
  .work-quick-access > button > span { flex: 1; min-width: 0; }
  .work-quick-access > button strong,
  .work-quick-access > button small { display: block; }
  .work-quick-access > button strong { font-size: .76rem; font-weight: 830; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .work-quick-access > button small { margin-top: 2px; color: #8a8293; font-size: .62rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .work-quick-access > button > svg:last-child { flex: 0 0 auto; color: #8b7aa9; }

  .work-mobile-secondary { display: none; }

  .work-hub-page .work-record,
  .work-hub-page .work-queue-row,
  .work-hub-page .work-section-head > button,
  .work-hub-page .work-task-add button,
  .work-header-details,
  .work-quick-access > button {
    transition: background .16s ease, border-color .16s ease, transform .16s ease;
  }

  .work-hub-page .work-record:hover,
  .work-hub-page .work-queue-row:hover { background: rgba(118,96,172,.04); }
  .work-hub-page .work-section-head > button:hover,
  .work-hub-page .work-task-add button:hover { background: rgba(113,94,168,.12); }
  .work-header-details:hover { background: rgba(113,94,168,.075); }

  .work-hub-page button:focus-visible,
  .work-hub-page input:focus-visible,
  .work-hub-page select:focus-visible,
  .work-hub-page textarea:focus-visible {
    outline: 3px solid rgba(122,98,184,.24);
    outline-offset: 2px;
  }

  .work-desktop-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 120;
    display: grid;
    place-items: center;
    padding: 28px;
    background: rgba(44,35,58,.22);
    backdrop-filter: blur(7px);
  }

  .work-desktop-modal {
    width: min(100%, 520px);
    max-height: min(760px, calc(100dvh - 56px));
    overflow: auto;
    padding: 20px;
    border: 1px solid rgba(91,74,125,.12);
    border-radius: 24px;
    background: linear-gradient(145deg, rgba(255,255,255,.98), rgba(250,246,255,.97));
    box-shadow: 0 28px 80px rgba(49,36,70,.2);
  }

  .work-desktop-modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 17px;
  }

  .work-desktop-modal-head h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.55rem;
    letter-spacing: -.02em;
  }

  .work-desktop-modal-head > button {
    width: 38px;
    height: 38px;
    border: 0;
    border-radius: 12px;
    background: rgba(113,94,168,.07);
    color: #6f6281;
    display: grid;
    place-items: center;
  }

  .work-desktop-modal .work-inline-form {
    margin: 0;
    padding: 0;
    gap: 13px;
    border: 0;
    background: transparent;
  }

  .work-modal-field {
    display: grid;
    gap: 6px;
    color: #5f566b;
    font-size: .7rem;
    font-weight: 800;
  }

  .work-modal-field > span small { color: #958da0; font-weight: 650; }
  .work-desktop-modal .work-modal-field input,
  .work-desktop-modal .work-modal-field select,
  .work-desktop-modal .work-modal-field textarea {
    min-height: 44px;
    margin: 0;
    border: 1px solid rgba(93,78,119,.12);
    border-radius: 13px;
    background: rgba(255,255,255,.86);
  }

  .work-desktop-modal .work-modal-field textarea { min-height: 100px; }

  .work-modal-actions {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    gap: 8px;
    align-items: center;
    margin-top: 3px;
  }

  .work-modal-primary,
  .work-modal-secondary,
  .work-modal-danger,
  .work-modal-danger-link {
    min-height: 40px;
    border-radius: 12px;
    padding: 0 13px;
    font-size: .72rem;
    font-weight: 820;
  }

  .work-modal-primary {
    border: 0;
    color: #fff;
    background: linear-gradient(135deg, #8770c5, #7057aa);
  }

  .work-modal-secondary {
    border: 1px solid rgba(93,78,119,.11);
    background: rgba(255,255,255,.72);
    color: #645a70;
  }

  .work-modal-danger-link {
    justify-self: start;
    border: 0;
    padding-left: 4px;
    color: #a44f5b;
    background: transparent;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .work-modal-danger {
    border: 0;
    color: #fff;
    background: #a8515d;
  }

  .work-delete-confirm {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 12px 13px;
    border: 1px solid rgba(169,80,91,.14);
    border-radius: 14px;
    background: rgba(169,80,91,.055);
  }

  .work-delete-confirm > div:first-child { flex: 1; min-width: 0; }
  .work-delete-confirm strong,
  .work-delete-confirm span { display: block; }
  .work-delete-confirm strong { font-size: .76rem; color: #86434d; }
  .work-delete-confirm span { margin-top: 3px; color: #8b7378; font-size: .65rem; line-height: 1.35; }
  .work-delete-confirm > div:last-child { display: flex; gap: 7px; flex: 0 0 auto; }

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
  .work-header-details { min-height: 34px; }

  .work-hub-page .work-live-card {
    min-height: 146px;
    padding: 15px 18px;
  }

  .work-hub-page .work-live-icon { width: 42px; height: 42px; border-radius: 13px; }
  .work-hub-page .work-live-copy strong { font-size: 1.68rem; }
  .work-hub-page .work-live-meta { margin: 9px 0; padding-top: 9px; }
  .work-hub-page .work-live-actions button { min-height: 44px; }

  .work-hub-page .work-overview { min-height: 146px; }
  .work-hub-page .work-overview article { min-height: 144px; padding: 14px 11px; }
  .work-hub-page .work-overview strong { margin-top: 4px; font-size: 1.05rem; }
  .work-hub-page .work-overview span { margin-top: 2px; font-size: .61rem; }

  .work-hub-page .work-meetings .work-list-card { max-height: 148px; }
  .work-hub-page .work-record { min-height: 50px; padding-block: 7px; }

  .work-hub-page .work-board { min-height: 204px; padding: 13px 15px; }
  .work-hub-page .work-tabs { margin: 8px 0 6px; }
  .work-hub-page .work-tabs button { padding-block: 7px; }
  .work-hub-page .work-board .work-queue-list { max-height: 112px; }
  .work-hub-page .work-queue-row { min-height: 44px; padding-block: 5px; }
  .work-hub-page .work-task-add { margin-top: 6px; }

  .work-quick-access,
  .work-quick-label,
  .work-quick-access > button { min-height: 56px; }
}

@media (min-width: 1440px) {
  .work-hub-page { max-width: 1260px; }
}
`;
  document.head.appendChild(style);
}

export {};
