import './more-phase3.css';
import { DataExportPanel } from './DataExportPanel';
import { MorePage } from './MorePage';

export function MoreSettingsPage() {
  return (
    <>
      <MorePage />
      <div className="shell more-export-shell">
        <DataExportPanel />
      </div>
    </>
  );
}
