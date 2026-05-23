import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, AdminUser } from '../lib/api';

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

export default function AdminPage() {
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await api.get('/admin/users');
      return res.data as { users: AdminUser[] };
    },
  });

  const { data: questionsData } = useQuery({
    queryKey: ['admin-user-questions', selectedUser?.id],
    queryFn: async () => {
      const res = await api.get(`/admin/users/${selectedUser!.id}/questions`);
      return res.data as { questions: { id: number; title: string; content: string; created_at: string; answer_count: number }[] };
    },
    enabled: !!selectedUser,
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Admin Panel</h1>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {usersData?.users.length ?? 0} registered users
        </span>
      </div>

      <div className="admin-layout">
        <div className="admin-users-list">
          <div className="admin-section-title">Accounts</div>
          {isLoading ? (
            <div className="spinner" />
          ) : usersData?.users.length === 0 ? (
            <div className="empty-state" style={{ padding: '1.5rem' }}>
              <p>No students signed up yet.</p>
            </div>
          ) : (
            usersData?.users.map((u) => (
              <div
                key={u.id}
                className={`admin-user-row ${selectedUser?.id === u.id ? 'active' : ''}`}
                onClick={() => setSelectedUser(selectedUser?.id === u.id ? null : u)}
              >
                <div className="avatar" style={{ width: 40, height: 40, fontSize: '1.1rem', flexShrink: 0 }}>
                  {u.real_name[0]?.toUpperCase()}
                </div>
                <div className="admin-user-info">
                  <div className="admin-user-name">{u.real_name}</div>
                  <div className="admin-user-meta">@{u.username} &bull; {timeAgo(u.created_at)}</div>
                </div>
                <div className="admin-user-qs">{u.question_count} Q</div>
              </div>
            ))
          )}
        </div>

        <div className="admin-questions-panel">
          {!selectedUser ? (
            <div className="empty-state">
              <h3>Select a student</h3>
              <p>Click an account on the left to see their questions.</p>
            </div>
          ) : (
            <>
              <div className="admin-section-title" style={{ padding: '1rem 1.25rem 0.5rem' }}>
                {selectedUser.real_name}'s Questions
              </div>
              {!questionsData ? (
                <div className="spinner" />
              ) : questionsData.questions.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <p>No questions posted yet.</p>
                </div>
              ) : (
                <div className="stack" style={{ padding: '0 1rem 1rem' }}>
                  {questionsData.questions.map((q) => (
                    <Link to={`/questions/${q.id}`} key={q.id} className="question-card">
                      <div className="question-title">{q.title}</div>
                      <div className="question-excerpt">{q.content}</div>
                      <div className="question-meta">
                        <span className={`answer-count ${Number(q.answer_count) > 0 ? 'has-answers' : ''}`}>
                          {q.answer_count} {Number(q.answer_count) === 1 ? 'reply' : 'replies'}
                        </span>
                        <span>{timeAgo(q.created_at)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
