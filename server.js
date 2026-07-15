const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

// 1. Servidor HTTP
const server = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    const fullPath = path.join(__dirname, 'public', filePath);
    const ext = path.extname(fullPath);
    
    const types = { 
        '.html': 'text/html', 
        '.css': 'text/css', 
        '.js': 'application/javascript',
        '.png': 'image/png',
        '.jpg': 'image/jpeg'
    };

    fs.readFile(fullPath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Arquivo não encontrado: ' + filePath);
            return;
        }
        res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
        res.end(content);
    });
});

// 2. WebSocket Server
const wss = new WebSocketServer({ server });

let players = []; 
let gameState = Array(9).fill(null); 
let turn = 'X'; 
let scores = { X: 0, O: 0 }; // Armazena a pontuação

function broadcast(data) {
    players.forEach(player => {
        if (player.ws.readyState === 1) { // 1 = OPEN
            player.ws.send(JSON.stringify(data));
        }
    });
}

function resetGame() {
    gameState = Array(9).fill(null);
    turn = 'X';
}

function checkWinner() {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (let pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (gameState[a] && gameState[a] === gameState[b] && gameState[a] === gameState[c]) {
            return gameState[a];
        }
    }
    return null;
}

wss.on('connection', (ws) => {
    if (players.length >= 2) {
        ws.send(JSON.stringify({ type: 'error', message: 'Sala cheia! Tente novamente mais tarde.' }));
        ws.close();
        return;
    }

    const symbol = players.length === 0 ? 'X' : 'O';
    players.push({ ws, symbol });

    ws.send(JSON.stringify({ type: 'init', symbol }));

    // Envia o placar atual assim que o jogador conecta
    ws.send(JSON.stringify({ type: 'score_update', scores }));

    if (players.length === 2) {
        resetGame();
        broadcast({ type: 'start', turn: 'X', scores });
    } else {
        ws.send(JSON.stringify({ type: 'waiting', message: 'Aguardando o segundo jogador...' }));
    }

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // Tratamento da jogada
            if (data.type === 'move') {
                const { index, playerSymbol } = data;
                if (turn === playerSymbol && gameState[index] === null) {
                    gameState[index] = playerSymbol;
                    const winner = checkWinner();
                    if (winner) {
                        scores[winner]++; // Incrementa pontuação do vencedor
                        broadcast({ type: 'gameover', result: 'winner', winner, board: gameState, scores });
                        resetGame();
                    } else if (gameState.every(cell => cell !== null)) {
                        broadcast({ type: 'gameover', result: 'draw', board: gameState, scores });
                        resetGame();
                    } else {
                        turn = turn === 'X' ? 'O' : 'X';
                        broadcast({ type: 'update', board: gameState, turn });
                    }
                }
            }

            // Novo: Tratamento para reiniciar o jogo
            if (data.type === 'request_reset') {
                resetGame();
                broadcast({ type: 'start', turn: 'X', scores });
            }
        } catch (error) {
            console.error("Erro no processamento:", error);
        }
    });

    ws.on('close', () => {
        players = players.filter(player => player.ws !== ws);
        resetGame();
        scores = { X: 0, O: 0 }; // Reseta placar se alguém desconectar
        broadcast({ type: 'opponent_disconnected', message: 'O oponente saiu. Aguardando novo jogador...', scores });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});