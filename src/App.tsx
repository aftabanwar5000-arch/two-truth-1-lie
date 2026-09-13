import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';

const BackgroundAnimals = () => {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', overflow: 'hidden', pointerEvents: 'none', opacity: 0.15, zIndex: 0 }}>
      <div style={{ position: 'absolute', top: '15%', left: '15%', fontSize: '8rem', animation: 'float-animal 80s infinite alternate' }}>🐼</div>
      <div style={{ position: 'absolute', top: '75%', left: '75%', fontSize: '9rem', animation: 'float-animal 95s infinite alternate-reverse' }}>🐵</div>
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
    document.body.className = 'theme-dark';
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
      } else if (socket.id && answers[socket.id] === statement.id) {
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
      <div className="view-container">
        <BackgroundAnimals />
        <div style={{ position: 'absolute', top: '2rem', color: '#94a3b8', fontSize: '1rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
          Created by <span style={{ color: '#a855f7', fontWeight: '800' }}>Prime</span>
        </div>

        <div className="glass-panel" style={{ background: 'transparent', boxShadow: 'none', border: 'none' }}>
          <div className="header">
            <h1 className="title">2 Truths 1 Lie</h1>
            <p className="subtitle">Play with friends or test yourself!</p>
          </div>
          
          <div className="btn-group vertical" style={{ marginTop: '2rem', maxWidth: '300px', margin: '0 auto' }}>
            <button className="action-button btn-primary" onClick={() => setView('create_game')}>
              Create Game
            </button>
            <button className="action-button btn-secondary" onClick={() => setView('join_game')}>
              Join Game
            </button>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: '2rem', color: '#64748b', fontSize: '0.9rem' }}>
          <span style={{ color: '#3b82f6', fontWeight: '600' }}>Among Us Pakistan</span> Discord Server
        </div>
      </div>
    );
  }

  if (view === 'create_game') {
    return (
      <div className="view-container">
        <BackgroundAnimals />
        <div style={{ position: 'absolute', top: '2rem', color: '#94a3b8', fontSize: '1.2rem', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 'bold' }}>
          Game Setup
        </div>
        
        <div className="glass-panel">
          <h2 className="panel-title">Host a Game</h2>
          <p style={{ color: '#94a3b8', marginBottom: '2.5rem', textAlign: 'center', fontSize: '1.1rem' }}>How many people are playing?</p>
          
          <div className="form-group">
            <label className="input-label">Number of Players (2 - 100)</label>
            <input 
              type="number" 
              min="2" 
              max="100" 
              value={playerCount}
              onChange={(e) => setPlayerCount(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={hostIsPlaying} 
                onChange={(e) => setHostIsPlaying(e.target.checked)} 
                className="checkbox-input"
              />
              I also want to play
            </label>
          </div>

          {hostIsPlaying && (
            <div className="form-group">
              <label className="input-label">Your Nickname</label>
              <input 
                type="text" 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="input-field"
                placeholder="Enter nickname"
              />
            </div>
          )}
          {!hostIsPlaying && <div style={{ marginBottom: '2.5rem' }} />}
          
          <div className="btn-group">
             <button className="action-button btn-secondary" onClick={() => setView('home')}>
                Back
             </button>
             <button className="action-button btn-primary" onClick={handleCreateRoom}>
                Create Lobby
             </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'join_game') {
    return (
      <div className="view-container">
        <BackgroundAnimals />
        <div style={{ position: 'absolute', top: '2rem', color: '#94a3b8', fontSize: '1.2rem', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 'bold' }}>
          Join Room
        </div>

        <div className="glass-panel">
          <h2 className="panel-title">Join Game</h2>
          
          <div className="form-group" style={{ marginTop: '1.5rem', marginBottom: '2.5rem' }}>
            <div className="form-group">
              <label className="input-label">Room Code</label>
              <input 
                type="text" 
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="input-field"
                style={{ textTransform: 'uppercase' }}
                placeholder="Enter 5-letter code"
              />
            </div>
            <div className="form-group">
              <label className="input-label">Your Nickname</label>
              <input 
                type="text" 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="input-field"
                placeholder="Enter nickname"
              />
            </div>
          </div>
          
          <div className="btn-group">
             <button className="action-button btn-secondary" onClick={() => setView('home')}>
                Back
             </button>
             <button className="action-button btn-primary" onClick={handleJoinRoom}>
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
          <h1 className="title" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem', textTransform: 'capitalize' }}>
            Two Truths & A Lie 👁️
          </h1>
        </div>

        <div className="lobby-grid">
          {/* Left Panel: Join Info */}
          <div className="lobby-panel">
            <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', color: '#f8fafc', fontWeight: 800 }}>Join by Pin</h2>
            <p style={{ color: '#cbd5e1', fontSize: '1rem', marginBottom: '1rem' }}>Go to <strong>Two Truth 1 Lie</strong></p>
            <div style={{ fontSize: '4rem', fontWeight: 900, letterSpacing: '4px', color: '#fff', textShadow: '0 4px 10px rgba(0,0,0,0.2)', marginBottom: '0.5rem' }}>
              {roomCode}
            </div>
            <button className="action-button btn-accent" style={{ padding: '0.6rem 1.5rem', fontSize: '1rem', width: 'auto' }} onClick={() => { navigator.clipboard.writeText(roomCode); alert('Room code copied!'); }}>
              Copy Code
            </button>
          </div>

          {/* Right Panel: Players */}
          <div className="lobby-panel">
            <h2 style={{ fontSize: '1.4rem', marginBottom: '1.5rem', color: '#f8fafc', fontWeight: 700 }}>{players.length} Players Joined</h2>
            
            <div className="player-list">
              {players.length === 0 && <p style={{ color: '#64748b', fontStyle: 'italic', fontSize: '1.1rem' }}>Waiting for players...</p>}
              {players.map(p => (
                <div key={p.id} className="player-avatar-container">
                  {isHost && p.id !== socket.id && (
                    <button 
                      onClick={() => socket.emit('kick_player', { code: roomCode, targetId: p.id })}
                      className="kick-btn"
                      title={`Kick ${p.name}`}
                    >
                      ×
                    </button>
                  )}
                  <div className="player-avatar">
                    🧑‍🦱
                  </div>
                  <span className="player-name" title={p.name}>{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isHost ? (
          <button 
            className="action-button btn-accent" 
            onClick={handleStartSubmission} 
            disabled={players.length < 2} 
            style={{ marginTop: '2rem', fontSize: '1.3rem', padding: '1rem 4rem', width: 'auto', maxWidth: '300px' }}
          >
            {players.length < 2 ? "Need 2+ Players to Start" : "Start"}
          </button>
        ) : (
          <div className="status-message neutral">
            Waiting for host to start...
          </div>
        )}
      </div>
    );
  }

  if (view === 'submission') {
    if (!isPlayer) {
      return (
        <div className="view-container">
          <BackgroundAnimals />
          <div className="header">
            <h1 className="title">Writing Phase</h1>
            <p className="subtitle">Players are writing their truths and lies...</p>
          </div>
          <div className="score-board">
            <span style={{ fontSize: '1.2rem' }}>Submitted: {submittedCount} / {players.length}</span>
          </div>
          {isHost && submittedCount === players.length && (
            <button className="action-button btn-accent" style={{ marginTop: '2rem' }} onClick={handleStartGameRounds}>
              Begin Game
            </button>
          )}
        </div>
      );
    }

    if (submissionStep === 'done') {
      return (
        <div className="view-container">
          <BackgroundAnimals />
          <div className="header">
            <h1 className="title">Great Job!</h1>
            <p className="subtitle">Waiting for others to finish writing...</p>
          </div>
          <div className="score-board">
            <span style={{ fontSize: '1.2rem' }}>Submitted: {submittedCount} / {players.length}</span>
          </div>
          {isHost && submittedCount === players.length && (
            <button className="action-button btn-accent" style={{ marginTop: '2rem' }} onClick={handleStartGameRounds}>
              Begin Game
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="view-container">
        <BackgroundAnimals />
        <div className="glass-panel" style={{ maxWidth: '500px' }}>
          
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '2rem' }}>
            <div style={{ flex: 1, height: '6px', background: submissionStep >= 1 ? '#a855f7' : '#334155', borderRadius: '5px', transition: 'background 0.3s' }}></div>
            <div style={{ flex: 1, height: '6px', background: submissionStep >= 2 ? '#a855f7' : '#334155', borderRadius: '5px', transition: 'background 0.3s' }}></div>
            <div style={{ flex: 1, height: '6px', background: submissionStep >= 3 ? '#a855f7' : '#334155', borderRadius: '5px', transition: 'background 0.3s' }}></div>
          </div>

          <h2 className="panel-title">
            {submissionStep === 1 && "Enter 1st Truth"}
            {submissionStep === 2 && "Enter 2nd Truth"}
            {submissionStep === 3 && "Enter a Lie"}
          </h2>
          
          <p style={{ color: '#94a3b8', marginBottom: '2rem', textAlign: 'center', fontSize: '1.1rem' }}>
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
            className="input-field"
            style={{ marginBottom: '2rem' }}
          />

          <button 
            className="action-button btn-primary" 
            style={{ width: '100%' }} 
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
      <div className="view-container">
        <BackgroundAnimals />
        <div className="header">
          <h1 className="title">Game Over!</h1>
          <p className="subtitle">Final Standings</p>
        </div>
        
        <div className="score-board" style={{ flexDirection: 'column', gap: '1rem', width: '90%', maxWidth: '400px' }}>
          {sortedPlayers.map((p, index) => (
             <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '1.2rem', color: index === 0 ? '#fbbf24' : '#f8fafc', padding: '0.5rem 0', borderBottom: index < sortedPlayers.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
               <span>{index + 1}. {p.name} {index === 0 && '👑'}</span>
               <strong>{p.score}</strong>
             </div>
          ))}
        </div>

        <div className="btn-group" style={{ maxWidth: '400px', marginTop: '2rem' }}>
          <button className="action-button btn-secondary" onClick={leaveGame}>
            Leave Room
          </button>
          {isHost && (
            <button className="action-button btn-primary" onClick={handlePlayAgain}>
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
      <div className="app-container" style={{ minHeight: '85vh', justifyContent: 'space-between', padding: 0 }}>
        <BackgroundAnimals />

        {/* TOP ROW */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '1.5rem', boxSizing: 'border-box', zIndex: 10 }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 'clamp(1rem, 3vw, 1.2rem)', fontWeight: 'bold', color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
              Room: {roomCode}
            </div>
            <div style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)', color: '#cbd5e1', fontWeight: '600' }}>
              Round {roundInfo ? roundInfo.roundIndex + 1 : 0} of {roundInfo?.totalRounds}
              {isPlayer && <span style={{ marginLeft: '1rem', color: '#fbbf24' }}>Score: {score}</span>}
            </div>
          </div>
        </div>

        {/* MIDDLE ROW (Banner + Cards) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, zIndex: 5, width: '100%' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div className="player-avatar" style={{ width: '50px', height: '50px', fontSize: '1.5rem' }}>
              🧑‍🦱
            </div>
            <h2 style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', fontWeight: 800, color: '#fff', textShadow: '0 2px 10px rgba(0,0,0,0.3)', margin: 0, textAlign: 'center' }}>
              {isMyTurn ? "They are guessing your lie!" : `Guess ${roundInfo?.subjectName}'s lie!`}
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
          
          {gameStatus === 'playing' && isPlayer && (
             <div className="status-message neutral" style={{ background: 'rgba(0,0,0,0.5)', padding: '0.6rem 2rem', borderRadius: '2rem', color: '#fff', fontSize: '1.1rem' }}>
                {isMyTurn ? "Sit tight! Everyone is trying to guess your lie." : (selectedStatementId ? "Waiting for others to guess..." : "")}
             </div>
          )}

          {gameStatus === 'revealed' && !isHost && (
             <div className="status-message neutral" style={{ background: 'rgba(0,0,0,0.5)', padding: '0.6rem 2rem', borderRadius: '2rem', color: '#fff', fontSize: '1.1rem' }}>
                Waiting for host to start next round...
             </div>
          )}

          {/* Host Controls */}
          {gameStatus === 'playing' && isHost && (
            <div style={{ position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', background: 'rgba(25, 27, 42, 0.95)', padding: '1rem 1.5rem', borderRadius: '2rem', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.6)', zIndex: 100, width: '90%', maxWidth: '400px' }}>
              <span style={{ color: '#cbd5e1', fontWeight: 'bold', fontSize: '1.1rem' }}>Answers: <span style={{ color: '#fff' }}>{answeredCount}/{eligiblePlayersCount}</span></span>
              <button className="action-button btn-accent" style={{ padding: '0.8rem 2rem', width: '100%' }} onClick={handleReveal}>
                Reveal Answer
              </button>
            </div>
          )}

          {gameStatus === 'revealed' && isHost && (
            <div style={{ position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', background: 'rgba(25, 27, 42, 0.95)', padding: '1rem', borderRadius: '2rem', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.6)', zIndex: 100, width: '90%', maxWidth: '300px' }}>
              <button className="action-button btn-accent" style={{ padding: '0.8rem 2rem', width: '100%' }} onClick={handleStartRound}>
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
