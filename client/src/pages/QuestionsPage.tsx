import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, Question } from '../lib/api';
import { getUser } from '../lib/auth';

type QuestionFilter = 'all' | 'waiting' | 'answered';

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

function QuestionStatus({ q, isAdmin }: { q: Question; isAdmin: boolean }) {
  const answered = Number(q.answer_count) > 0;
  if (isAdmin) {
    return <span className={`status-chip ${answered ? 'status-chip-success' : 'status-chip-warning'}`}>
      {answered ? 'Replied' : 'Needs reply'}
    </span>;
  }
  return <span className={`status-chip ${answered ? 'status-chip-success' : 'status-chip-warning'}`}>
    {answered ? 'Answered' : 'Waiting for reply'}
  </span>;
}

export default function QuestionsPage() {
  const user = getUser();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filter, setFilter] = useState<QuestionFilter>('all');
  const isAdmin = user?.is_admin;

  const { data, isLoading } = useQuery({
    queryKey: ['questions', user?.id, search],
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

  const allQuestions = data?.questions || [];
  const waitingQuestions = allQuestions.filter((q) => Number(q.answer_count) === 0);
  const answeredQuestions = allQuestions.filter((q) => Number(q.answer_count) > 0);
  const filteredQuestions = filter === 'waiting'
    ? waitingQuestions
    : filter === 'answered'
      ? answeredQuestions
      : allQuestions;
  const grouped = groupByDate([...filteredQuestions].reverse());
  const firstName = user?.real_name?.split(' ')[0] || user?.username || 'there';

  return (
    <div className="workspace-shell">
      <section className="workspace-hero">
        <div>
          <span className="eyebrow">{isAdmin ? 'Support workspace' : `Welcome back, ${firstName}`}</span>
          <h1>문의 게시판</h1>
          <p>
            {isAdmin
              ? 'Review student inquiries and keep every response clear and helpful.'
              : '문의 내용을 남기고 답변을 한곳에서 확인하세요.'}
          </p>
        </div>
        {!isAdmin && (
          <Link to="/ask" className="btn btn-primary">
            <span className="btn-plus" aria-hidden="true">+</span>
            Ask a question
          </Link>
        )}
      </section>

      <section className="overview-grid" aria-label="Question summary">
        <div className="overview-card overview-card-accent">
           <span className="overview-label">{isAdmin ? 'Total inquiries' : 'My inquiries'}</span>
          <strong>{data?.total ?? '—'}</strong>
          <span className="overview-detail">Your learning history</span>
        </div>
        <div className="overview-card">
          <span className="overview-label">{isAdmin ? 'Needs a reply' : 'Waiting for reply'}</span>
          <strong>{data ? waitingQuestions.length : '—'}</strong>
          <span className="overview-detail">{waitingQuestions.length ? 'Ready for attention' : 'Nothing waiting'}</span>
        </div>
        <div className="overview-card">
          <span className="overview-label">{isAdmin ? 'Replied' : 'Answered'}</span>
          <strong>{data ? answeredQuestions.length : '—'}</strong>
          <span className="overview-detail">Conversations with progress</span>
        </div>
      </section>

      <section className="chat-layout">
        <div className="chat-header">
          <div className="chat-header-info">
            <div className="chat-avatar-sm">
              {isAdmin ? 'A' : user?.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="chat-header-name">
                 {isAdmin ? 'All Inquiries' : 'My Inquiries'}
              </div>
              <div className="chat-header-sub">
                 {data ? `${filteredQuestions.length} shown` : 'Loading inquiries…'}
              </div>
            </div>
          </div>
          <form onSubmit={handleSearch} className="chat-search-form">
            <input
              className="chat-search-input"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search questions"
              aria-label="Search questions"
            />
            {search && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setSearchInput(''); }}>
                Clear
              </button>
            )}
          </form>
        </div>

        <div className="question-toolbar">
          <div className="filter-tabs" role="tablist" aria-label="Question status">
            {([
              ['all', 'All', allQuestions.length],
              ['waiting', isAdmin ? 'Needs reply' : 'Waiting', waitingQuestions.length],
              ['answered', isAdmin ? 'Replied' : 'Answered', answeredQuestions.length],
            ] as [QuestionFilter, string, number][]).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                className={`filter-tab ${filter === value ? 'active' : ''}`}
                onClick={() => setFilter(value)}
              >
                {label}<span>{count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="chat-body">
          {isLoading ? (
             <div className="loading-state"><div className="spinner" /><span>Loading inquiries…</span></div>
          ) : !filteredQuestions.length ? (
            <div className="empty-state">
              <div className="empty-state-mark">Q</div>
              <h3>{search ? 'No matching questions' : filter === 'waiting' ? 'Nothing is waiting' : filter === 'answered' ? 'No answered questions yet' : 'Your inbox is empty'}</h3>
              <p>
                {search
                  ? 'Try a different word or clear the search.'
                  : filter === 'waiting'
                    ? 'You are all caught up for now.'
                    : !isAdmin
                      ? 'Start with a question and build your learning history.'
                       : 'New student inquiries will appear here.'}
              </p>
              {!search && !isAdmin && filter === 'all' && (
                <Link to="/ask" className="btn btn-primary" style={{ marginTop: '1rem' }}>Ask your first question</Link>
              )}
            </div>
          ) : (
            Object.entries(grouped).map(([dateLabel, qs]) => (
              <div key={dateLabel}>
                <div className="date-divider"><span>{dateLabel}</span></div>
                {qs.map((q) => {
                  const hasUnread = Boolean(isAdmin
                    ? !q.user_read_at || (q.last_answer_at && new Date(q.user_read_at) < new Date(q.last_answer_at))
                    : !q.admin_read_at);

                  return (
                    <div
                      key={q.id}
                      className={`chat-bubble-row ${hasUnread ? 'has-unread' : ''}`}
                      onClick={() => navigate(`/questions/${q.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/questions/${q.id}`); }}
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
                              <img src={q.image_url} alt="Attached photo" />
                              <span>Photo attached</span>
                            </div>
                          )}
                          <div className="chat-bubble-footer">
                            <span className="chat-time">{timeAgo(q.updated_at)}</span>
                            <QuestionStatus q={q} isAdmin={!!isAdmin} />
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
              <span className="btn-plus" aria-hidden="true">+</span> Ask a new question
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
