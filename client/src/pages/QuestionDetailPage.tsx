import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, QuestionDetail } from '../lib/api';
import { getUser, isLoggedIn } from '../lib/auth';

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

export default function QuestionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = getUser();
  const loggedIn = isLoggedIn();
  const [answerContent, setAnswerContent] = useState('');
  const [answerError, setAnswerError] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['question', id],
    queryFn: async () => {
      const res = await api.get(`/questions/${id}`);
      return res.data as QuestionDetail;
    },
  });

  const answerMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await api.post(`/questions/${id}/answers`, { content });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question', id] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      setAnswerContent('');
      setAnswerError('');
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      setAnswerError(e.response?.data?.error || 'Failed to post answer');
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (answerId: number) => {
      await api.patch(`/questions/${id}/answers/${answerId}/accept`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['question', id] }),
  });

  const deleteAnswerMutation = useMutation({
    mutationFn: async (answerId: number) => {
      await api.delete(`/questions/${id}/answers/${answerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question', id] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/questions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      navigate('/questions');
    },
  });

  if (isLoading) return <div className="spinner" />;
  if (error || !data) return (
    <div className="empty-state">
      <h3>Question not found</h3>
      <Link to="/questions" className="btn btn-outline" style={{ marginTop: '1rem' }}>
        Back to Questions
      </Link>
    </div>
  );

  const { question, answers } = data;
  const isOwner = currentUser?.id === question.user_id;

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto' }}>
      <Link to="/questions" className="btn btn-ghost btn-sm" style={{ marginBottom: '1rem' }}>
        &larr; Back
      </Link>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.75rem' }}>
          {question.title}
        </h1>
        <div style={{ color: 'var(--text)', lineHeight: 1.7, marginBottom: '1rem', whiteSpace: 'pre-wrap' }}>
          {question.content}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {question.tags?.filter(Boolean).map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
        <hr className="divider" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Asked by <strong>{question.username}</strong> &bull; {timeAgo(question.created_at)}
          </span>
          {isOwner && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                if (confirm('Delete this question?')) deleteQuestionMutation.mutate();
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text)' }}>
        {answers.length} {answers.length === 1 ? 'Answer' : 'Answers'}
      </h2>

      <div style={{ marginBottom: '2rem' }}>
        {answers.length === 0 ? (
          <div className="empty-state" style={{ padding: '1.5rem' }}>
            <p>No answers yet. Be the first to help!</p>
          </div>
        ) : (
          answers.map((answer) => (
            <div key={answer.id} className={`answer-card ${answer.is_accepted ? 'accepted' : ''}`}>
              {answer.is_accepted && (
                <div className="accepted-badge">&#10003; Accepted Answer</div>
              )}
              <div style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: '0.75rem' }}>
                {answer.content}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  by <strong>{answer.username}</strong> &bull; {timeAgo(answer.created_at)}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {isOwner && !answer.is_accepted && (
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => acceptMutation.mutate(answer.id)}
                      disabled={acceptMutation.isPending}
                    >
                      Accept
                    </button>
                  )}
                  {currentUser?.id === answer.user_id && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        if (confirm('Delete this answer?')) deleteAnswerMutation.mutate(answer.id);
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {loggedIn ? (
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Your Answer</h3>
          {answerError && <div className="error-msg">{answerError}</div>}
          <form onSubmit={(e) => { e.preventDefault(); answerMutation.mutate(answerContent); }}>
            <div className="form-group">
              <textarea
                className="form-textarea"
                value={answerContent}
                onChange={(e) => setAnswerContent(e.target.value)}
                placeholder="Write your answer here..."
                required
                minLength={5}
                style={{ minHeight: '140px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={answerMutation.isPending}>
                {answerMutation.isPending ? 'Posting...' : 'Post Answer'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            You need to be logged in to post an answer.
          </p>
          <Link to="/login" className="btn btn-primary">Log In to Answer</Link>
        </div>
      )}
    </div>
  );
}
