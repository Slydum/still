import { LIFE_AREAS, LIFE_AREA_IDS, type LifeAreaId } from '../../domain/lifeAreas';

export function LifeAreaPicker({ value, onChange, optional = true }: {
  value?: LifeAreaId;
  onChange: (value?: LifeAreaId) => void;
  optional?: boolean;
}) {
  return (
    <label className="task-field life-area-picker">
      <span>Life area {optional && <small>(optional)</small>}</span>
      <select
        aria-label="Life area"
        onChange={(event) => onChange(event.target.value ? event.target.value as LifeAreaId : undefined)}
        required={!optional}
        value={value ?? ''}
      >
        {optional && <option value="">Not connected</option>}
        {LIFE_AREA_IDS.map((areaId) => (
          <option key={areaId} value={areaId}>{LIFE_AREAS[areaId].label}</option>
        ))}
      </select>
      <small>Connect this record to your Life Garden.</small>
    </label>
  );
}
