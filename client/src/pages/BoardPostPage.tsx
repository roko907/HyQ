import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, uploadImage } from '../lib/api';
import { getUser } from '../lib/auth';

interface BoardComment {
  id: number;
  content: string;
  image_url: string | null;
  is_author: boolean;
  is_me: boolean;
  anon_num: number;
  created_at: string;
}

interface BoardPostDetail {
  post: {
    id: number;
    title: string;
    content: string;
    image_url: string | null;
    is_mine: boolean;
    created_at: string;
    updated_at: string;
  };
  comments: BoardComment[];
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function AnonLabel({ c }: { c: BoardComment }) {
  const parts: React.ReactNode[] = [];

  if (c.is_author) {
    parts.push(<span key="author" className="board-badge author">Author</span>);
  } else {
    parts.push(
      <span key="anon" className="board-anon-name">
        Anonymous{c.anon_num}
      </span>
    );
  }

  if (c.is_me) {
    parts.push(<span key="me" className="board-badge me">You</span>);
  }

  return <div className="board-comment-label">{parts}</div>;
}

export default function BoardPostPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = getUser();
  const [commentText, setCommentText] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['board-post', id],
    queryFn: async () => {
      const res = await api.get(`/board/${id}`);
      return res.data as BoardPostDetail;
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.comments.length]);

  const commentMutation = useMutation({
    mutationFn: async (payload: { content: string; image_url: string | null }) => {
      const res = await api.post(`/board/${id}/comments`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-post', id] });
      queryClient.invalidateQueries({ queryKey: ['board'] });
      setCommentText('');
      setPendingImage(null);
      setError('');
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Failed to post comment');
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      await api.delete(`/board/${id}/comments/${commentId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['board-post', id] }),
  });

  const deletePostMutation = useMutation({
    mutationFn: async () => { await api.delete(`/board/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board'] });
      navigate('/board');
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
      setError('Image upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function handleSend() {
    if (!commentText.trim() && !pendingImage) return;
    commentMutation.mutate({ content: commentText.trim(), image_url: pendingImage });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (isLoading) return <div className="spinner" style={{ marginTop: '4rem' }} />;
  if (!data) return (
    <div className="empty-state">
      <h3>Post not found</h3>
      <button className="btn btn-outline" style={{ marginTop: '1rem' }} onClick={() => navigate('/board')}>Back</button>
    </div>
  );

  const { post, comments } = data;
  const isAdmin = currentUser?.is_admin;

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/board')}>&larr; Board</button>
      </div>

      {/* Post */}
      <div className="card board-post-card">
        <div className="board-post-header">
          <span className="anon-chip large">Anonymous</span>
          <span className="board-time">{formatDate(post.created_at)}</span>
          {(post.is_mine || isAdmin) && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--danger)', marginLeft: 'auto' }}
              onClick={() => { if (confirm('Delete this post?')) deletePostMutation.mutate(); }}
            >
              Delete
            </button>
          )}
        </div>
        <h2 className="board-post-title">{post.title}</h2>
        {post.content && <p className="board-post-content">{post.content}</p>}
        {post.image_url && (
          <div className="board-post-image">
            <img src={post.image_url} alt="post" onClick={() => window.open(post.image_url!, '_blank')} />
          </div>
        )}
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </div>
      </div>

      {/* Comments */}
      <div className="board-comments-section">
        {comments.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem', fontSize: '0.9rem' }}>
            No comments yet. Be the first to reply!
          </div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className={`board-comment ${c.is_me ? 'is-me' : ''}`}>
              <div className="board-comment-avatar">
                {c.is_author ? 'A' : `${c.anon_num}`}
              </div>
              <div className="board-comment-body">
                <AnonLabel c={c} />
                {c.content && <div className="board-comment-text">{c.content}</div>}
                {c.image_url && (
                  <div className="msg-image-wrap">
                    <img src={c.image_url} alt="attachment" className="msg-image"
                      onClick={() => window.open(c.image_url!, '_blank')} />
                  </div>
                )}
                <div className="board-comment-time">
                  {formatTime(c.created_at)}
                  {(c.is_me || isAdmin) && (
                    <button
                      className="msg-delete-btn"
                      onClick={() => deleteCommentMutation.mutate(c.id)}
                      title="Delete"
                    >&times;</button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Comment input */}
      <div className="board-comment-input">
        {error && <div className="error-msg" style={{ margin: '0 0 0.5rem' }}>{error}</div>}
        {pendingImage && (
          <div className="pending-image-preview">
            <img src={pendingImage} alt="pending" />
            <button className="pending-remove" onClick={() => setPendingImage(null)}>&times;</button>
          </div>
        )}
        <div className="chat-input-row">
          <button type="button" className="btn btn-ghost btn-sm upload-btn"
            onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Attach photo">
            {uploading ? '...' : '📎'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
          <textarea
            className="chat-textarea"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a comment anonymously… (Enter to send)"
            rows={1}
          />
          <button className="btn btn-primary" onClick={handleSend}
            disabled={commentMutation.isPending || (!commentText.trim() && !pendingImage)}>
            Send
          </button>
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', textAlign: 'center' }}>
          Your identity is hidden from other users
        </div>
      </div>
    </div>
  );
}
