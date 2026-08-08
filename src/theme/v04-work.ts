const styleId = 'still-v04-work-layout';

if (!document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .still-work-summary{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .still-work-summary .card{min-height:108px;padding:14px}
    .still-work-hub .still-work-header p{max-width:320px}
    .still-work-hub .still-work-section{margin-top:24px}
    .still-work-hub .still-work-section-heading{align-items:flex-end;gap:12px}
    .still-work-hub .still-work-section-heading>button,.still-work-record-head button{display:inline-flex;align-items:center;gap:5px;border:0;background:transparent;color:#7561ae;font-weight:800}
    .still-work-record-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .still-work-record-card{padding:15px}
    .still-work-record-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
    .still-work-record-head>strong{color:var(--text-strong);font-size:14px}
    .still-work-quick-task{display:grid;grid-template-columns:1fr 38px;gap:7px;margin-bottom:8px}
    .still-work-quick-task input{min-width:0;min-height:40px;padding:0 12px;border:1px solid rgba(92,78,118,.12);border-radius:13px;background:rgba(255,255,255,.66);color:var(--text-strong);font:inherit}
    .still-work-quick-task button{display:grid;place-items:center;border:0;border-radius:13px;background:rgba(228,220,249,.82);color:#6e58a9}
    .still-work-record-list{display:grid;gap:2px}
    .still-work-task-row,.still-work-event-row{display:grid;width:100%;border:0;border-top:1px solid rgba(92,78,118,.07);background:transparent;color:var(--text-strong);text-align:left}
    .still-work-task-row{grid-template-columns:18px 1fr auto;align-items:center;gap:8px;padding:10px 0}
    .still-work-task-row>span{width:16px;height:16px;border:1.5px solid #a89db8;border-radius:6px}
    .still-work-task-row strong,.still-work-event-row strong{font-size:12px}
    .still-work-task-row small,.still-work-event-row small,.still-work-event-row span{color:var(--muted);font-size:10px}
    .still-work-event-row{grid-template-columns:48px 1fr auto;align-items:center;gap:8px;padding:10px 0}
    .still-work-empty-copy{margin:8px 0 2px;color:var(--muted);font-size:12px}
    .still-work-projects{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .still-work-project{display:grid;gap:12px;padding:15px;text-align:left}
    .still-work-project>div:first-child{display:grid;gap:3px}
    .still-work-project small{text-transform:uppercase;letter-spacing:.08em;color:#8e839d;font-size:9px;font-weight:800}
    .still-work-project strong{color:var(--text-strong);font-size:14px}
    .still-work-project span{color:var(--muted);font-size:11px}
    .still-work-progress{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px}
    .still-work-progress>span{height:6px;overflow:hidden;border-radius:999px;background:rgba(139,116,222,.10)}
    .still-work-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#baa8ef,#8a72d8)}
    .still-work-progress strong{font-size:10px}
    .still-work-empty-card{display:grid;grid-column:1/-1;place-items:center;gap:4px;padding:22px;text-align:center}
    .still-work-empty-card strong{color:var(--text-strong)}
    .still-work-empty-card span{color:var(--muted);font-size:12px}
    .still-work-completed{margin-top:8px;color:var(--muted);font-size:12px}
    .still-work-completed summary{cursor:pointer;font-weight:800}
    .still-work-completed div{display:flex;flex-wrap:wrap;gap:7px;margin-top:7px}
    .still-work-completed button{border:1px solid rgba(92,78,118,.10);border-radius:999px;background:rgba(255,255,255,.58);padding:6px 10px;color:var(--text-strong)}
    .still-work-timeoff{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:14px}
    .still-work-timeoff>div{display:grid;gap:2px}
    .still-work-timeoff small{color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.08em}
    .still-work-timeoff strong{color:var(--text-strong);font-size:14px}
    .still-work-timeoff-list{display:grid;gap:7px;margin-top:8px}
    .still-work-timeoff-list>button{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;text-align:left}
    .still-work-timeoff-list>button>div{display:grid;gap:2px}
    .still-work-timeoff-list small{color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.06em}
    .still-work-timeoff-list strong{color:var(--text-strong);font-size:12px}
    .still-work-timeoff-list>button>span{color:#6d5a9d;font-size:12px;font-weight:800}
    .still-work-pulse{padding:16px}
    .still-work-pulse-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
    .still-work-pulse-head strong{color:var(--text-strong);font-size:15px}.still-work-pulse-head span{color:var(--muted);font-size:11px}
    .still-work-pulse-bar{height:7px;margin-top:10px;overflow:hidden;border-radius:999px;background:rgba(139,116,222,.10)}
    .still-work-pulse-bar span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#baa8ef,#8a72d8)}
    .still-work-pulse-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:14px}
    .still-work-pulse-stats div{display:grid;gap:2px}.still-work-pulse-stats small{color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.06em}.still-work-pulse-stats strong{color:var(--text-strong);font-size:12px}
    .still-work-details-summary{cursor:pointer;list-style:none;padding:14px 16px}.still-work-details-summary::-webkit-details-marker{display:none}
    .still-work-details-summary span{display:flex;align-items:center;gap:8px;color:var(--text-strong);font-weight:800}.still-work-details-summary small{display:block;margin-top:4px;color:var(--muted);font-size:11px}
    .still-work-hub details[open]>.still-work-settings,.still-work-hub details[open]>.still-work-people,.still-work-hub details[open]>.still-work-notes{margin-top:8px}
    .still-work-profile-form{display:grid;gap:12px}
    .still-work-wide-field{display:grid;gap:5px}.still-work-wide-field>span{font-weight:700;color:var(--text-strong);font-size:12px}.still-work-wide-field textarea{width:100%;resize:vertical}
    .still-work-people,.still-work-notes{padding:14px}
    .still-work-people>button,.still-work-notes>button{display:grid;width:100%;gap:2px;padding:10px 0;border:0;border-top:1px solid rgba(92,78,118,.07);background:transparent;text-align:left}
    .still-work-people>button strong,.still-work-notes>button strong{color:var(--text-strong);font-size:12px}.still-work-people>button span,.still-work-notes>button small{color:var(--muted);font-size:10px}
    .still-work-modal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .still-work-modal-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px}.still-work-modal-actions .is-danger{display:inline-flex;align-items:center;gap:5px;margin-right:auto;border:0;background:transparent;color:#a25d6c;font-weight:800}
    .dashboard-v2 .task-empty-state,.dashboard-v2 .upcoming-empty{display:flex!important;width:100%;min-height:44px;align-items:center;justify-content:flex-start!important;gap:0;padding:4px 0 0;text-align:left!important;-webkit-appearance:none;appearance:none}
    .dashboard-v2 .task-empty-state strong,.dashboard-v2 .upcoming-empty strong{display:block;flex:1 1 auto;width:100%;margin:0!important;text-align:left!important;justify-self:start!important}
    @media(max-width:620px){
      .still-work-record-grid,.still-work-projects{grid-template-columns:1fr}
      .still-work-summary .card{min-height:102px;padding:12px}
      .still-work-pulse-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
      .still-work-event-row{grid-template-columns:42px 1fr auto}
      .still-work-timeoff{padding:12px}
    }
    @media(max-width:360px){.still-work-summary{gap:8px}.still-work-summary .card{padding:11px}.still-work-timeoff{gap:5px}.still-work-modal-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}
