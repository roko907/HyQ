import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, uploadImage } from '../lib/api';

export default function AskQuestionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: async (data: { title: string; content: string; image_url: string | null }) => {
      const res = await api.post('/questions', data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      navigate(`/questions/${data.question.id}`);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Failed to send message');
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadImage(file);
      setImageUrl(url);
    } catch {
      setError('Image upload failed. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError('Please enter a subject');
    if (!message.trim() && !imageUrl) return setError('Please enter a message');
    setError('');
    mutation.mutate({ title: title.trim(), content: message.trim(), image_url: imageUrl });
  }

  return (
    <div className="form-shell">
      <div className="page-header">
        <div>
          <span className="eyebrow">Private conversation</span>
          <h1 className="page-title">Ask a question</h1>
          <p className="page-lede">Share what you are stuck on and come back here when you are ready to follow the reply.</p>
        </div>
      </div>
      <div className="info-callout">
        <span className="info-callout-icon" aria-hidden="true">i</span>
        <div>
          <strong>Your question is only visible to you and the admin.</strong>
          <p>Add context, a screenshot, or an example so the reply can be more helpful.</p>
        </div>
      </div>
      <div className="card">
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Subject</label>
            <input
              className="form-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you need help with?"
              required
              minLength={3}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Message</label>
            <textarea
              className="form-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Explain what you tried and where you got stuck…"
              maxLength={5000}
              style={{ minHeight: '170px' }}
            />
            <div className="field-hint field-hint-right">{message.length}/5000</div>
          </div>

          {imageUrl && (
            <div className="pending-image-preview" style={{ borderRadius: 'var(--radius)', marginBottom: '1rem', border: '1px solid var(--border)' }}>
              <img src={imageUrl} alt="attachment" />
              <button type="button" className="pending-remove" onClick={() => setImageUrl(null)}>&times; Remove</button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Attach photo"
              >
                {uploading ? 'Uploading…' : 'Attach photo'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={mutation.isPending || uploading}>
                {mutation.isPending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
