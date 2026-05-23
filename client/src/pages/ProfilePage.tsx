import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api, Question } from '../lib/api';
import { getUser, clearAuth } from '../lib/auth';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = getUser();

  const { data, isLoading } = useQuery({
    queryKey: ['my-questions', user?.id],
    queryFn: async () => {
      const res = await api.get('/questions', { params: { limit: 20 } });
      const all = res.data as { questions: Question[] };
      return all.questions.filter((q) => q.user_id === user?.id);
    },
    enabled: !!user,
  });

  function handleLogout() {
    clearAuth();
    navigate('/login');
  }

  if (!user) return null;

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="profile-header">
          <div className="avatar">{user.username[0].toUpperCase()}</div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{user.username}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{user.email}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/ask" className="btn btn-primary btn-sm">Ask a Question</Link>
          <button onClick={handleLogout} className="btn btn-outline btn-sm">Logout</button>
        </div>
      </div>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>My Questions</h2>

      {isLoading ? (
        <div className="spinner" />
      ) : !data || data.length === 0 ? (
        <div className="empty-state">
          <h3>No questions yet</h3>
          <p>You haven't asked any questions. Start learning!</p>
          <Link to="/ask" className="btn btn-primary" style={{ marginTop: '1rem' }}>Ask First Question</Link>
        </div>
      ) : (
        <div className="stack">
          {data.map((q) => (
            <Link to={`/questions/${q.id}`} key={q.id} className="question-card">
              <div className="question-title">{q.title}</div>
              <div className="question-meta">
                <span className={`answer-count ${Number(q.answer_count) > 0 ? 'has-answers' : ''}`}>
                  {q.answer_count} {Number(q.answer_count) === 1 ? 'answer' : 'answers'}
                </span>
                <span>{timeAgo(q.created_at)}</span>
                {q.tags?.filter(Boolean).map((tag) => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
