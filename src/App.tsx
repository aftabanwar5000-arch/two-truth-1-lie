import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';

const BackgroundAnimals = () => {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', overflow: 'hidden', pointerEvents: 'none', opacity: 0.15, zIndex: 0 }}>
      {/* Existing */}
      <div style={{ position: 'absolute', top: '10%', left: '10%', fontSize: '6rem', animation: 'float-animal 80s infinite alternate' }}>🐼</div>
      <div style={{ position: 'absolute', top: '70%', left: '20%', fontSize: '8rem', animation: 'float-animal 95s infinite alternate-reverse' }}>🦊</div>
      <div style={{ position: 'absolute', top: '20%', left: '80%', fontSize: '7.5rem', animation: 'float-animal 110s infinite alternate' }}>🐯</div>
      <div style={{ position: 'absolute', top: '80%', left: '75%', fontSize: '6.5rem', animation: 'float-animal 85s infinite alternate-reverse' }}>🦁</div>
      <div style={{ position: 'absolute', top: '40%', left: '50%', fontSize: '9rem', animation: 'float-animal 105s infinite alternate' }}>🐵</div>
      
      {/* New additions */}
      <div style={{ position: 'absolute', top: '15%', left: '45%', fontSize: '5.5rem', animation: 'float-animal 90s infinite alternate' }}>🐶</div>
      <div style={{ position: 'absolute', top: '50%', left: '15%', fontSize: '6.5rem', animation: 'float-animal 100s infinite alternate-reverse' }}>🐱</div>
      <div style={{ position: 'absolute', top: '85%', left: '40%', fontSize: '7rem', animation: 'float-animal 82s infinite alternate' }}>🐻</div>
      <div style={{ position: 'absolute', top: '30%', left: '90%', fontSize: '5rem', animation: 'float-animal 115s infinite alternate-reverse' }}>🐨</div>
      <div style={{ position: 'absolute', top: '65%', left: '85%', fontSize: '6.5rem', animation: 'float-animal 120s infinite alternate' }}>🐹</div>
      <div style={{ position: 'absolute', top: '5%', left: '60%', fontSize: '6rem', animation: 'float-animal 108s infinite alternate-reverse' }}>🐸</div>
      <div style={{ position: 'absolute', top: '55%', left: '35%', fontSize: '8.5rem', animation: 'float-animal 88s infinite alternate' }}>🐷</div>
      <div style={{ position: 'absolute', top: '90%', left: '10%', fontSize: '7.5rem', animation: 'float-animal 98s infinite alternate-reverse' }}>🐰</div>
    </div>
  );
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const socket: Socket = io(BACKEND_URL, {
  autoConnect: false
});

type Player = { id: string, name: string, score: number };
type Statement = { id: string, text: string, isLie?: boolean };

