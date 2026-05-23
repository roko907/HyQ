import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, QuestionDetail } from '../lib/api';
import { getUser } from '../lib/auth';

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function QuestionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = getUser();
  const [answerContent, setAnswerContent] = useState('');
  const [answerError, setAnswerError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['question', id],
    queryFn: async () => {
      const res = await api.get(`/questions/${id}`);
      return res.data as QuestionDetail;
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.answers.length]);

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
      setAnswerError(e.response?.data?.error || 'Failed to send reply');
    },
  });

  const deleteAnswerMutation = useMutation({
    mutationFn: async (answerId: number) => {
      await api.delete(`/questions/${id}/answers/${answerId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['question', id] }),
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (answerContent.trim()) answerMutation.mutate(answerContent.trim());
    }
  }

  if (isLoading) return <div className="spinner" style={{ marginTop: '4rem' }} />;
  if (error || !data) return (
    <div className="empty-state">
      <h3>Question not found</h3>
      <button className="btn btn-outline" style={{ marginTop: '1rem' }} onClick={() => navigate('/questions')}>
        Back
      </button>
    </div>
  );

  const { question, answers } = data;
  const isOwner = currentUser?.id === question.user_id;
  const isAdmin = currentUser?.is_admin;

  const allMessages = [
    { type: 'question' as const, id: `q-${question.id}`, content: question.content, user_id: question.user_id,
      username: question.username, real_name: question.real_name, created_at: question.created_at },
    ...answers.map((a) => ({ type: 'answer' as const, id: `a-${a.id}`, answerId: a.id, content: a.content,
      user_id: a.user_id, username: a.username, real_name: a.real_name, created_at: a.created_at, is_accepted: a.is_accepted })),
  ];

  return (
    <div className="chat-layout">
      <div className="chat-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/questions')} style={{ marginRight: '0.5rem' }}>
          &larr;
        </button>
        <div className="chat-header-info">
          <div className="chat-avatar-sm">
            {question.username[0].toUpperCase()}
          </div>
          <div>
            <div className="chat-header-name">{question.title}</div>
            <div className="chat-header-sub">
              {isAdmin ? `${question.real_name} (@${question.username})` : 'Your question'}
              &nbsp;&bull;&nbsp;{answers.length} {answers.length === 1 ? 'reply' : 'replies'}
            </div>
          </div>
        </div>
        {(isOwner || isAdmin) && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--danger)', marginLeft: 'auto' }}
            onClick={() => { if (confirm('Delete this question?')) deleteQuestionMutation.mutate(); }}
          >
            Delete
          </button>
        )}
      </div>

      <div className="chat-body">
        {allMessages.map((msg) => {
          const isMine = currentUser?.id === msg.user_id;
          const isAdminMsg = msg.username === 'admin';
          return (
            <div key={msg.id} className={`chat-msg-row ${isMine ? 'mine' : 'theirs'}`}>
              {!isMine && (
                <div className="chat-avatar-sm" style={{ flexShrink: 0, alignSelf: 'flex-end' }}>
                  {msg.username[0].toUpperCase()}
                </div>
              )}
              <div className="chat-msg-bubble-wrap">
                {!isMine && (
                  <div className="chat-msg-author">
                    {msg.real_name} {isAdminMsg && <span className="admin-badge">Admin</span>}
                  </div>
                )}
                <div className={`chat-msg-bubble ${isMine ? 'mine' : 'theirs'} ${msg.type === 'question' ? 'first-msg' : ''}`}>
                  {msg.content}
                  {'is_accepted' in msg && msg.is_accepted && (
                    <span className="accepted-dot" title="Accepted answer">&#10003;</span>
                  )}
                </div>
                <div className="chat-msg-time">
                  {formatTime(msg.created_at)}
                  {msg.type === 'answer' && (currentUser?.id === msg.user_id || isAdmin) && (
                    <button
                      className="msg-delete-btn"
                      onClick={() => deleteAnswerMutation.mutate(msg.answerId!)}
                      title="Delete"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-bar">
        {answerError && <div className="error-msg" style={{ margin: '0 0 0.5rem' }}>{answerError}</div>}
        <div className="chat-input-row">
          <textarea
            className="chat-textarea"
            value={answerContent}
            onChange={(e) => setAnswerContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a reply… (Enter to send, Shift+Enter for new line)"
            rows={1}
          />
          <button
            className="btn btn-primary"
            onClick={() => { if (answerContent.trim()) answerMutation.mutate(answerContent.trim()); }}
            disabled={answerMutation.isPending || !answerContent.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
