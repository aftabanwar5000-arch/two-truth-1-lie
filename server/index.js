const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

const rooms = {};

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create_room', ({ playerCount, hostIsPlaying, playerName }) => {
    const code = generateCode();
    const initialPlayers = [];
    if (hostIsPlaying && playerName) {
      initialPlayers.push({ id: socket.id, name: playerName, score: 0 });
    }
    rooms[code] = {
      hostId: socket.id,
      players: initialPlayers,
      maxPlayers: playerCount,
      status: 'lobby', // lobby, submitting, playing, revealed, finished
      submissions: {}, // socketId -> array of { id, text, isLie }
      roundQueue: [], // array of socketIds who have submitted
      currentRoundIndex: 0,
      shuffledStatements: [],
      answers: {}, // socketId -> statementId
    };
    
    socket.join(code);
    socket.emit('room_created', { code });
    if (initialPlayers.length > 0) {
      io.to(code).emit('player_joined', { players: initialPlayers });
    }
    console.log(`Room created: ${code} by ${socket.id}`);
  });

  socket.on('join_room', ({ code, name }) => {
    const room = rooms[code];
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }
    if (room.status !== 'lobby') {
      socket.emit('error', 'Game has already started');
      return;
    }

    const player = { id: socket.id, name, score: 0 };
    room.players.push(player);
    socket.join(code);
    
    io.to(code).emit('player_joined', { players: room.players });
    socket.emit('joined_success', { code });
  });

  // Host starts the submission phase
  socket.on('start_submission', ({ code }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    
    if (room.players.length < 2) {
      socket.emit('error', 'Need at least 2 playing players to start.');
      return;
    }

    room.status = 'submitting';
    room.submissions = {};
    io.to(code).emit('submission_started');
  });

  // Player submits their truths and lies
  socket.on('submit_statements', ({ code, truth1, truth2, lie }) => {
    const room = rooms[code];
    if (!room || room.status !== 'submitting') return;

    room.submissions[socket.id] = [
      { id: generateId(), text: truth1, isLie: false },
      { id: generateId(), text: truth2, isLie: false },
      { id: generateId(), text: lie, isLie: true },
    ];

    io.to(room.hostId).emit('player_submitted', {
      playerId: socket.id,
      totalSubmitted: Object.keys(room.submissions).length,
      totalPlayers: room.players.length
    });
  });

  // Host starts the actual game (Phase 2)
  socket.on('start_game_rounds', ({ code }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;

    room.roundQueue = Object.keys(room.submissions);
    if (room.roundQueue.length === 0) {
      socket.emit('error', 'Nobody submitted statements!');
      return;
    }

    room.status = 'playing';
    room.currentRoundIndex = 0;
    
    startNextRound(room, code);
  });

  // Host moves to next round
  socket.on('start_round', ({ code }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    startNextRound(room, code);
  });

  function startNextRound(room, code) {
    if (room.currentRoundIndex >= room.roundQueue.length) {
      room.status = 'finished';
      io.to(code).emit('game_over', { players: room.players });
      return;
    }

    room.status = 'playing';
    room.answers = {};
    
    const subjectId = room.roundQueue[room.currentRoundIndex];
    const subjectPlayer = room.players.find(p => p.id === subjectId);
    const rawStatements = room.submissions[subjectId];
    
    const shuffled = shuffleArray(rawStatements);
    room.shuffledStatements = shuffled;

    const sanitizedStatements = shuffled.map(s => ({ id: s.id, text: s.text }));

    io.to(code).emit('round_started', {
      roundIndex: room.currentRoundIndex,
      subjectId: subjectId,
      subjectName: subjectPlayer ? subjectPlayer.name : 'Unknown',
      statements: sanitizedStatements,
      totalRounds: room.roundQueue.length
    });
  }

  socket.on('submit_answer', ({ code, statementId }) => {
    const room = rooms[code];
    if (!room || room.status !== 'playing') return;
    
    // The person whose turn it is cannot answer
    const subjectId = room.roundQueue[room.currentRoundIndex];
    if (socket.id === subjectId) return;

    room.answers[socket.id] = statementId;
    
    const eligiblePlayersCount = room.players.filter(p => p.id !== subjectId).length;

    io.to(room.hostId).emit('player_answered', { 
      playerId: socket.id, 
      totalAnswers: Object.keys(room.answers).length,
      eligiblePlayersCount: eligiblePlayersCount
    });
  });

  socket.on('reveal_answers', ({ code }) => {
    console.log(`[reveal_answers] called for room ${code} by ${socket.id}`);
    const room = rooms[code];
    if (!room) {
      console.log(`[reveal_answers] Room not found`);
      return;
    }
    if (room.hostId !== socket.id) {
      console.log(`[reveal_answers] Not host. Host is ${room.hostId}`);
      return;
    }

    room.status = 'revealed';
    
    const lieStatement = room.shuffledStatements.find(s => s.isLie);
    console.log(`[reveal_answers] lieStatement:`, lieStatement);

    if (!lieStatement) {
      console.log(`[reveal_answers] ERROR: no lie statement found!`);
    }

    // Calculate scores
    room.players.forEach(p => {
      const pAnswer = room.answers[p.id];
      if (pAnswer === lieStatement?.id) {
        p.score += 100;
      }
    });

    io.to(code).emit('round_revealed', {
      statements: room.shuffledStatements,
      answers: room.answers,
      players: room.players
    });

    console.log(`[reveal_answers] Emitted round_revealed`);
    room.currentRoundIndex++;
  });

  socket.on('play_again', ({ code }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;

    room.status = 'lobby';
    room.submissions = {};
    room.roundQueue = [];
    room.currentRoundIndex = 0;
    room.shuffledStatements = [];
    room.answers = {};
    
    // Reset scores for a fresh game
    room.players.forEach(p => p.score = 0);

    io.to(code).emit('game_restarted', { players: room.players });
  });

  socket.on('kick_player', ({ code, targetId }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    
    // Remove player
    room.players = room.players.filter(p => p.id !== targetId);
    
    // Notify the kicked player directly
    io.to(targetId).emit('kicked');
    
    // Notify everyone else that the player list changed
    io.to(code).emit('player_joined', { players: room.players });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO Server running on port ${PORT}`);
});
