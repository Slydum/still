const styleId = 'still-v04-work-layout';

if (!document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .still-work-summary{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .still-work-summary .card{min-height:108px;padding:14px}
    @media(max-width:360px){.still-work-summary{gap:8px}.still-work-summary .card{padding:12px}}
  `;
  document.head.appendChild(style);
}
