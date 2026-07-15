const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

// 1. Criar o Servidor HTTP para servir os arquivos HTML, CSS e JS
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

// 2. Configurar o WebSocket Server
const wss = new WebSocketServer({ server });

let players = []; // Guarda as conexões ativas
let gameState = Array(9).fill(null); // Tabuleiro [0-8]
let turn = 'X'; // Começa com o jogador X

wss.on('connection', (ws) => {
    if (players.length >= 2) {
        ws.send(JSON.stringify({ type: 'error', message: 'Sala cheia! Tente novamente mais tarde.' }));
        ws.close();
        return;
    }

    // O primeiro a se conectar é X, o segundo é O
    const symbol = players.length === 0 ? 'X' : 'O';
    players.push({ ws, symbol });

    // Informa ao jogador o seu símbolo
    ws.send(JSON.stringify({ type: 'init', symbol }));

    if (players.length === 2) {
        broadcast({ type: 'start', turn });
    } else {
        ws.send(JSON.stringify({ type: 'waiting', message: 'Aguardando o segundo jogador...' }));
    }

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'move') {
                const { index, playerSymbol } = data;

                // Valida se a jogada é de quem tem o turno e se a casa está vazia
                if (turn === playerSymbol && gameState[index] === null) {
                    gameState[index] = playerSymbol;
                    
                    const winner = checkWinner();
                    if (winner) {
                        broadcast({ type: 'gameover', result: 'winner', winner, board: gameState });
                        resetGame();
                    } else if (gameState.every(cell => cell !== null)) {
                        broadcast({ type: 'gameover', result: 'draw', board: gameState });
                        resetGame();
                    } else {
                        // Alterna a vez de jogar
                        turn = turn === 'X' ? 'O' : 'X';
                        broadcast({ type: 'update', board: gameState, turn });
                    }
                }
            }
        } catch (error) {
            console.error("Erro ao processar mensagem do cliente:", error);
        }
    });

    ws.on('close', () => {
        // Remove jogador que se desconectou e avisa o outro
        players = players.filter(player => player.ws !== ws);
        resetGame();
        broadcast({ type: 'opponent_disconnected', message: 'O oponente saiu. Jogo reiniciado.' });
    });
});

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
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Linhas
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Colunas
        [0, 4, 8], [2, 4, 6]             // Diagonais
    ];

    for (let pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (gameState[a] && gameState[a] === gameState[b] && gameState[a] === gameState[c]) {
            return gameState[a];
        }
    }
    return null;
}

// 3. Inicializar o servidor na porta certa para o Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});