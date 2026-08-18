import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, uploadImage } from '../lib/api';
import { getUser } from '../lib/auth';

interface BoardPost {
  id: number;
  title: string;
  content: string;
  image_url: string | null;
  real_name: string | null;
  username: string | null;
  comment_count: number;
  is_mine: boolean;
  created_at: string;
  updated_at: string;
}

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

export default function BoardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = getUser();
  const isAdmin = currentUser?.is_admin;

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [boardSearch, setBoardSearch] = useState('');
  const [boardFilter, setBoardFilter] = useState<'all' | 'mine'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['board', currentUser?.id],
    queryFn: async () => {
      const res = await api.get('/board');
      return res.data as { posts: BoardPost[] };
    },
  });

  const posts = data?.posts || [];
  const myPosts = posts.filter((post) => post.is_mine);
  const visiblePosts = posts.filter((post) => {
    const matchesFilter = boardFilter === 'all' || post.is_mine;
    const search = boardSearch.trim().toLowerCase();
    const matchesSearch = !search
      || post.title.toLowerCase().includes(search)
      || post.content.toLowerCase().includes(search);
    return matchesFilter && matchesSearch;
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { title: string; content: string; image_url: string | null }) => {
      const res = await api.post('/board', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['board'] });
      navigate(`/board/${data.post.id}`);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Failed to create post');
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setImageUrl(url);
    } catch {
      setError('Image upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError('Please enter a title');
    if (!content.trim() && !imageUrl) return setError('Please enter some content');
    setError('');
    createMutation.mutate({ title: title.trim(), content: content.trim(), image_url: imageUrl });
  }

  return (
    <div className="board-shell">
      <section className="workspace-hero board-hero">
        <div>
          <span className="eyebrow">Community space</span>
          <h1>Anonymous board</h1>
          <p>{isAdmin ? 'You can review identities here as an admin.' : 'Share a thought, question, or experience without attaching your name.'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setError(''); }}>
          <span className="btn-plus" aria-hidden="true">{showForm ? '×' : '+'}</span>
          {showForm ? 'Close composer' : 'New post'}
        </button>
      </section>

      {!isAdmin && (
        <div className="privacy-strip">
          <span className="privacy-strip-icon" aria-hidden="true">◎</span>
          <span>Your name stays hidden from other students. Only you see the <strong>본인</strong> label on your posts and comments.</span>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '1rem' }}>Write a Post</h3>
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="form-input" type="text" value={title}
                onChange={(e) => setTitle(e.target.value)} placeholder="What's on your mind?" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Content</label>
              <textarea className="form-textarea" value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your post here…" style={{ minHeight: '120px' }} />
            </div>
            {imageUrl && (
              <div className="pending-image-preview" style={{ borderRadius: 'var(--radius)', marginBottom: '1rem', border: '1px solid var(--border)' }}>
                <img src={imageUrl} alt="attachment" />
                <button type="button" className="pending-remove" onClick={() => setImageUrl(null)}>&times; Remove</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <button type="button" className="btn btn-ghost btn-sm upload-btn"
                onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? '...' : '📎 Photo'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || uploading}>
                {createMutation.isPending ? 'Posting…' : 'Post Anonymously'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="board-toolbar">
        <div className="filter-tabs" role="tablist" aria-label="Board posts">
          <button type="button" role="tab" aria-selected={boardFilter === 'all'} className={`filter-tab ${boardFilter === 'all' ? 'active' : ''}`} onClick={() => setBoardFilter('all')}>
            All posts<span>{posts.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={boardFilter === 'mine'} className={`filter-tab ${boardFilter === 'mine' ? 'active' : ''}`} onClick={() => setBoardFilter('mine')}>
            My posts<span>{myPosts.length}</span>
          </button>
        </div>
        <input
          className="board-search"
          type="search"
          value={boardSearch}
          onChange={(e) => setBoardSearch(e.target.value)}
          placeholder="Search the board"
          aria-label="Search the board"
        />
      </div>

      {isLoading ? (
        <div className="loading-state"><div className="spinner" /><span>Loading the board…</span></div>
      ) : !visiblePosts.length ? (
        <div className="empty-state">
          <div className="empty-state-mark">○</div>
          <h3>{boardSearch || boardFilter === 'mine' ? 'No posts match this view' : 'The board is quiet'}</h3>
          <p>{boardSearch || boardFilter === 'mine' ? 'Try another search or switch back to all posts.' : 'Be the first to share something anonymously.'}</p>
        </div>
      ) : (
        <div className="board-list">
          {visiblePosts.map((post) => (
            <div key={post.id} className="board-card" onClick={() => navigate(`/board/${post.id}`)}>
              <div className="board-card-header">
                {isAdmin && post.real_name ? (
                  <span className="board-real-name">{post.real_name}
                    <span className="board-username">@{post.username}</span>
                  </span>
                ) : post.is_mine ? (
                  <span className="board-badge me">본인</span>
                ) : (
                  <span className="anon-chip">Anonymous</span>
                )}
                <span className="board-time">{timeAgo(post.updated_at)}</span>
              </div>
              <div className="board-card-title">{post.title}</div>
              <div className="board-card-excerpt">{post.content}</div>
              {post.image_url && (
                <div className="board-card-img"><img src={post.image_url} alt="post" /></div>
              )}
              <div className="board-card-footer">
                <span className="board-comment-count">
                  {post.comment_count} {Number(post.comment_count) === 1 ? 'comment' : 'comments'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