function App() {
  const [view, setView] = useState<'home' | 'create_game' | 'join_game' | 'lobby' | 'submission' | 'game'>('home');
  const [playerCount, setPlayerCount] = useState<number | string>(10);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [hostIsPlaying, setHostIsPlaying] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  
  // Submission State
  const [submissionStep, setSubmissionStep] = useState<1 | 2 | 3 | 'done'>(1);
  const [truth1, setTruth1] = useState('');
  const [truth2, setTruth2] = useState('');
  const [lie, setLie] = useState('');
  const [submittedCount, setSubmittedCount] = useState(0);

  // Game state
  const [gameStatus, setGameStatus] = useState<'lobby' | 'submitting' | 'playing' | 'revealed' | 'finished'>('lobby');
  const [roundInfo, setRoundInfo] = useState<{ roundIndex: number, subjectId: string, subjectName: string, totalRounds: number } | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answeredCount, setAnsweredCount] = useState(0);
  const [eligiblePlayersCount, setEligiblePlayersCount] = useState(0);

  const isPlayer = players.some(p => p.id === socket.id);

  useEffect(() => {
    socket.connect();

    socket.on('room_created', ({ code }) => {
      setRoomCode(code);
      setIsHost(true);
      setView('lobby');
    });

    socket.on('joined_success', ({ code }) => {
      setRoomCode(code);
      setIsHost(false);
      setView('lobby');
    });

    socket.on('player_joined', ({ players }) => {
      setPlayers(players);
    });

    socket.on('submission_started', () => {
      setGameStatus('submitting');
      setSubmissionStep(1);
      setTruth1('');
      setTruth2('');
      setLie('');
      setSubmittedCount(0);
      setView('submission');
    });

    socket.on('player_submitted', ({ totalSubmitted }) => {
      setSubmittedCount(totalSubmitted);
    });

    socket.on('round_started', ({ roundIndex, subjectId, subjectName, statements, totalRounds }) => {
      setRoundInfo({ roundIndex, subjectId, subjectName, totalRounds });
      setStatements(statements);
      setSelectedStatementId(null);
      setAnswers({});
      setAnsweredCount(0);
      setGameStatus('playing');
      setView('game');
    });

    socket.on('player_answered', ({ totalAnswers, eligiblePlayersCount }) => {
      setAnsweredCount(totalAnswers);
      setEligiblePlayersCount(eligiblePlayersCount);
    });

    socket.on('round_revealed', ({ statements, answers, players }) => {
      setStatements(statements);
      setAnswers(answers);
      setPlayers(players);
      setGameStatus('revealed');
    });

    socket.on('game_over', ({ players }) => {
      setPlayers(players);
      setGameStatus('finished');
      setView('game'); // Finished state is handled in game view
    });

    socket.on('game_restarted', ({ players }) => {
      setPlayers(players);
      setGameStatus('lobby');
      setSubmissionStep(1);
      setTruth1('');
      setTruth2('');
      setLie('');
      setSelectedStatementId(null);
      setRoundInfo(null);
      setView('lobby');
    });

    socket.on('kicked', () => {
      alert("You have been kicked from the room by the host.");
      leaveGame();
    });

    socket.on('error', (msg) => {
      alert(msg);
    });

    return () => {
      socket.off('room_created');
      socket.off('joined_success');
      socket.off('player_joined');
      socket.off('submission_started');
      socket.off('player_submitted');
      socket.off('round_started');
      socket.off('player_answered');
      socket.off('round_revealed');
      socket.off('game_over');
      socket.off('game_restarted');
      socket.off('kicked');
      socket.off('error');
    };
  }, []);

  // Theme toggler based on view
  useEffect(() => {
    if (view === 'home' || view === 'create_game' || view === 'join_game') {
      document.body.className = 'theme-dark';
    } else {
      document.body.className = 'theme-party';
    }
  }, [view]);

  const handleCreateRoom = () => {
    const count = Number(playerCount);
    if (count >= 2 && count <= 100) {
      if (hostIsPlaying && !playerName) {
        alert('Please enter your name if you want to play.');
        return;
      }
      socket.emit('create_room', { playerCount: count, hostIsPlaying, playerName });
    } else {
      alert('Please enter a valid number between 2 and 100.');
    }
  };

  const handleJoinRoom = () => {
    if (!roomCode || !playerName) {
      alert('Please enter a room code and your name');
      return;
    }
    socket.emit('join_room', { code: roomCode.toUpperCase(), name: playerName });
  };

  const handleStartSubmission = () => {
    socket.emit('start_submission', { code: roomCode });
  };

  const handleSubmitStatements = () => {
    if (!truth1 || !truth2 || !lie) return;
    socket.emit('submit_statements', { code: roomCode, truth1, truth2, lie });
    setSubmissionStep('done');
  };

  const handleStartGameRounds = () => {
    socket.emit('start_game_rounds', { code: roomCode });
  };

  const handleStartRound = () => {
    socket.emit('start_round', { code: roomCode });
  };

  const handleStatementClick = (statement: Statement) => {
    if (selectedStatementId || gameStatus !== 'playing') return;
    if (roundInfo?.subjectId === socket.id) return; // Cannot guess on your own turn
    
    setSelectedStatementId(statement.id);
    socket.emit('submit_answer', { code: roomCode, statementId: statement.id });
  };

  const handleReveal = () => {
    socket.emit('reveal_answers', { code: roomCode });
  };

  const handlePlayAgain = () => {
    socket.emit('play_again', { code: roomCode });
  };

  const leaveGame = () => {
    setView('home');
    setRoomCode('');
    setPlayers([]);
    setIsHost(false);
    setGameStatus('lobby');
  };

  const getCardClassName = (statement: Statement) => {
    let className = 'game-card';
    if (gameStatus === 'revealed') {
      if (statement.isLie) {
        className += ' correct';
      } else if (answers[socket.id] === statement.id) {
        className += ' incorrect';
      } else {
        className += ' revealed-lie'; 
      }
    }
    if (selectedStatementId === statement.id && gameStatus === 'playing') {
      className += ' selected';
    }
    return className;
  };

  if (view === 'home') {
    return (
      <div className="app-container" style={{ minHeight: '90vh', justifyContent: 'space-between', flexDirection: 'column', padding: '2rem 0' }}>
        <div style={{ width: '100%', textAlign: 'center', color: '#94a3b8', fontSize: '1rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
          Created by <span style={{ color: '#a855f7', fontWeight: '800' }}>Prime</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="header" style={{ textAlign: 'center' }}>
            <h1 className="title">2 Truths 1 Lie</h1>
            <p className="subtitle">Play with friends or test yourself!</p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem', width: '100%', maxWidth: '300px' }}>
            <button className="action-button" style={{ marginTop: 0 }} onClick={() => setView('create_game')}>
              Create Game
            </button>
            <button className="action-button" style={{ marginTop: 0, background: 'linear-gradient(135deg, #475569 0%, #334155 100%)', boxShadow: '0 4px 15px rgba(71, 85, 105, 0.4)' }} onClick={() => setView('join_game')}>
              Join Game
            </button>
          </div>
        </div>

        <div style={{ width: '100%', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
          <span style={{ color: '#3b82f6', fontWeight: '600' }}>Among Us Pakistan</span> Discord Server
        </div>
      </div>
    );
  }

  if (view === 'create_game') {
    return (
      <div className="app-container" style={{ minHeight: '90vh', justifyContent: 'center', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ width: '100%', textAlign: 'center', color: '#94a3b8', fontSize: '1.2rem', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 'bold' }}>
          Game Setup
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)', borderRadius: '1rem', padding: '3rem 2rem', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)', width: '100%', maxWidth: '400px' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Host a Game</h2>
          <p style={{ color: '#94a3b8', marginBottom: '2.5rem', textAlign: 'center', fontSize: '1.1rem' }}>How many people are playing?</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', marginBottom: '1.5rem' }}>
            <label style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Number of Players (2 - 100)</label>
            <input 
              type="number" 
              min="2" 
              max="100" 
              value={playerCount}
              onChange={(e) => setPlayerCount(e.target.value)}
              style={{
                width: '100%', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #475569', background: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc', fontSize: '1.1rem', outline: 'none', transition: 'border-color 0.3s', boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#6366f1'}
              onBlur={(e) => e.target.style.borderColor = '#475569'}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', marginBottom: '1rem' }}>
            <label style={{ color: '#f8fafc', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={hostIsPlaying} 
                onChange={(e) => setHostIsPlaying(e.target.checked)} 
                style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#a855f7' }}
              />
              I also want to play
            </label>
          </div>

          {hostIsPlaying && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', marginBottom: '2.5rem' }}>
              <label style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your Nickname</label>
              <input 
                type="text" 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                style={{
                  width: '100%', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #475569', background: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc', fontSize: '1.1rem', outline: 'none', transition: 'border-color 0.3s', boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                onBlur={(e) => e.target.style.borderColor = '#475569'}
              />
            </div>
          )}
          {!hostIsPlaying && <div style={{ marginBottom: '2.5rem' }} />}
          
          <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
             <button className="action-button" style={{ marginTop: 0, flex: 1, padding: '1rem 1.5rem', background: 'linear-gradient(135deg, #475569 0%, #334155 100%)', boxShadow: '0 4px 15px rgba(71, 85, 105, 0.4)' }} onClick={() => setView('home')}>
                Back
             </button>
             <button className="action-button" style={{ marginTop: 0, flex: 1, padding: '1rem 1.5rem' }} onClick={handleCreateRoom}>
                Create Lobby
             </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'join_game') {
    return (
      <div className="app-container" style={{ minHeight: '90vh', justifyContent: 'center', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ width: '100%', textAlign: 'center', color: '#94a3b8', fontSize: '1.2rem', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 'bold' }}>
          Join Room
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)', borderRadius: '1rem', padding: '3rem 2rem', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)', width: '100%', maxWidth: '400px' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Join Game</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', marginBottom: '2.5rem', marginTop: '1.5rem' }}>
            <div>
              <label style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>Room Code</label>
              <input 
                type="text" 
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #475569', background: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc', fontSize: '1.1rem', outline: 'none', marginTop: '0.5rem', boxSizing: 'border-box', textTransform: 'uppercase' }}
              />
            </div>
            <div>
              <label style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>Your Nickname</label>
              <input 
                type="text" 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #475569', background: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc', fontSize: '1.1rem', outline: 'none', marginTop: '0.5rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
             <button className="action-button" style={{ marginTop: 0, flex: 1, padding: '1rem 1.5rem', background: 'linear-gradient(135deg, #475569 0%, #334155 100%)' }} onClick={() => setView('home')}>
                Back
             </button>
             <button className="action-button" style={{ marginTop: 0, flex: 1, padding: '1rem 1.5rem' }} onClick={handleJoinRoom}>
                Join Room
             </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'lobby') {
    return (
      <div className="app-container" style={{ maxWidth: '1200px' }}>
        <BackgroundAnimals />
        <div className="header" style={{ marginBottom: '1.5rem' }}>
          <h1 className="title" style={{ fontSize: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem', textTransform: 'capitalize' }}>
            Two Truths & A Lie 👁️
          </h1>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', width: '100%', justifyContent: 'center' }}>
          {/* Left Panel: Join Info */}
          <div style={{ flex: '1 1 350px', maxWidth: '450px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)', borderRadius: '1.5rem', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)' }}>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', color: '#f8fafc', fontWeight: 800 }}>Join by Pin</h2>
            <p style={{ color: '#cbd5e1', fontSize: '1rem', marginBottom: '1rem' }}>Go to <strong>Two Truth 1 Lie</strong></p>
            <div style={{ fontSize: '4rem', fontWeight: 900, letterSpacing: '4px', color: '#fff', textShadow: '0 4px 10px rgba(0,0,0,0.2)', marginBottom: '0.5rem' }}>
              {roomCode}
            </div>
            <button className="action-button" style={{ marginTop: '0.5rem', padding: '0.6rem 1.5rem', fontSize: '1rem', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', boxShadow: '0 4px 15px rgba(249, 115, 22, 0.4)' }} onClick={() => { navigator.clipboard.writeText(roomCode); alert('Room code copied!'); }}>
              Copy Code
            </button>
          </div>

          {/* Right Panel: Players */}
          <div style={{ flex: '1 1 350px', maxWidth: '450px', minHeight: '250px', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)', borderRadius: '1.5rem', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)' }}>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '1.5rem', color: '#f8fafc', fontWeight: 700 }}>{players.length} Players Joined</h2>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'center', width: '100%', overflowY: 'auto', maxHeight: '200px' }}>
              {players.length === 0 && <p style={{ color: '#64748b', fontStyle: 'italic', fontSize: '1.1rem' }}>Waiting for players...</p>}
              {players.map(p => (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
                  {isHost && p.id !== socket.id && (
                    <button 
                      onClick={() => socket.emit('kick_player', { code: roomCode, targetId: p.id })}
                      style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.5)', zIndex: 10 }}
                      title={`Kick ${p.name}`}
                    >
                      ×
                    </button>
                  )}
                  <div style={{ width: '55px', height: '55px', borderRadius: '50%', background: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                    🧑‍🦱
                  </div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#fff' }}>{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isHost ? (
          <button 
            className="action-button" 
            onClick={handleStartSubmission} 
            disabled={players.length < 2} 
            style={{ marginTop: '2rem', fontSize: '1.3rem', padding: '0.8rem 4rem', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', border: '4px solid rgba(255,255,255,0.2)', boxShadow: '0 10px 25px rgba(249, 115, 22, 0.4)', opacity: players.length < 2 ? 0.5 : 1 }}
          >
            {players.length < 2 ? "Need 2+ Players to Start" : "Start"}
          </button>
        ) : (
          <div className="status-message neutral" style={{ marginTop: '2rem', fontSize: '1.3rem' }}>
            Waiting for host to start...
          </div>
        )}
      </div>
    );
  }

  if (view === 'submission') {
    if (!isPlayer) {
      return (
        <div className="app-container">
          <div className="header" style={{ textAlign: 'center' }}>
            <h1 className="title">Writing Phase</h1>
            <p className="subtitle">Players are writing their truths and lies...</p>
          </div>
          <div className="score-board">
            <span style={{ fontSize: '1.2rem' }}>Submitted: {submittedCount} / {players.length}</span>
          </div>
          {isHost && submittedCount === players.length && (
            <button className="action-button" onClick={handleStartGameRounds}>
              Begin Game
            </button>
          )}
        </div>
      );
    }

    if (submissionStep === 'done') {
      return (
        <div className="app-container">
          <div className="header" style={{ textAlign: 'center' }}>
            <h1 className="title">Great Job!</h1>
            <p className="subtitle">Waiting for others to finish writing...</p>
          </div>
          <div className="score-board">
            <span style={{ fontSize: '1.2rem' }}>Submitted: {submittedCount} / {players.length}</span>
          </div>
          {isHost && submittedCount === players.length && (
            <button className="action-button" onClick={handleStartGameRounds}>
              Begin Game
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="app-container" style={{ minHeight: '90vh', justifyContent: 'center', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)', borderRadius: '1rem', padding: '3rem 2rem', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)', width: '100%', maxWidth: '500px' }}>
          
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '2rem' }}>
            <div style={{ width: '30%', height: '5px', background: submissionStep >= 1 ? '#a855f7' : '#334155', borderRadius: '5px' }}></div>
            <div style={{ width: '30%', height: '5px', background: submissionStep >= 2 ? '#a855f7' : '#334155', borderRadius: '5px' }}></div>
            <div style={{ width: '30%', height: '5px', background: submissionStep >= 3 ? '#a855f7' : '#334155', borderRadius: '5px' }}></div>
          </div>

          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', fontWeight: 800, color: '#f8fafc' }}>
            {submissionStep === 1 && "Enter 1st Truth"}
            {submissionStep === 2 && "Enter 2nd Truth"}
            {submissionStep === 3 && "Enter a Lie"}
          </h2>
          
          <p style={{ color: '#94a3b8', marginBottom: '2rem', textAlign: 'center', fontSize: '1rem' }}>
            {submissionStep === 1 && "Write something true about yourself."}
            {submissionStep === 2 && "Write another true fact."}
            {submissionStep === 3 && "Now, make up something believable!"}
          </p>

          <input 
            type="text" 
            placeholder="Type your statement here..."
            value={submissionStep === 1 ? truth1 : submissionStep === 2 ? truth2 : lie}
            onChange={(e) => {
              if (submissionStep === 1) setTruth1(e.target.value);
              if (submissionStep === 2) setTruth2(e.target.value);
              if (submissionStep === 3) setLie(e.target.value);
            }}
            style={{ width: '100%', padding: '1.25rem', borderRadius: '0.75rem', border: '2px solid #6366f1', background: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc', fontSize: '1.2rem', outline: 'none', marginBottom: '2rem', boxSizing: 'border-box' }}
          />

          <button 
            className="action-button" 
            style={{ marginTop: 0, width: '100%', padding: '1rem' }} 
            onClick={() => {
              if (submissionStep === 1) {
                if (!truth1) { alert("Please write a truth."); return; }
                setSubmissionStep(2);
              } else if (submissionStep === 2) {
                if (!truth2) { alert("Please write a truth."); return; }
                setSubmissionStep(3);
              } else if (submissionStep === 3) {
                if (!lie) { alert("Please write a lie."); return; }
                handleSubmitStatements();
              }
            }}
          >
            {submissionStep === 3 ? "Submit" : "Next"}
          </button>
        </div>
      </div>
    );
  }

  if (gameStatus === 'finished') {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    return (
      <div className="app-container">
        <div className="header">
          <h1 className="title">Game Over!</h1>
          <p className="subtitle">Final Standings</p>
        </div>
        
        <div className="score-board" style={{ margin: '2rem 0', flexDirection: 'column', gap: '1rem', width: '100%' }}>
          {sortedPlayers.map((p, index) => (
             <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '1.2rem', color: index === 0 ? '#fbbf24' : '#f8fafc', padding: '0.5rem 0', borderBottom: index < sortedPlayers.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
               <span>{index + 1}. {p.name} {index === 0 && '👑'}</span>
               <strong>{p.score}</strong>
             </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '400px', margin: '0 auto' }}>
          <button className="action-button" style={{ marginTop: '1rem', flex: 1, background: 'linear-gradient(135deg, #475569 0%, #334155 100%)' }} onClick={leaveGame}>
            Leave Room
          </button>
          {isHost && (
            <button className="action-button" style={{ marginTop: '1rem', flex: 1 }} onClick={handlePlayAgain}>
              Play Again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (view === 'game') {
    const myPlayer = players.find(p => p.id === socket.id);
    const score = myPlayer ? myPlayer.score : 0;
    const isMyTurn = roundInfo?.subjectId === socket.id;

    return (
      <div className="app-container" style={{ minHeight: '85vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 0, position: 'relative' }}>
        <BackgroundAnimals />

        {/* TOP ROW */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '1.5rem', boxSizing: 'border-box' }}>
          {/* Top Left Info */}
          <div style={{ textAlign: 'left', zIndex: 10 }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.2rem', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
              Two Truth 1 Lie 👉 {roomCode}
            </div>
            <div style={{ fontSize: '1.1rem', color: '#fff', fontWeight: '600', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
              Round {roundInfo ? roundInfo.roundIndex + 1 : 0} of {roundInfo?.totalRounds}
              {isPlayer && <span style={{ marginLeft: '1rem', color: '#fff', fontWeight: 'bold' }}>Score: {score}</span>}
            </div>
          </div>
        </div>

        {/* MIDDLE ROW (Banner + Cards) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, zIndex: 5, padding: '1rem 0' }}>
          
          {/* Top Center Banner */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '3rem', marginTop: '-5vh' }}>
            <div style={{ fontSize: '2.5rem', background: '#e11d48', borderRadius: '50%', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
              🧑‍🦱
            </div>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fff', textShadow: '0 2px 10px rgba(0,0,0,0.3)', margin: 0, textAlign: 'center' }}>
              {isMyTurn ? "Everyone's guessing your lie!" : `Guess ${roundInfo?.subjectName}'s lie!`}
            </h2>
          </div>

          <div className="cards-container">
            {statements.map((statement) => {
              return (
                <button 
                  key={statement.id}
                  className={getCardClassName(statement)}
                  onClick={() => handleStatementClick(statement)}
                  disabled={gameStatus !== 'playing' || isMyTurn || !isPlayer}
                >
                  {statement.text}

                  {gameStatus === 'revealed' && (
                    <div 
                      className={`stamp ${statement.isLie ? 'lie' : 'truth'}`} 
                      style={{ '--end-rot': statement.isLie ? '8deg' : '-8deg' } as React.CSSProperties}
                    >
                      {statement.isLie ? 'LIE' : 'TRUTH'}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* BOTTOM ROW */}
        <div style={{ width: '100%', padding: '1rem', boxSizing: 'border-box', minHeight: '80px', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', justifyContent: 'flex-end', zIndex: 10 }}>
          
          {/* Status Message for players */}
          {gameStatus === 'playing' && isPlayer && (
             <div className="status-message neutral" style={{ margin: 0, background: 'rgba(0,0,0,0.5)', padding: '0.6rem 2rem', borderRadius: '2rem', color: '#fff', fontSize: '1.1rem' }}>
                {isMyTurn ? "Sit tight! Everyone is trying to guess your lie." : (selectedStatementId ? "Waiting for others to guess..." : "")}
             </div>
          )}

          {gameStatus === 'revealed' && !isHost && (
             <div className="status-message neutral" style={{ margin: 0, background: 'rgba(0,0,0,0.5)', padding: '0.6rem 2rem', borderRadius: '2rem', color: '#fff', fontSize: '1.1rem' }}>
                Waiting for host to start next round...
             </div>
          )}

          {/* Host Controls */}
          {gameStatus === 'playing' && isHost && (
            <div style={{ position: 'fixed', bottom: '2rem', left: '2rem', background: 'rgba(25, 27, 42, 0.85)', padding: '0.8rem 1.5rem', borderRadius: '1.5rem', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 100 }}>
              <span style={{ color: '#cbd5e1', fontWeight: 'bold', fontSize: '1.1rem' }}>Answers: <span style={{ color: '#fff' }}>{answeredCount}/{eligiblePlayersCount}</span></span>
              <button className="action-button" style={{ margin: 0, padding: '0.8rem 2rem', fontSize: '1.1rem', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', boxShadow: '0 4px 15px rgba(249, 115, 22, 0.4)' }} onClick={handleReveal}>
                Reveal Answer
              </button>
            </div>
          )}

          {gameStatus === 'revealed' && isHost && (
            <div style={{ position: 'fixed', bottom: '2rem', left: '2rem', background: 'rgba(25, 27, 42, 0.85)', padding: '0.8rem 1.5rem', borderRadius: '1.5rem', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 100 }}>
              <button className="action-button" style={{ margin: 0, padding: '0.8rem 2rem', fontSize: '1.1rem', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', boxShadow: '0 4px 15px rgba(249, 115, 22, 0.4)' }} onClick={handleStartRound}>
                Next Round
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default App;
