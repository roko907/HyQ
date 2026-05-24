import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, User } from '../lib/api';
import { getUser, setAuth, clearAuth } from '../lib/auth';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(month: number, year: number) {
  if (!month) return 31;
  return new Date(year || 2000, month, 0).getDate();
}

function parseBirthdate(dateStr: string | null | undefined) {
  if (!dateStr) return { month: '', day: '', year: '' };
  const d = new Date(dateStr);
  return {
    month: String(d.getUTCMonth() + 1),
    day: String(d.getUTCDate()),
    year: String(d.getUTCFullYear()),
  };
}

function buildBirthdateString(month: string, day: string, year: string): string | null {
  if (!month || !day || !year) return null;
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function isBirthdayToday(month: string, day: string): boolean {
  if (!month || !day) return false;
  const today = new Date();
  return parseInt(month) === today.getMonth() + 1 && parseInt(day) === today.getDate();
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = getUser();

  const [username, setUsername] = useState(currentUser?.username || '');
  const [realName, setRealName] = useState(currentUser?.real_name || '');
  const [bdMonth, setBdMonth] = useState('');
  const [bdDay, setBdDay] = useState('');
  const [bdYear, setBdYear] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const isBirthday = isBirthdayToday(bdMonth, bdDay);

  useEffect(() => {
    api.get('/auth/me').then((res) => {
      const u: User = res.data.user;
      setUsername(u.username);
      setRealName(u.real_name);
      const parsed = parseBirthdate(u.birthdate);
      setBdMonth(parsed.month);
      setBdDay(parsed.day);
      setBdYear(parsed.year);
    }).catch(() => {});
  }, []);

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, string | undefined | null>) => {
      const res = await api.put('/auth/profile', payload);
      return res.data;
    },
    onSuccess: (data) => {
      setAuth(data.token, data.user);
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      setSuccess('Profile updated successfully!');
      setError('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChangingPassword(false);
      setTimeout(() => setSuccess(''), 3500);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Failed to update profile');
      setSuccess('');
    },
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (changingPassword) {
      if (!currentPassword) return setError('Please enter your current password');
      if (!newPassword) return setError('Please enter a new password');
      if (newPassword.length < 6) return setError('New password must be at least 6 characters');
      if (newPassword !== confirmPassword) return setError('Passwords do not match');
    }

    const payload: Record<string, string | undefined | null> = {
      username,
      real_name: realName,
      birthdate: buildBirthdateString(bdMonth, bdDay, bdYear),
    };
    if (changingPassword) {
      payload.current_password = currentPassword;
      payload.new_password = newPassword;
    }
    updateMutation.mutate(payload);
  }

  function handleLogout() {
    clearAuth();
    navigate('/login');
  }

  if (!currentUser) return null;

  const currentYear = new Date().getFullYear();
  const maxDays = daysInMonth(parseInt(bdMonth), parseInt(bdYear));
  const dayOptions = Array.from({ length: maxDays }, (_, i) => i + 1);
  const yearOptions = Array.from({ length: 100 }, (_, i) => currentYear - i);

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto' }}>
      {isBirthday && (
        <div className="birthday-banner">
          <span className="birthday-emoji">🎂</span>
          <div>
            <div className="birthday-title">Happy Birthday, {currentUser.real_name}! 🎉</div>
            <div className="birthday-sub">Wishing you a wonderful day!</div>
          </div>
          <span className="birthday-emoji">🎈</span>
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
      </div>

      <div className="card">
        <div className="profile-header" style={{ marginBottom: '1.5rem' }}>
          <div className="avatar">{(username[0] || '?').toUpperCase()}</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{realName || username}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>@{username}</div>
            {currentUser.is_admin && <span className="admin-badge" style={{ marginTop: '0.25rem', display: 'inline-block' }}>Admin</span>}
          </div>
        </div>

        {success && <div className="success-msg">{success}</div>}
        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Real Name</label>
            <input
              className="form-input"
              type="text"
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              required
              minLength={2}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="form-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Birthday</label>
            <div className="birthday-selects">
              <select
                className="form-select"
                value={bdMonth}
                onChange={(e) => { setBdMonth(e.target.value); setBdDay(''); }}
              >
                <option value="">Month</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1)}>{m}</option>
                ))}
              </select>
              <select
                className="form-select"
                value={bdDay}
                onChange={(e) => setBdDay(e.target.value)}
              >
                <option value="">Day</option>
                {dayOptions.map((d) => (
                  <option key={d} value={String(d)}>{d}</option>
                ))}
              </select>
              <select
                className="form-select"
                value={bdYear}
                onChange={(e) => setBdYear(e.target.value)}
              >
                <option value="">Year</option>
                {yearOptions.map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              We'll celebrate your birthday with a special message 🎂
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label className="form-label" style={{ margin: 0 }}>Password</label>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.78rem' }}
                onClick={() => { setChangingPassword(!changingPassword); setError(''); }}
              >
                {changingPassword ? 'Cancel' : 'Change password'}
              </button>
            </div>
            {changingPassword ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <input
                  className="form-input"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                />
                <input
                  className="form-input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 chars)"
                />
                <input
                  className="form-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>
            ) : (
              <div className="form-input" style={{ background: 'var(--bg)', color: 'var(--text-muted)', userSelect: 'none' }}>
                ••••••••
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--danger)' }}
              onClick={handleLogout}
            >
              Logout
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
