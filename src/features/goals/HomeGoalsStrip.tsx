import { ArrowRight, CircleDot, Plus, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { goalConnections, goalFromEntry, type GoalRecord } from '../../domain/goals';
import { useAppStore } from '../../stores/useAppStore';
import './home-goals-strip.css';

export function HomeGoalsStrip() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const journalEntries = useAppStore((state) => state.journalEntries);
  const entityLinks = useAppStore((state) => state.entityLinks);

  const activeGoals = useMemo(() => journalEntries
    .map(goalFromEntry)
    .filter((goal): goal is GoalRecord => Boolean(goal && !goal.completed))
    .sort((a, b) => (a.targetDate ?? '9999-12-31').localeCompare(b.targetDate ?? '9999-12-31') || b.updatedAt - a.updatedAt)
    .slice(0, 2), [journalEntries]);

  if (pathname !== '/') return null;

  return (
    <section className="home-goals-strip" aria-labelledby="home-goals-title">
      <div className="home-goals-heading">
        <div><p className="section-kicker">Longer threads</p><h2 id="home-goals-title">Goals</h2></div>
        <button onClick={() => navigate('/goals')} type="button">View all <ArrowRight size={15} /></button>
      </div>
      {activeGoals.length === 0 ? (
        <button className="home-goals-empty" onClick={() => navigate('/goals')} type="button">
          <Sparkles size={19} /><span><strong>Nothing bigger needs tracking yet.</strong><small>Add a goal when there is something you want Still to help keep connected.</small></span><Plus size={17} />
        </button>
      ) : (
        <div className="home-goals-list">
          {activeGoals.map((goal) => {
            const connections = goalConnections(goal.id, entityLinks).length;
            return <button key={goal.id} onClick={() => navigate(`/goals?goal=${encodeURIComponent(goal.id)}`)} type="button"><CircleDot size={17} /><span><strong>{goal.title}</strong><small>{connections} connected {connections === 1 ? 'record' : 'records'}{goal.targetDate ? ` · target ${goal.targetDate}` : ''}</small></span><ArrowRight size={15} /></button>;
          })}
        </div>
      )}
    </section>
  );
}
