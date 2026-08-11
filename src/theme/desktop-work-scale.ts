const styleId = 'still-desktop-work-scale';

if (!document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
@media (min-width: 1280px) {
  .work-hub-page {
    width: min(100%, 1460px);
    max-width: 1460px;
    padding: 28px clamp(32px, 3.4vw, 58px) 72px;
    grid-template-rows: 82px 100px minmax(154px, auto) auto;
    column-gap: 18px;
    row-gap: 12px;
  }

  .work-hub-page .work-hub-header {
    height: 82px;
  }

  .work-hub-page .work-hub-header h1 {
    font-size: 2.65rem;
  }

  .work-hub-page .work-hub-header > div > p:last-child {
    margin-top: 6px;
    font-size: .9rem;
  }

  .work-header-details {
    min-height: 40px;
    padding-inline: 15px;
    font-size: .78rem;
  }

  .work-hub-page .work-live-card {
    padding: 22px 24px 20px;
    border-radius: 24px;
  }

  .work-hub-page .work-live-top {
    gap: 12px;
  }

  .work-hub-page .work-live-icon {
    width: 52px;
    height: 52px;
    border-radius: 16px;
  }

  .work-hub-page .work-live-copy small {
    font-size: .72rem;
  }

  .work-hub-page .work-live-copy strong {
    font-size: 2.15rem;
  }

  .work-hub-page .work-live-eye {
    width: 42px;
    height: 42px;
  }

  .work-hub-page .work-live-meta {
    margin: 14px 0 15px;
    padding-top: 13px;
  }

  .work-hub-page .work-live-meta span {
    font-size: .72rem;
  }

  .work-hub-page .work-live-actions {
    gap: 10px;
  }

  .work-hub-page .work-live-actions button {
    min-height: 48px;
    font-size: .92rem;
  }

  .work-hub-page .work-overview {
    height: 100px;
    border-radius: 22px;
  }

  .work-hub-page .work-overview article {
    height: 98px;
    padding: 14px 18px;
  }

  .work-hub-page .work-overview small {
    font-size: .68rem;
  }

  .work-hub-page .work-overview strong {
    margin-top: 6px;
    font-size: 1.2rem;
  }

  .work-hub-page .work-overview span {
    margin-top: 5px;
    font-size: .66rem;
  }

  .work-hub-page .work-section-head {
    min-height: 40px;
    margin-bottom: 8px;
  }

  .work-hub-page .work-section-head h2 {
    font-size: 1.18rem;
  }

  .work-hub-page .work-section-head p {
    margin-top: 3px;
    font-size: .7rem;
  }

  .work-hub-page .work-section-head > button {
    min-height: 36px;
    padding-inline: 11px;
    font-size: .72rem;
  }

  .work-hub-page .work-meetings .work-list-card {
    height: 104px;
    max-height: 104px;
    border-radius: 18px;
  }

  .work-hub-page .work-meetings .work-record {
    min-height: 50px;
    padding: 9px 12px;
  }

  .work-hub-page .work-meetings .work-record strong {
    font-size: .78rem;
  }

  .work-hub-page .work-meetings .work-record small {
    margin-top: 2px;
    font-size: .66rem;
  }

  .work-hub-page .work-board {
    padding: 15px 16px;
    border-radius: 21px;
  }

  .work-hub-page .work-board-top {
    min-height: 24px;
  }

  .work-hub-page .work-board-top strong {
    font-size: .92rem;
  }

  .work-hub-page .work-board-top span {
    font-size: .66rem;
  }

  .work-hub-page .work-tabs {
    margin: 7px 0 6px;
    padding: 4px;
    border-radius: 12px;
  }

  .work-hub-page .work-tabs button {
    min-height: 32px;
    padding: 6px 4px;
    font-size: .66rem;
  }

  .work-hub-page .work-board .work-queue-list {
    height: 48px;
    max-height: 48px;
  }

  .work-hub-page .work-queue-row {
    min-height: 46px;
    padding: 5px 3px;
  }

  .work-hub-page .work-queue-row > span:first-child {
    width: 31px;
    height: 31px;
    flex-basis: 31px;
  }

  .work-hub-page .work-queue-row strong {
    font-size: .76rem;
  }

  .work-hub-page .work-queue-row small {
    font-size: .63rem;
  }

  .work-hub-page .work-task-add {
    grid-template-columns: 1fr 40px;
    gap: 7px;
    margin-top: 7px;
  }

  .work-hub-page .work-task-add input,
  .work-hub-page .work-task-add button {
    min-height: 40px;
    border-radius: 11px;
  }

  .work-quick-access {
    min-height: 64px;
    margin-top: 3px;
    grid-template-columns: 142px repeat(3, minmax(132px, 1fr)) minmax(270px, 1.6fr);
    border-radius: 18px;
  }

  .work-quick-label,
  .work-quick-access > button {
    min-height: 62px;
    gap: 9px;
    padding-inline: 15px;
  }

  .work-quick-label {
    font-size: .75rem;
  }

  .work-quick-access > button strong {
    font-size: .76rem;
  }

  .work-quick-access > button small {
    margin-top: 2px;
    font-size: .62rem;
  }
}

@media (min-width: 1600px) {
  .work-hub-page {
    max-width: 1500px;
    padding-left: 64px;
    padding-right: 64px;
  }

  .work-hub-page .work-hub-header h1 {
    font-size: 2.78rem;
  }

  .work-hub-page .work-live-copy strong {
    font-size: 2.25rem;
  }
}
`;
  document.head.appendChild(style);
}

export {};
