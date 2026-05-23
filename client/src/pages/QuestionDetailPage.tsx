import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, QuestionDetail, uploadImage } from '../lib/api';
import { getUser } from '../lib/auth';

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ReadReceipt({ question, isAdminView }: { question: QuestionDetail['question']; isAdminView: boolean }) {
  if (isAdminView) {
    const hasAdminReply = false;
    if (!question.user_read_at) return <span className="receipt unread">Delivered</span>;
    return <span className="receipt seen">Seen by student</span>;
  } else {
    if (!question.admin_read_at) return <span className="receipt unread">Not seen yet</span>;
    return <span className="receipt seen">&#10003;&#10003; Seen by admin</span>;
  }
}

export default function QuestionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = getUser();
  const [answerContent, setAnswerContent] = useState('');
  const [answerError, setAnswerError] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    mutationFn: async ({ content, image_url }: { content: string; image_url?: string | null }) => {
      const res = await api.post(`/questions/${id}/answers`, { content, image_url });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question', id] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      setAnswerContent('');
      setAnswerError('');
      setPendingImage(null);
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
    mutationFn: async () => { await api.delete(`/questions/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      navigate('/questions');
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setPendingImage(url);
    } catch {
      setAnswerError('Image upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function handleSend() {
    if (!answerContent.trim() && !pendingImage) return;
    answerMutation.mutate({ content: answerContent.trim(), image_url: pendingImage });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (isLoading) return <div className="spinner" style={{ marginTop: '4rem' }} />;
  if (error || !data) return (
    <div className="empty-state">
      <h3>Question not found</h3>
      <button className="btn btn-outline" style={{ marginTop: '1rem' }} onClick={() => navigate('/questions')}>Back</button>
    </div>
  );

  const { question, answers } = data;
  const isOwner = currentUser?.id === question.user_id;
  const isAdmin = currentUser?.is_admin;

  const allMessages = [
    {
      type: 'question' as const,
      id: `q-${question.id}`,
      content: question.content,
      image_url: question.image_url,
      user_id: question.user_id,
      username: question.username,
      real_name: question.real_name,
      sender_is_admin: false,
      created_at: question.created_at,
    },
    ...answers.map((a) => ({
      type: 'answer' as const,
      id: `a-${a.id}`,
      answerId: a.id,
      content: a.content,
      image_url: a.image_url,
      user_id: a.user_id,
      username: a.username,
      real_name: a.real_name,
      sender_is_admin: a.sender_is_admin,
      created_at: a.created_at,
      is_accepted: a.is_accepted,
    })),
  ];

  const lastMsg = allMessages[allMessages.length - 1];
  const showReceiptUnder = lastMsg?.user_id === currentUser?.id ? lastMsg?.id : null;

  return (
    <div className="chat-layout">
      <div className="chat-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/questions')} style={{ marginRight: '0.5rem' }}>
          &larr;
        </button>
        <div className="chat-header-info">
          <div className="chat-avatar-sm">{question.username[0].toUpperCase()}</div>
          <div>
            <div className="chat-header-name">{question.title}</div>
            <div className="chat-header-sub">
              {isAdmin ? `${question.real_name} (@${question.username})` : 'Your question'}
              &nbsp;&bull;&nbsp;{answers.length} {answers.length === 1 ? 'reply' : 'replies'}
            </div>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ReadReceipt question={question} isAdminView={!!isAdmin} />
          {(isOwner || isAdmin) && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--danger)' }}
              onClick={() => { if (confirm('Delete this question?')) deleteQuestionMutation.mutate(); }}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="chat-body">
        {allMessages.map((msg) => {
          const isMine = currentUser?.id === msg.user_id;
          const isLast = showReceiptUnder === msg.id;
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
                    {msg.real_name}
                    {msg.sender_is_admin && <span className="admin-badge">Admin</span>}
                  </div>
                )}
                <div className={`chat-msg-bubble ${isMine ? 'mine' : 'theirs'} ${msg.type === 'question' ? 'first-msg' : ''}`}>
                  {msg.content && <span>{msg.content}</span>}
                  {msg.image_url && (
                    <div className={`msg-image-wrap ${!msg.content ? 'image-only' : ''}`}>
                      <img
                        src={msg.image_url}
                        alt="attachment"
                        className="msg-image"
                        onClick={() => window.open(msg.image_url!, '_blank')}
                      />
                    </div>
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
                  {isMine && isLast && (
                    <span className={`inline-receipt ${question.admin_read_at ? 'seen' : 'unread'}`}>
                      {isAdmin
                        ? (question.user_read_at ? '&#10003;&#10003; Read' : 'Delivered')
                        : (question.admin_read_at ? '&#10003;&#10003; Seen' : '&#10003; Sent')}
                    </span>
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
        {pendingImage && (
          <div className="pending-image-preview">
            <img src={pendingImage} alt="pending" />
            <button className="pending-remove" onClick={() => setPendingImage(null)}>&times;</button>
          </div>
        )}
        <div className="chat-input-row">
          <button
            type="button"
            className="btn btn-ghost btn-sm upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Attach photo"
          >
            {uploading ? '...' : '📎'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <textarea
            className="chat-textarea"
            value={answerContent}
            onChange={(e) => setAnswerContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a reply… (Enter to send)"
            rows={1}
          />
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={answerMutation.isPending || (!answerContent.trim() && !pendingImage)}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
