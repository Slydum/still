import { Refrigerator } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HealthPage } from './HealthPage';
import './health-phase3.css';
import './health-kitchen-entry.css';

export function HealthRoutePage() {
  const navigate = useNavigate();

  return <>
    <HealthPage />
    <button className="health-kitchen-launcher" onClick={() => navigate('/health/kitchen')} type="button" aria-label="Open Kitchen food inventory">
      <span className="health-kitchen-launcher-icon" aria-hidden="true"><Refrigerator size={19} /></span>
      <span><strong>Kitchen</strong><small>Food inventory</small></span>
    </button>
  </>;
}
