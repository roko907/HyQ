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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatBirthdate(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function isBirthdayToday(birthdate: string | null | undefined) {
  if (!birthdate) return false;
  const today = new Date();
  const bd = new Date(birthdate);
  return bd.getUTCMonth() === today.getMonth() && bd.getUTCDate() === today.getDate();
}

export default function AdminPage() {
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [tab, setTab] = useState<'profile' | 'questions'>('questions');

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

  function selectUser(u: AdminUser) {
    if (selectedUser?.id === u.id) {
      setSelectedUser(null);
    } else {
      setSelectedUser(u);
      setTab('questions');
    }
  }

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
                onClick={() => selectUser(u)}
              >
                <div className="avatar" style={{ width: 40, height: 40, fontSize: '1.1rem', flexShrink: 0 }}>
                  {u.real_name[0]?.toUpperCase()}
                </div>
                <div className="admin-user-info">
                  <div className="admin-user-name">
                    {u.real_name}
                    {isBirthdayToday(u.birthdate) && <span title="Birthday today!"> 🎂</span>}
                  </div>
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
              <p>Click an account on the left to see their details.</p>
            </div>
          ) : (
            <>
              <div className="admin-panel-header">
                <div className="admin-panel-user">
                  <div className="avatar" style={{ width: 44, height: 44, fontSize: '1.2rem', flexShrink: 0 }}>
                    {selectedUser.real_name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem' }}>{selectedUser.real_name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>@{selectedUser.username}</div>
                  </div>
                </div>
                <div className="admin-panel-tabs">
                  <button
                    className={`admin-tab ${tab === 'questions' ? 'active' : ''}`}
                    onClick={() => setTab('questions')}
                  >
                    Questions ({selectedUser.question_count})
                  </button>
                  <button
                    className={`admin-tab ${tab === 'profile' ? 'active' : ''}`}
                    onClick={() => setTab('profile')}
                  >
                    Profile
                  </button>
                </div>
              </div>

              {tab === 'profile' ? (
                <div className="admin-profile-info">
                  <div className="admin-profile-row">
                    <span className="admin-profile-label">Full Name</span>
                    <span className="admin-profile-value">{selectedUser.real_name}</span>
                  </div>
                  <div className="admin-profile-row">
                    <span className="admin-profile-label">Username</span>
                    <span className="admin-profile-value">@{selectedUser.username}</span>
                  </div>
                  <div className="admin-profile-row">
                    <span className="admin-profile-label">Birthday</span>
                    <span className="admin-profile-value">
                      {formatBirthdate(selectedUser.birthdate)
                        ? <>
                            {formatBirthdate(selectedUser.birthdate)}
                            {isBirthdayToday(selectedUser.birthdate) && <span style={{ marginLeft: '0.5rem' }}>🎂 Today!</span>}
                          </>
                        : <span style={{ color: 'var(--text-muted)' }}>Not set</span>
                      }
                    </span>
                  </div>
                  <div className="admin-profile-row">
                    <span className="admin-profile-label">Joined</span>
                    <span className="admin-profile-value">{formatDate(selectedUser.created_at)}</span>
                  </div>
                  <div className="admin-profile-row">
                    <span className="admin-profile-label">Questions</span>
                    <span className="admin-profile-value">{selectedUser.question_count}</span>
                  </div>
                </div>
              ) : (
                <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
