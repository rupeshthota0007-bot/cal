// --- CALCULATOR LOGIC & SECRET CODE ---
const display = document.getElementById('calc-display');
const calcKeys = document.querySelector('.calc-keys');

let currentInput = '0';
let previousInput = '';
let operator = null;
let awaitingNextValue = false;
let inputSequence = ''; // Tracks keys to match the secret code
const SECRET_CODE = '1234='; // The unlock code

function updateDisplay() {
    display.textContent = currentInput;
}

function handleNumber(num) {
    if (awaitingNextValue) {
        currentInput = num;
        awaitingNextValue = false;
    } else {
        // Prevent multiple leading zeros, limit length
        if (currentInput.length < 15) {
            currentInput = currentInput === '0' ? num : currentInput + num;
        }
    }
}

function handleOperator(op) {
    const inputValue = parseFloat(currentInput);
    if (operator && awaitingNextValue) {
        operator = op;
        return;
    }
    if (previousInput == null || previousInput === '') {
        previousInput = currentInput;
    } else if (operator) {
        const result = calculate(parseFloat(previousInput), inputValue, operator);
        currentInput = String(result);
        if(currentInput.length > 15) currentInput = currentInput.substring(0, 15);
        previousInput = currentInput;
    }
    awaitingNextValue = true;
    operator = op;
}

function calculate(first, second, op) {
    if (op === '+') return first + second;
    if (op === '-') return first - second;
    if (op === '*') return first * second;
    if (op === '/') return first / second;
    if (op === '%') return (first / 100) * second;
    return second;
}

calcKeys.addEventListener('click', (e) => {
    if (!e.target.matches('button')) return;
    
    const key = e.target;
    const action = key.dataset.action;
    const value = key.value;

    // Track sequence for the custom secret code
    if (action === 'calculate') {
        inputSequence += '=';
    } else if (value) {
        inputSequence += value;
    }

    // Check code match
    if (inputSequence.endsWith(SECRET_CODE)) {
        inputSequence = ''; // reset sequence
        unlockChat();
        // Reset calc
        currentInput = '0';
        previousInput = '';
        operator = null;
        updateDisplay();
        return; 
    }
    // Keep sequence reasonably small
    if (inputSequence.length > 20) {
        inputSequence = inputSequence.slice(-10);
    }

    // Execute standard calculator functions
    if (!action && value !== '.') {
        handleNumber(value);
    } else if (value === '.') {
        if (!currentInput.includes('.')) {
            currentInput += '.';
        }
    } else if (action === 'operator') {
        handleOperator(value);
    } else if (action === 'calculate') {
        if (operator) {
            currentInput = String(calculate(parseFloat(previousInput), parseFloat(currentInput), operator));
            if(currentInput.length > 15) currentInput = currentInput.substring(0, 15);
            operator = null;
            previousInput = '';
            awaitingNextValue = true;
        }
    } else if (action === 'clear') {
        currentInput = '0';
        previousInput = '';
        operator = null;
        awaitingNextValue = false;
        inputSequence = '';
    } else if (action === 'delete') {
        if(!awaitingNextValue) {
            currentInput = currentInput.slice(0, -1) || '0';
        }
    }

    updateDisplay();
});

// --- CHAT LOGIC ---
const calcView = document.getElementById('calculator-view');
const chatView = document.getElementById('chat-view');

function unlockChat() {
    calcView.classList.remove('active');
    calcView.classList.add('hidden');
    
    chatView.classList.remove('hidden');
    // slight delay for smooth transition
    setTimeout(() => {
        chatView.classList.add('active');
        initializePeer();
    }, 50);
}

// Interacting with the chat
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');
const connectionStatus = document.getElementById('connection-status');

let peer = null;
let currentConn = null;
let myPeerId = null;

function initializePeer() {
    if (peer) return; // already initialized
    peer = new Peer();
    
    peer.on('open', (id) => {
        myPeerId = id;
        connectionStatus.textContent = `ID: ${id}`;
    });

    peer.on('connection', (conn) => {
        // Someone connected to us
        currentConn = conn;
        setupConnection(conn);
        alert('A peer connected to you securely!');
    });
}

function setupConnection(conn) {
    conn.on('open', () => {
        connectionStatus.textContent = `Connected to: ${conn.peer}`;
        connectionStatus.style.color = 'var(--accent)';
    });
    
    conn.on('data', (data) => {
        receiveMessage(data);
    });
    
    conn.on('close', () => {
        connectionStatus.textContent = `ID: ${myPeerId}`;
        connectionStatus.style.color = '';
        currentConn = null;
        alert('Peer disconnected.');
    });
}

function receiveMessage(text) {
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const replyDiv = document.createElement('div');
    replyDiv.className = 'message received';
    replyDiv.innerHTML = `
        <p>${escapeHTML(text)}</p>
        <span class="time">${timeString}</span>
    `;
    chatMessages.appendChild(replyDiv);
    scrollToBottom();
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Build Sent Message
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message sent';
    msgDiv.innerHTML = `
        <p>${escapeHTML(text)}</p>
        <span class="time">${timeString}</span>
    `;
    
    chatMessages.appendChild(msgDiv);
    messageInput.value = '';
    scrollToBottom();

    // Send via PeerJS if connected
    if (currentConn && currentConn.open) {
        currentConn.send(text);
    } else {
        // Mock feedback if not connected
        const sysDiv = document.createElement('div');
        sysDiv.className = 'message received';
        sysDiv.style.background = 'rgba(255, 0, 0, 0.1)';
        sysDiv.innerHTML = `
            <p><i>System: Message not sent. You are not connected. Click the link icon to connect to a friend's ID.</i></p>
            <span class="time">${timeString}</span>
        `;
        chatMessages.appendChild(sysDiv);
        scrollToBottom();
    }
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag]));
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Real Actions: Connect & Share
document.getElementById('connect-btn').addEventListener('click', () => {
    if (!peer || !myPeerId) {
        alert('Please wait for your Peer ID to generate.');
        return;
    }
    const targetId = prompt('Enter the Peer ID of the person you want to connect to:');
    if (targetId && targetId !== myPeerId) {
        currentConn = peer.connect(targetId);
        setupConnection(currentConn);
    } // else do nothing
});

document.getElementById('call-btn').addEventListener('click', () => {
    alert('Audio calls are still under development for this encrypted channel.');
});

document.getElementById('share-btn').addEventListener('click', () => {
    if (myPeerId) {
        navigator.clipboard.writeText(myPeerId).then(() => {
            alert(`Your SECURE PEER ID: ${myPeerId} has been copied to your clipboard.\nPaste and send it to your friend!`);
        }).catch(() => {
            // fallback if clipboard fails
            prompt("Copy your SECURE PEER ID below:", myPeerId);
        });
    } else {
        alert('Your Peer ID is still generating. Please wait a moment.');
    }
});
