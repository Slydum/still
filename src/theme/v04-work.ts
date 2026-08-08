const styleId = 'still-v04-work-layout';

if (!document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .still-work-summary{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .still-work-summary .card{min-height:108px;padding:14px}
    @media(max-width:360px){.still-work-summary{gap:8px}.still-work-summary .card{padding:12px}}
    .dashboard-v2 .task-empty-state,.dashboard-v2 .upcoming-empty{display:flex!important;width:100%;min-height:44px;align-items:center;justify-content:flex-start!important;gap:0;padding:4px 0 0;text-align:left!important;-webkit-appearance:none;appearance:none}
    .dashboard-v2 .task-empty-state strong,.dashboard-v2 .upcoming-empty strong{display:block;flex:1 1 auto;width:100%;margin:0!important;text-align:left!important;justify-self:start!important}
  `;
  document.head.appendChild(style);
}
