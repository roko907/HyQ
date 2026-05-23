import { useState, KeyboardEvent, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, uploadImage } from '../lib/api';

export default function AskQuestionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: async (data: { title: string; content: string; tags: string[]; image_url: string | null }) => {
      const res = await api.post('/questions', data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      navigate(`/questions/${data.question.id}`);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Failed to post question');
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

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 5) {
      setTags([...tags, t]);
      setTagInput('');
    }
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) setTags(tags.slice(0, -1));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    mutation.mutate({ title, content, tags, image_url: imageUrl });
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div className="page-header">
        <h1 className="page-title">Ask a Question</h1>
      </div>
      <div className="card">
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input
              className="form-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's your question? Be specific."
              required
              minLength={5}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Details</label>
            <textarea
              className="form-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Provide all the context someone needs to help you..."
              minLength={1}
              style={{ minHeight: '140px' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Photo (optional)</label>
            <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
              {imageUrl ? (
                <div className="upload-preview">
                  <img src={imageUrl} alt="preview" />
                  <button
                    type="button"
                    className="upload-remove"
                    onClick={(e) => { e.stopPropagation(); setImageUrl(null); }}
                  >
                    &times; Remove
                  </button>
                </div>
              ) : (
                <div className="upload-placeholder">
                  {uploading ? (
                    <span>Uploading...</span>
                  ) : (
                    <>
                      <span className="upload-icon">📷</span>
                      <span>Click to attach a photo</span>
                      <span className="upload-hint">JPG, PNG, GIF up to 10MB</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Tags (up to 5, press Enter or comma)</label>
            <div className="tags-input-wrapper">
              {tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                  <button type="button" className="tag-remove" onClick={() => setTags(tags.filter((t) => t !== tag))}>
                    &times;
                  </button>
                </span>
              ))}
              {tags.length < 5 && (
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={addTag}
                  placeholder={tags.length === 0 ? 'e.g. math, chemistry' : ''}
                />
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending || uploading}>
              {mutation.isPending ? 'Posting...' : 'Post Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
