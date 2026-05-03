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
      }, 3000);

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
          backgroundColor: 'black',
          color: 'yellow',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '3rem',
            transform: 'scale(1.2)'
          }}>
            {/* Warning Triangle */}
            <div style={{
              width: '0',
              height: '0',
              borderLeft: '40px solid transparent',
              borderRight: '40px solid transparent',
              borderBottom: '70px solid #ffcc00',
              position: 'relative',
              marginRight: '-15px',
              zIndex: 2,
              filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.5))'
            }}>
              <span style={{
                position: 'absolute',
                top: '20px',
                left: '-6px',
                color: 'white',
                fontSize: '32px',
                fontWeight: 'bold',
                fontFamily: 'sans-serif'
              }}>!</span>
            </div>
            {/* Red Banner */}
            <div style={{
              backgroundColor: '#e63946',
              color: 'white',
              padding: '10px 30px 10px 40px',
              fontSize: '2rem',
              fontWeight: '900',
              fontFamily: 'sans-serif',
              letterSpacing: '2px',
              borderRadius: '0 8px 8px 0',
              boxShadow: '2px 4px 6px rgba(0,0,0,0.5)',
              zIndex: 1
            }}>
              DISCLAIMER
            </div>
          </div>

          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', lineHeight: '1.5', marginBottom: '2rem' }}>
            For educational use only. Any misuse of this application is the sole responsibility of the user.
          </div>

          {/* Skip Button (takes up space even when hidden so layout doesn't jump) */}
          <div style={{ height: '50px' }}>
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
