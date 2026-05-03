import { useState, useEffect } from 'react';
import Calculator from './components/Calculator';
import Register from './components/Register';
import Login from './components/Login';
import Chat from './components/Chat';
import { clearAuthSession } from './lib/api';
import './index.css';

function App() {
  const [appStage, setAppStage] = useState('calculator'); // 'calculator', 'disclaimer', 'register', 'login', 'chat'
  const [currentUser, setCurrentUser] = useState(null);
  const [showSkip, setShowSkip] = useState(false);

  const handleCalculatorUnlock = () => {
    setAppStage('disclaimer');
    setShowSkip(false);
  };

  useEffect(() => {
    if (appStage === 'disclaimer') {
      const skipTimer = setTimeout(() => {
        setShowSkip(true);
      }, 4000);

      const timer = setTimeout(() => {
        setAppStage('register');
      }, 10000);
      
      return () => {
        clearTimeout(skipTimer);
        clearTimeout(timer);
      };
    }
  }, [appStage]);

  const handleRegisterSuccess = () => {
    setAppStage('login');
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
    setAppStage('chat');
  };

  const handleLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
    setAppStage('calculator');
  };

  return (
    <div className="app-container">
      {appStage === 'disclaimer' && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: '#222222',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          zIndex: 9999,
          fontFamily: 'sans-serif'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}>
            {/* Warning Triangle */}
            <div style={{
              width: '0',
              height: '0',
              borderLeft: '22px solid transparent',
              borderRight: '22px solid transparent',
              borderBottom: '40px solid #f3a738',
              position: 'relative',
              marginRight: '15px',
            }}>
              <span style={{
                position: 'absolute',
                top: '12px',
                left: '-4px',
                color: '#222222',
                fontSize: '20px',
                fontWeight: '900',
              }}>!</span>
            </div>
            {/* Disclaimer Text */}
            <div style={{
              color: 'white',
              fontSize: '2.2rem',
              fontWeight: 'bold',
              letterSpacing: '1px',
            }}>
              DISCLAIMER
            </div>
          </div>

          <div style={{ 
            fontSize: '1.25rem', 
            lineHeight: '1.6', 
            maxWidth: '650px',
            color: '#e0e0e0'
          }}>
            This application is intended for <span style={{ color: '#f3a738', fontWeight: 'bold' }}>educational purposes only.</span> By proceeding, you acknowledge that any misuse of this tool is sole responsibility of the user.
          </div>

          {/* Skip Button (takes up space even when hidden so layout doesn't jump) */}
          <div style={{ height: '50px', marginTop: '2.5rem' }}>
            {showSkip && (
              <button 
                onClick={() => setAppStage('register')}
                style={{
                  padding: '10px 40px',
                  fontSize: '1.2rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.5)',
                  borderRadius: '25px',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                  e.target.style.borderColor = 'white';
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                }}
              >
                Skip
              </button>
            )}
          </div>
        </div>
      )}
      <Calculator 
        hidden={appStage !== 'calculator'} 
        onUnlock={handleCalculatorUnlock} 
      />
      <Register 
        hidden={appStage !== 'register'} 
        onRegisterClick={handleRegisterSuccess}
        onGoToLogin={() => setAppStage('login')}
      />
      <Login 
        hidden={appStage !== 'login'} 
        onLogin={handleLogin}
        onGoToRegister={() => setAppStage('register')}
      />
      <Chat 
        hidden={appStage !== 'chat'} 
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    </div>
  );
}

export default App;
