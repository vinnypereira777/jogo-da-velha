const socket = new WebSocket('wss://jogo-da-velha-2-ccpu.onrender.com');

const boardElement = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const statusElement = document.getElementById('status');
const scoreXElement = document.getElementById('score-X');
const scoreOElement = document.getElementById('score-O');
const resetBtn = document.getElementById('reset-btn');

let mySymbol = null;
let currentTurn = null;
let gameActive = false;

socket.onopen = () => {
    console.log('Conectado ao servidor.');
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
        case 'init':
            mySymbol = data.symbol;
            statusElement.textContent = `Você é o jogador ${mySymbol}. Aguardando oponente...`;
            break;

        case 'waiting':
            statusElement.textContent = data.message;
            break;

        case 'score_update':
            updateScoresUI(data.scores);
            break;

        case 'start':
            currentTurn = data.turn;
            gameActive = true;
            if (data.scores) updateScoresUI(data.scores);
            resetBoardUI();
            updateStatusText();
            break;

        case 'update':
            updateBoard(data.board);
            currentTurn = data.turn;
            updateStatusText();
            break;

        case 'gameover':
            updateBoard(data.board);
            gameActive = false;
            if (data.scores) updateScoresUI(data.scores);
            
            if (data.result === 'winner') {
                statusElement.textContent = data.winner === mySymbol ? '🎉 Você venceu!' : '😢 Você perdeu.';
            } else {
                statusElement.textContent = '🤝 Empate!';
            }
            break;

        case 'opponent_disconnected':
            statusElement.textContent = data.message;
            gameActive = false;
            if (data.scores) updateScoresUI(data.scores);
            resetBoardUI();
            break;

        case 'error':
            statusElement.textContent = data.message;
            break;
    }
};

cells.forEach(cell => {
    cell.addEventListener('click', () => {
        const index = cell.getAttribute('data-index');
        if (gameActive && currentTurn === mySymbol && !cell.textContent) {
            socket.send(JSON.stringify({
                type: 'move',
                index: parseInt(index),
                playerSymbol: mySymbol
            }));
        }
    });
});

// Envia sinal ao servidor para reiniciar o jogo ao clicar no botão
resetBtn.addEventListener('click', () => {
    if (gameActive || statusElement.textContent.includes('venceu') || statusElement.textContent.includes('Empate') || statusElement.textContent.includes('perdeu')) {
        socket.send(JSON.stringify({ type: 'request_reset' }));
    }
});

function updateBoard(boardState) {
    cells.forEach((cell, index) => {
        cell.textContent = boardState[index];
        cell.className = 'cell';
        if (boardState[index]) {
            cell.classList.add(boardState[index]);
        }
    });
}

function updateStatusText() {
    if (!gameActive) return;
    if (currentTurn === mySymbol) {
        statusElement.textContent = `Sua vez (${mySymbol})!`;
    } else {
        statusElement.textContent = `Vez do oponente (${currentTurn})...`;
    }
}

function updateScoresUI(scores) {
    if (scores) {
        scoreXElement.textContent = scores.X;
        scoreOElement.textContent = scores.O;
    }
}

function resetBoardUI() {
    cells.forEach(cell => {
        cell.textContent = '';
        cell.className = 'cell';
    });
}