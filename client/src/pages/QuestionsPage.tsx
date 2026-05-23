import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, Question } from '../lib/api';
import { isLoggedIn } from '../lib/auth';

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

export default function QuestionsPage() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const loggedIn = isLoggedIn();

  const { data, isLoading } = useQuery({
    queryKey: ['questions', search, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: 10 };
      if (search) params.search = search;
      const res = await api.get('/questions', { params });
      return res.data as { questions: Question[]; total: number; page: number };
    },
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  const totalPages = data ? Math.ceil(data.total / 10) : 1;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Questions</h1>
        {loggedIn && (
          <Link to="/ask" className="btn btn-primary">
            + Ask a Question
          </Link>
        )}
      </div>

      <form className="search-bar" onSubmit={handleSearch}>
        <input
          className="form-input"
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search questions..."
        />
        <button type="submit" className="btn btn-outline">
          Search
        </button>
        {search && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
          >
            Clear
          </button>
        )}
      </form>

      {isLoading ? (
        <div className="spinner" />
      ) : data?.questions.length === 0 ? (
        <div className="empty-state">
          <h3>No questions yet</h3>
          <p>
            {search ? 'No results for your search.' : 'Be the first to ask a question!'}
          </p>
          {loggedIn && !search && (
            <Link to="/ask" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Ask a Question
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="stack">
            {data?.questions.map((q) => (
              <Link to={`/questions/${q.id}`} key={q.id} className="question-card">
                <div className="question-title">{q.title}</div>
                <div className="question-excerpt">{q.content}</div>
                <div className="question-meta">
                  <span className={`answer-count ${Number(q.answer_count) > 0 ? 'has-answers' : ''}`}>
                    {q.answer_count} {Number(q.answer_count) === 1 ? 'answer' : 'answers'}
                  </span>
                  <span>by <strong>{q.username}</strong></span>
                  <span>{timeAgo(q.created_at)}</span>
                  {q.tags?.filter(Boolean).map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </button>
              <span style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {page} / {totalPages}
              </span>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
