import { useState } from 'react';
import { authApi } from '../lib/api';

function Register({ hidden, onRegisterClick, onGoToLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setMessage('Username and password are required.');
      return;
    }

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      await authApi.register({
        username: username.trim(),
        password,
        email: email.trim()
      });

      setMessage('Registration successful! Redirecting...');
      setUsername('');
      setPassword('');
      setEmail('');
      setTimeout(() => {
        onRegisterClick();
      }, 1200);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="register-view" className={`view ${hidden ? 'hidden' : 'active'}`}>
      <div className="login-container">
        <form className="login-form" onSubmit={handleRegister}>
          <h2>Create Account</h2>
          <p className="subtitle">Secure Channel Registration</p>
          
          {message && <p className={`message-box ${message.includes('success') ? 'success' : 'error'}`}>{message}</p>}

          <div className="input-group">
            <ion-icon name="person-outline"></ion-icon>
            <input 
              type="text" 
              placeholder="Choose Username" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
            />
          </div>

          <div className="input-group">
            <ion-icon name="mail-outline"></ion-icon>
            <input 
              type="email" 
              placeholder="Email (Optional)" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>

          <div className="input-group">
            <ion-icon name="lock-closed-outline"></ion-icon>
            <input 
              type="password" 
              placeholder="Choose Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>

          <button type="submit" className="login-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Registering...' : 'Register'}
          </button>

          <div className="form-footer">
            <span className="link" onClick={() => { onGoToLogin(); setMessage(''); }}>
              Already registered? Login
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Register;
