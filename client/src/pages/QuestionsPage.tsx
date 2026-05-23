import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, Question } from '../lib/api';
import { getUser } from '../lib/auth';

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

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function groupByDate(questions: Question[]) {
  const groups: Record<string, Question[]> = {};
  for (const q of questions) {
    const label = formatDate(q.created_at);
    if (!groups[label]) groups[label] = [];
    groups[label].push(q);
  }
  return groups;
}

function ReadStatus({ q, isAdmin }: { q: Question; isAdmin: boolean }) {
  if (isAdmin) {
    if (!q.user_read_at) return <span className="receipt-pill unread">Not seen</span>;
    const lastAdminAnswer = q.last_answer_at;
    if (lastAdminAnswer && new Date(q.user_read_at) > new Date(lastAdminAnswer)) {
      return <span className="receipt-pill seen">&#10003;&#10003; Read</span>;
    }
    return <span className="receipt-pill unread">Unread replies</span>;
  } else {
    if (!q.admin_read_at) return <span className="receipt-pill unread">Not seen yet</span>;
    return <span className="receipt-pill seen">&#10003;&#10003; Seen</span>;
  }
}

export default function QuestionsPage() {
  const user = getUser();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const isAdmin = user?.is_admin;

  const { data, isLoading } = useQuery({
    queryKey: ['questions', search],
    queryFn: async () => {
      const params: Record<string, string> = { limit: '50' };
      if (search) params.search = search;
      const res = await api.get('/questions', { params });
      return res.data as { questions: Question[]; total: number };
    },
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
  }

  const grouped = data ? groupByDate([...data.questions].reverse()) : {};

  return (
    <div className="chat-layout">
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-avatar-sm">
            {isAdmin ? 'A' : user?.username?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="chat-header-name">
              {isAdmin ? 'All Conversations' : 'My Questions'}
            </div>
            <div className="chat-header-sub">
              {data ? `${data.total} question${data.total !== 1 ? 's' : ''}` : '...'}
            </div>
          </div>
        </div>
        <form onSubmit={handleSearch} className="chat-search-form">
          <input
            className="chat-search-input"
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search..."
          />
          {search && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setSearchInput(''); }}>
              Clear
            </button>
          )}
        </form>
      </div>

      <div className="chat-body">
        {isLoading ? (
          <div className="spinner" />
        ) : !data?.questions.length ? (
          <div className="empty-state">
            <h3>{search ? 'No results' : 'No questions yet'}</h3>
            <p>{search ? 'Try a different search.' : 'Start by asking your first question!'}</p>
            {!search && !isAdmin && (
              <Link to="/ask" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                Ask a Question
              </Link>
            )}
          </div>
        ) : (
          Object.entries(grouped).map(([dateLabel, qs]) => (
            <div key={dateLabel}>
              <div className="date-divider"><span>{dateLabel}</span></div>
              {qs.map((q) => {
                const hasUnread = isAdmin
                  ? !q.user_read_at || (q.last_answer_at && new Date(q.user_read_at) < new Date(q.last_answer_at))
                  : !q.admin_read_at;

                return (
                  <div
                    key={q.id}
                    className={`chat-bubble-row ${hasUnread ? 'has-unread' : ''}`}
                    onClick={() => navigate(`/questions/${q.id}`)}
                  >
                    <div className="chat-bubble-avatar">
                      {(isAdmin ? q.username : user?.username)?.[0]?.toUpperCase()}
                    </div>
                    <div className="chat-bubble-content">
                      {isAdmin && (
                        <div className="chat-bubble-author">
                          {q.real_name} <span>@{q.username}</span>
                        </div>
                      )}
                      <div className="chat-bubble">
                        <div className="chat-bubble-title">{q.title}</div>
                        <div className="chat-bubble-excerpt">{q.content}</div>
                        {q.image_url && (
                          <div className="bubble-img-thumb">
                            <img src={q.image_url} alt="photo" />
                            <span>Photo</span>
                          </div>
                        )}
                        <div className="chat-bubble-footer">
                          <span className="chat-time">{timeAgo(q.updated_at)}</span>
                          {Number(q.answer_count) > 0 && (
                            <span className="chat-reply-count">
                              {q.answer_count} {Number(q.answer_count) === 1 ? 'reply' : 'replies'}
                            </span>
                          )}
                          {q.tags?.filter(Boolean).map((tag) => (
                            <span key={tag} className="tag" style={{ fontSize: '0.72rem', padding: '0.1rem 0.45rem' }}>{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="chat-bubble-right">
                      <div className="chat-bubble-time">{formatTime(q.updated_at)}</div>
                      <ReadStatus q={q} isAdmin={!!isAdmin} />
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {!isAdmin && (
        <div className="chat-input-bar">
          <Link to="/ask" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
            + Ask a New Question
          </Link>
        </div>
      )}
    </div>
  );
}
