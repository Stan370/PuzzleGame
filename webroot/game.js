import { translations } from './translations.js';
import { getAllLevels, saveUserLevel, deleteUserLevel } from './gameLayout.js';
// <!-- 经典五关（横刀立马、指挥若定、水泄不通、四面楚歌、兵分三路） -->
export class HuarongGame {
    getNextGeneral() {
        const char = this.generals[this.generalIndex];
        this.generalIndex = (this.generalIndex + 1) % this.generals.length;
        return char;
    }
    getNextHorizontalGeneral() {
        const char = this.horizontalGenerals[this.horizontalIndex];
        this.horizontalIndex = (this.horizontalIndex + 1) % this.horizontalGenerals.length;
        return char;
    }
    constructor(level = 0) {
        this.BOARD_WIDTH = 4;
        this.BOARD_HEIGHT = 5;
        this.moves = 0;
        this.moveHistory = [];
        this.selectedPiece = null;
        this.userId = null;
        this.currentLevel = 0;
        this.language = navigator.language.toLowerCase().startsWith('en') ? 'en' : 'zh';
        this.username = 'anonymous';
        this.slideSound = new Audio("assets/slideBlock.mp3");
        this.generals = ["张飞", "马超", "赵云", "黄忠"];
        this.generalIndex = 0;
        this.horizontalGenerals = ["关羽", "周仓", "魏延", "庞德"];
        this.horizontalIndex = 0;
        this.levels = [];
        this.selectedTool = 'CAO_CAO';
        this.editorMode = false;
        this.editorLayout = [];
        this.BLOCKS = {
            CAO_CAO: { width: 2, height: 2, char: "曹操", class: "cao" },
            VERTICAL: { width: 1, height: 2, char: "将军" },
            HORIZONTAL: { width: 2, height: 1, char: "将军" },
            SINGLE: { width: 1, height: 1, char: "兵" },
        };
        this.slideSound.volume = 0.2;
        this.currentLevel = level;
        this.bestScore = "-";
        this.levels = getAllLevels();
        this.blocks = JSON.parse(JSON.stringify(this.levels[level].layout));
        // Debug logging for language and translations
        this.language = navigator.language.toLowerCase().startsWith('en') ? 'en' : 'zh';
        console.log('[DEBUG] Selected language:', this.language);
        console.log('[DEBUG] Available translations:', Object.keys(translations));
        console.log('[DEBUG] Current translations:', translations[this.language]);
        // Assign character names to blocks
        this.blocks.forEach(block => {
            if (block.type === 'VERTICAL') {
                block.char = this.getNextGeneral();
            }
            else if (block.type === 'HORIZONTAL') {
                block.char = this.getNextHorizontalGeneral();
            }
        });
        this.initializeGame();
        this.initializeLevelSelector();
        this.initializeLanguageSelector();
        this.initializeHintSystem();
        this.setupMessageHandlers();
        this.initializeLeaderboard();
        this.initializeLevelEditor();
    }
    setupMessageHandlers() {
        window.addEventListener('message', async (event) => {
            const message = event.data;
            if (message.type === 'initialData') {
                this.username = message.data.username;
                this.requestBestScore();
                this.requestLeaderboard(this.currentLevel);
            }
            if (message.type === 'bestScoreResponse') {
                const score = message.data.score;
                if (score !== null) {
                    this.bestScore = score;
                    this.updateStats();
                }
            }
            if (message.type === 'leaderboardResponse') {
                console.log(`[DEBUG] Received leaderboard response:`, message.data);
                if (Array.isArray(message.data.entries)) {
                    console.log(`[DEBUG] Entries count: ${message.data.entries.length}`);
                    this.updateLeaderboard(message.data.entries);
                }
                else {
                    console.log(`[DEBUG] Error: leaderboard entries is not an array or is missing`);
                }
            }
            if (message.type === 'changeLevel') {
                const newLevel = message.data.level;
                this.changeLevel(newLevel);
            }
        });
    }
    requestBestScore() {
        window.parent.postMessage({
            type: 'getBestScore',
            data: {
                username: this.username,
                level: this.currentLevel
            }
        }, '*');
    }
    requestLeaderboard(level) {
        window.parent.postMessage({
            type: 'getLeaderboard',
            data: { level }
        }, '*');
    }
    
    updateLeaderboard(entries) {
        const leaderboardList = document.getElementById('leaderboardList');
        if (!leaderboardList)
            return;
        leaderboardList.innerHTML = '';
        if (entries.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'leaderboard-empty';
            emptyMessage.textContent = translations[this.language].noScores || 'No scores recorded yet!';
            leaderboardList.appendChild(emptyMessage);
            return;
        }
        entries.forEach((entry, index) => {
            const entryElement = document.createElement('div');
            entryElement.className = 'leaderboard-entry';
            // Highlight the current user
            if (entry.username === this.username) {
                entryElement.classList.add('current-user');
            }
            // Add medals for top 3
            let medalEmoji = '';
            const rank = entry.rank || index + 1;
            if (rank === 1)
                medalEmoji = '🥇 ';
            else if (rank === 2)
                medalEmoji = '🥈 ';
            else if (rank === 3)
                medalEmoji = '🥉 ';
            entryElement.innerHTML = `
        <span class="rank">#${rank}</span>
        <span class="username">${medalEmoji}${entry.username}</span>
        <span class="score">${entry.score} ${translations[this.language].moves || 'moves'}</span>
      `;
            leaderboardList.appendChild(entryElement);
        });
        // Add a "View Full Leaderboard" button at the bottom
        const viewMoreButton = document.createElement('button');
        viewMoreButton.className = 'view-leaderboard-button';
        viewMoreButton.textContent = translations[this.language].viewFullLeaderboard || 'View Full Leaderboard';
        viewMoreButton.addEventListener('click', () => {
            window.parent.postMessage({
                type: 'openLeaderboard',
            }, '*');
        });
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'leaderboard-button-container';
        buttonContainer.appendChild(viewMoreButton);
        leaderboardList.appendChild(buttonContainer);
    }
    showVictoryAnimation() {
        const board = document.getElementById('board');
        if (!board)
            return;
        // Create victory overlay
        const overlay = document.createElement('div');
        overlay.className = 'victory-overlay';
        overlay.innerHTML = `
      <div class="victory-content">
        <div class="victory-title">🎉 Level Complete! 🎉</div>
        <div class="victory-stats">
          <div>Moves: ${this.moves}</div>
          <div>Best Score: ${this.bestScore}</div>
        </div>
        <button class="victory-button">Continue</button>
      </div>
    `;
        // Add styles for the animation
        const style = document.createElement('style');
        style.textContent = `
      .victory-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        animation: fadeIn 0.5s ease-in-out;
      }
      .victory-content {
        background: var(--cao-color);
        padding: 2rem;
        border-radius: 1rem;
        text-align: center;
        animation: slideIn 0.5s ease-in-out;
      }
      .victory-title {
        font-size: 2rem;
        color: white;
        margin-bottom: 1rem;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
      }
      .victory-stats {
        color: white;
        font-size: 1.2rem;
        margin-bottom: 1.5rem;
      }
      .victory-button {
        background: white;
        color: var(--cao-color);
        border: none;
        padding: 0.8rem 1.5rem;
        border-radius: 0.5rem;
        font-size: 1.1rem;
        cursor: pointer;
        transition: transform 0.2s;
      }
      .victory-button:hover {
        transform: scale(1.05);
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideIn {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
        document.head.appendChild(style);
        // Add overlay to board
        board.appendChild(overlay);
        // Handle continue button click
        const continueButton = overlay.querySelector('.victory-button');
        continueButton?.addEventListener('click', () => {
            overlay.remove();
            this.resetGame();
        });
    }
    async checkWin(block) {
        if (block.type === "CAO_CAO" && block.y === this.BOARD_HEIGHT - 2) {
            console.log("[DEBUG] Win condition met!");
            const handleWin = async () => {
                this.showVictoryAnimation();
                // Update scores in Redis
                if (this.username) {
                    // Update best score for the user
                    const currentBest = await this.getBestScore();
                    console.log(`[DEBUG] ${this.username} Current best score: ${currentBest}, new score: ${this.moves}`);
                    if (!currentBest || this.moves < currentBest) {
                        console.log(`[DEBUG] Updating best score to ${this.moves}`);
                        await this.updateBestScore(this.moves);
                    }
                    else {
                        console.log(`[DEBUG] Not updating best score as current (${this.moves}) is not better than ${currentBest}`);
                    }
                }
                else {
                    console.log("[DEBUG] No username available, skipping score update");
                }
                alert(`Congratulations! You won in ${this.moves} moves!`);
                this.resetGame();
            };
            setTimeout(handleWin, 100);
        }
    }
    async getBestScore() {
        return new Promise((resolve) => {
            window.parent.postMessage({
                type: 'getBestScore',
                data: {
                    username: this.username,
                    level: this.currentLevel
                }
            }, '*');
            const handleResponse = (event) => {
                if (event.data.type === 'bestScoreResponse') {
                    window.removeEventListener('message', handleResponse);
                    resolve(event.data.data.score);
                }
            };
            window.addEventListener('message', handleResponse);
        });
    }
    async updateBestScore(newScore) {
        console.log(`[DEBUG] Updating best score and leaderboard: ${newScore}`);
        // Send updateScore message to update both best score and leaderboard
        window.parent.postMessage({
            type: 'updateScore',
            data: {
                username: this.username,
                level: this.currentLevel,
                score: newScore
            }
        }, '*');
        // Add listener to verify message receipt
        const checkMessageReceived = (event) => {
            if (event.data?.type === 'updateScoreAck') {
                console.log(`[DEBUG] Received acknowledgment for score update`);
                window.removeEventListener('message', checkMessageReceived);
            }
        };
        window.addEventListener('message', checkMessageReceived);
        // Request updated leaderboard after updating score
        this.requestLeaderboard(this.currentLevel);
    }
    initializeHintSystem() {
        const levelDesc = document.getElementById("levelDescription");
        levelDesc.innerHTML = `<p>${this.levels[this.currentLevel].description}</p>`;
    }
    async promptForUserId() {
        const id = prompt("Congratulations, you won! Enter your user ID to save your score:");
        if (id) {
            this.userId = id;
            const existingBestScore = localStorage.getItem(`bestScore_${id}`);
            if (existingBestScore) {
                this.bestScore = parseInt(existingBestScore);
                this.updateStats();
            }
        }
        return id;
    }
    initializeGame() {
        const board = document.getElementById("board");
        if (!board)
            return;
        board.innerHTML = "";
        this.createBoard();
        this.renderPieces();
        this.updateStats();
        this.updateUIText();
        const resetBtn = document.getElementById("resetBtn");
        resetBtn?.addEventListener("click", () => this.resetGame());
        const undoBtn = document.getElementById("undoBtn");
        undoBtn?.addEventListener("click", () => this.undoMove());
        // Add a debug button for testing Redis if in development mode
        if (this.isDevelopment()) {
            const debugContainer = document.createElement('div');
            debugContainer.style.padding = '10px';
            debugContainer.style.marginTop = '10px';
            debugContainer.style.border = '1px dashed #999';
            const redisTestBtn = document.createElement('button');
            redisTestBtn.textContent = 'Test Redis Connection';
            redisTestBtn.style.backgroundColor = '#ff5722';
            redisTestBtn.style.color = 'white';
            redisTestBtn.style.padding = '5px 10px';
            redisTestBtn.style.border = 'none';
            redisTestBtn.style.borderRadius = '4px';
            redisTestBtn.onclick = () => this.testRedisConnection();
            debugContainer.appendChild(redisTestBtn);
            const debugResults = document.createElement('div');
            debugResults.id = 'redisTestResults';
            debugResults.style.marginTop = '5px';
            debugResults.style.fontSize = '12px';
            debugContainer.appendChild(debugResults);
            // Add to the DOM
            const container = document.querySelector('.game-container');
            container?.appendChild(debugContainer);
        }
    }
    initializeLevelSelector() {
        const levelSelector = document.getElementById("levelSelector");
        if (levelSelector) {
            levelSelector.value = this.currentLevel.toString();
            levelSelector.addEventListener("change", (e) => {
                const newLevel = parseInt(e.target.value);
                this.changeLevel(newLevel);
            });
        }
    }
    initializeLanguageSelector() {
        const languageSelector = document.getElementById('languageSelector');
        languageSelector.value = this.language;
        console.log('[DEBUG] Current translations:', translations[this.language]); // Add this debug line
        languageSelector.addEventListener('change', (e) => {
            this.language = e.target.value;
            this.updateUIText();
        });
    }
    updateUIText() {
        const t = translations[this.language];
        console.log('[DEBUG] Updating UI text with language:', this.language);
        console.log('[DEBUG] Translations object:', t);
        // Update title
        const titleElement = document.querySelector('h1');
        if (titleElement) {
            titleElement.textContent = t.title;
        }
        // Update buttons
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.textContent = t.reset;
        }
        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) {
            undoBtn.textContent = t.undo;
        }
        // Update tooltip content
        const tooltipHeader = document.querySelector('.tooltip-header');
        if (tooltipHeader) {
            tooltipHeader.textContent = t.title;
        }
        const tooltipIntro = document.querySelector('.tooltip-content > p');
        if (tooltipIntro) {
            tooltipIntro.textContent = t.gameIntro;
        }
        const levelDesc = document.getElementById('levelDescription');
        if (levelDesc) {
            // Get current level info directly from translations
            const currentLevelInfo = t.levels?.[this.currentLevel];
            const currentLevel = this.levels[this.currentLevel];
            console.log('[DEBUG] Current level info from translations:', currentLevelInfo);
            console.log('[DEBUG] Current level from game:', currentLevel);
            if (currentLevelInfo) {
                levelDesc.innerHTML = `
          <h3>${currentLevelInfo.name}</h3>
          <p>${currentLevelInfo.description}</p>
        `;
            }
            else if (currentLevel) {
                levelDesc.innerHTML = `
          <h3>${currentLevel.name}</h3>
          <p>${currentLevel.description}</p>
        `;
            }
        }
        // Update level selector options
        const levelSelector = document.getElementById('levelSelector');
    t.levels.forEach((level, index) => {
      levelSelector.options[index].text = `${t.level} ${index + 1}: ${level.name}`;
    });
        // Update stats display
        const stats = document.querySelector('.stats');
        if (stats) {
            stats.innerHTML = `${t.moves}: <span id="moveCount">${this.moves}</span> | ${t.best}: <span id="bestScore">${this.bestScore}</span>`;
        }
    }
    changeLevel(level) {
        if (level < 0 || level >= this.levels.length)
            return;
        this.currentLevel = level;
        this.blocks = JSON.parse(JSON.stringify(this.levels[level].layout));
        // Reset indices and assign new characters
        this.generalIndex = 0;
        this.horizontalIndex = 0;
        this.blocks.forEach(block => {
            if (block.type === 'VERTICAL') {
                block.char = this.getNextGeneral();
            }
            else if (block.type === 'HORIZONTAL') {
                block.char = this.getNextHorizontalGeneral();
            }
        });
        // Reset game state
        this.moves = 0;
        this.moveHistory = [];
        this.selectedPiece = null;
        // Update best score
        if (!this.userId) {
            this.bestScore = "-";
        }
        else {
            const existingBestScore = localStorage.getItem(`bestScore_${this.userId}_level${level}`);
            this.bestScore = existingBestScore ? parseInt(existingBestScore) : "-";
        }
        // Update UI
        this.updateStats();
        this.renderPieces();
        this.updateUIText();
        this.requestLeaderboard(level);
    }
    createBoard() {
        const board = document.getElementById("board");
        if (!board)
            return;
        board.style.gridTemplateColumns = `repeat(${this.BOARD_WIDTH}, var(--cell-size))`; //这将创建一个5列的网格，每列的宽度 --cell-size 变量定义的值。
        board.style.gridTemplateRows = `repeat(${this.BOARD_HEIGHT}, var(--cell-size))`;
    }
    renderPieces() {
        const board = document.getElementById("board");
        if (!board)
            return;
        board.innerHTML = "";
        this.blocks.forEach((block, index) => {
            const blockType = { ...this.BLOCKS[block.type] };
            const piece = document.createElement("div");
            piece.className = `piece ${blockType.class || ""}`;
            piece.textContent = block.char || blockType.char; // Use stored character
            piece.style.gridColumn = `${block.x + 1} / span ${blockType.width}`;
            piece.style.gridRow = `${block.y + 1} / span ${blockType.height}`;
            piece.dataset.index = index.toString();
            piece.addEventListener("click", () => this.handlePieceClick(index));
            board.appendChild(piece);
        });
    }
    handlePieceClick(index) {
        // Remove any existing arrows first
        document
            .querySelectorAll(".direction-arrow")
            .forEach((arrow) => arrow.remove());
        const block = this.blocks[index];
        const moves = this.getPossibleMoves(block);
        if (moves.length === 0) {
            return; // Can't move
        }
        else if (moves.length === 1) {
            this.moveToPosition(index, moves[0]);
        }
        else {
            this.showMoveOptions(index, moves);
        }
    }
    showMoveOptions(index, moves) {
        const block = this.blocks[index];
        const piece = document.querySelector(`[data-index="${index}"]`);
        const board = document.getElementById("board");
        if (!piece || !board)
            return;
        const rect = piece.getBoundingClientRect();
        const boardRect = board.getBoundingClientRect();
        // Remove any existing arrows
        document
            .querySelectorAll(".direction-arrow")
            .forEach((arrow) => arrow.remove());
        moves.forEach((move) => {
            const arrow = document.createElement("div");
            arrow.className = "direction-arrow";
            // Calculate position relative to the piece
            const direction = this.getDirectionText(block, move);
            const svgIcon = this.getDirectionSVG(direction);
            // Position the arrow based on direction
            const pieceWidth = rect.width;
            const pieceHeight = rect.height;
            const arrowSize = 34;
            let left, top;
            switch (direction) {
                case "Left":
                    left = rect.left - boardRect.left - arrowSize;
                    top = rect.top - boardRect.top + pieceHeight / 2 - arrowSize / 2 - 3;
                    break;
                case "Right":
                    left = rect.right - boardRect.left - 7;
                    top = rect.top - boardRect.top + pieceHeight / 2 - arrowSize / 2 - 3;
                    break;
                case "Up":
                    left = rect.left - boardRect.left + pieceWidth / 2 - arrowSize / 2 - 3;
                    top = rect.top - boardRect.top - arrowSize;
                    break;
                case "Down":
                    left = rect.left - boardRect.left + pieceWidth / 2 - 20;
                    top = rect.bottom - boardRect.top - 7;
                    break;
            }
            arrow.style.left = `${left}px`;
            arrow.style.top = `${top}px`;
            arrow.innerHTML = svgIcon;
            arrow.onclick = () => {
                this.moveToPosition(index, move);
                document
                    .querySelectorAll(".direction-arrow")
                    .forEach((a) => a.remove());
            };
            board.appendChild(arrow);
        });
    }
    getDirectionText(block, move) {
        if (move.x < block.x)
            return "Left";
        if (move.x > block.x)
            return "Right";
        if (move.y < block.y)
            return "Up";
        return "Down";
    }
    getDirectionSVG(direction) {
        const svgs = {
            Right: `<svg width="64px" height="64px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M21 12C21 12.2652 20.8946 12.5196 20.7071 12.7071L13.7071 19.7071C13.3166 20.0976 12.6834 20.0976 12.2929 19.7071C11.9024 19.3166 11.9024 18.6834 12.2929 18.2929L17.5858 13H4C3.44772 13 3 12.5523 3 12C3 11.4477 3.44772 11 4 11H17.5858L12.2929 5.70711C11.9024 5.31658 11.9024 4.68342 12.2929 4.29289C12.6834 3.90237 13.3166 3.90237 13.7071 4.29289L20.7071 11.2929C20.8946 11.4804 21 11.7348 21 12Z" fill="#000000"></path></svg>`,
            Left: `<svg width="64px" height="64px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M3 12C3 11.7348 3.10536 11.4804 3.29289 11.2929L10.2929 4.29289C10.6834 3.90237 11.3166 3.90237 11.7071 4.29289C12.0976 4.68342 12.0976 5.31658 11.7071 5.70711L6.41421 11H20C20.5523 11 21 11.4477 21 12C21 12.5523 20.5523 13 20 13H6.41421L11.7071 18.2929C12.0976 18.6834 12.0976 19.3166 11.7071 19.7071C11.3166 20.0976 10.6834 20.0976 10.2929 19.7071L3.29289 12.7071C3.10536 12.5196 3 12.2652 3 12Z" fill="#000000"></path></svg>`,
            Up: `<svg width="64px" height="64px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 3C12.2652 3 12.5196 3.10536 12.7071 3.29289L19.7071 10.2929C20.0976 10.6834 20.0976 11.3166 19.7071 11.7071C19.3166 12.0976 18.6834 12.0976 18.2929 11.7071L13 6.41421V20C13 20.5523 12.5523 21 12 21C11.4477 21 11 20.5523 11 20V6.41421L5.70711 11.7071C5.31658 12.0976 4.68342 12.0976 4.29289 11.7071C3.90237 11.3166 3.90237 10.6834 4.29289 10.2929L11.2929 3.29289C11.4804 3.10536 11.7348 3 12 3Z" fill="#000000"></path></svg>`,
            Down: `<svg width="64px" height="64px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 21C11.7348 21 11.4804 20.8946 11.2929 20.7071L4.29289 13.7071C3.90237 13.3166 3.90237 12.6834 4.29289 12.2929C4.68342 11.9024 5.31658 11.9024 5.70711 12.2929L11 17.5858V4C11 3.44772 11.4477 3 12 3C12.5523 3 13 3.44772 13 4V17.5858L18.2929 12.2929C18.6834 11.9024 19.3166 11.9024 19.7071 12.2929C20.0976 12.6834 20.0976 13.3166 19.7071 13.7071L12.7071 20.7071C12.5196 20.8946 12.2652 21 12 21Z" fill="#000000"></path></svg>`,
        };
        return svgs[direction];
    }
    moveToPosition(blockIndex, position) {
        this.moveHistory.push(JSON.stringify(this.blocks));
        const block = this.blocks[blockIndex];
        block.x = position.x;
        block.y = position.y;
        this.moves++;
        this.slideSound.play();
        this.updateStats();
        this.renderPieces();
        this.checkWin(block);
    }
    updatePieceSelection() {
        document.querySelectorAll(".piece").forEach((piece) => {
            piece.style.filter = "none";
        });
        if (this.selectedPiece !== null) {
            const piece = document.querySelector(`[data-index="${this.selectedPiece}"]`);
            if (piece) {
                piece.style.filter = "brightness(1.2)";
            }
        }
    }
    isAdjacent(block1, block2) {
        const b1Type = this.BLOCKS[block1.type];
        const b2Type = this.BLOCKS[block2.type];
        const b1Right = block1.x + b1Type.width;
        const b1Bottom = block1.y + b1Type.height;
        const b2Right = block2.x + b2Type.width;
        const b2Bottom = block2.y + b2Type.height;
        return ((Math.abs(b1Right - block2.x) === 0 &&
            this.hasVerticalOverlap(block1, block2)) ||
            (Math.abs(block1.x - b2Right) === 0 &&
                this.hasVerticalOverlap(block1, block2)) ||
            (Math.abs(b1Bottom - block2.y) === 0 &&
                this.hasHorizontalOverlap(block1, block2)) ||
            (Math.abs(block1.y - b2Bottom) === 0 &&
                this.hasHorizontalOverlap(block1, block2)));
    }
    hasVerticalOverlap(block1, block2) {
        const b1Type = this.BLOCKS[block1.type];
        const b2Type = this.BLOCKS[block2.type];
        return !(block1.y >= block2.y + b2Type.height ||
            block2.y >= block1.y + b1Type.height);
    }
    hasHorizontalOverlap(block1, block2) {
        const b1Type = this.BLOCKS[block1.type];
        const b2Type = this.BLOCKS[block2.type];
        return !(block1.x >= block2.x + b2Type.width || block2.x >= block1.x + b1Type.width);
    }
    getPossibleMoves(block) {
        const moves = [];
        [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
        ].forEach(([dx, dy]) => {
            const newX = block.x + dx;
            const newY = block.y + dy;
            if (this.isValidMove(block, newX, newY)) {
                moves.push({ x: newX, y: newY });
            }
        });
        return moves;
    }
    isValidMove(block, newX, newY) {
        const blockType = this.BLOCKS[block.type];
        if (newX < 0 ||
            newY < 0 ||
            newX + blockType.width > this.BOARD_WIDTH ||
            newY + blockType.height > this.BOARD_HEIGHT) {
            return false;
        }
        return !this.blocks.some((otherBlock) => {
            if (block === otherBlock)
                return false;
            const otherType = this.BLOCKS[otherBlock.type];
            return this.rectsIntersect({ x: newX, y: newY, w: blockType.width, h: blockType.height }, {
                x: otherBlock.x,
                y: otherBlock.y,
                w: otherType.width,
                h: otherType.height,
            });
        });
    }
    rectsIntersect(r1, r2) {
        return !(r2.x >= r1.x + r1.w ||
            r2.x + r2.w <= r1.x ||
            r2.y >= r1.y + r1.h ||
            r2.y + r2.h <= r1.y);
    }
    undoMove() {
        if (this.moveHistory.length > 0) {
            const lastMove = this.moveHistory.pop();
            if (lastMove) {
                this.blocks = JSON.parse(lastMove);
            }
            this.moves--;
            this.updateStats();
            this.renderPieces();
        }
    }
    resetGame() {
        document
            .querySelectorAll(".direction-arrow")
            .forEach((arrow) => arrow.remove());
        this.generalIndex = 0;
        this.horizontalIndex = 0;
        this.blocks = JSON.parse(JSON.stringify(this.levels[this.currentLevel].layout));
        this.blocks.forEach(block => {
            if (block.type === 'VERTICAL') {
                block.char = this.getNextGeneral();
            }
            else if (block.type === 'HORIZONTAL') {
                block.char = this.getNextHorizontalGeneral();
            }
        });
        this.moves = 0;
        this.moveHistory = [];
        this.selectedPiece = null;
        if (!this.userId) {
            this.bestScore = "-";
        }
        this.updateStats();
        this.renderPieces();
        this.updateUIText();
    }
    updateStats() {
        const moveCount = document.getElementById("moveCount");
        const bestScore = document.getElementById("bestScore");
        if (moveCount) {
            moveCount.textContent = this.moves.toString();
        }
        if (bestScore) {
            bestScore.textContent = this.bestScore.toString();
        }
    }
    // Helper method to check if in development environment
    isDevelopment() {
        return window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.search.includes('debug=true');
    }
    // Test Redis connection
    testRedisConnection() {
        console.log('[DEBUG] Testing Redis connection...');
        const resultElement = document.getElementById('redisTestResults');
        if (resultElement) {
            resultElement.textContent = 'Testing Redis connection...';
            resultElement.style.color = '#666';
        }
        window.parent.postMessage({
            type: 'testRedis'
        }, '*');
        // Listen for the response
        const handleResponse = (event) => {
            if (event.data.type === 'testRedisResponse') {
                window.removeEventListener('message', handleResponse);
                const { success, message } = event.data.data;
                console.log(`[DEBUG] Redis test result: ${success ? 'Success' : 'Failed'} - ${message}`);
                if (resultElement) {
                    resultElement.textContent = message;
                    resultElement.style.color = success ? 'green' : 'red';
                }
            }
        };
        window.addEventListener('message', handleResponse);
    }
    // Add method to create new level
    createNewLevel(name, description, layout, difficulty = 3) {
        const newLevel = {
            name,
            description,
            layout,
            difficulty,
            creator: this.username,
            isUserCreated: true,
            dateCreated: new Date().toISOString()
        };
        saveUserLevel(newLevel);
        this.levels = getAllLevels();
        this.initializeLevelSelector();
    }
    // Add method to delete user level
    deleteUserLevel(levelName) {
        deleteUserLevel(levelName);
        this.levels = getAllLevels();
        this.initializeLevelSelector();
        // If current level was deleted, switch to first level
        if (this.levels[this.currentLevel]?.name === levelName) {
            this.changeLevel(0);
        }
    }
    initializeLevelEditor() {
        const editorBtn = document.getElementById('editorBtn');
        const editorModal = document.getElementById('editorModal');
        const closeEditor = document.getElementById('closeEditor');
        const saveLevel = document.getElementById('saveLevel');
        const testLevel = document.getElementById('testLevel');
        const editorBoard = document.getElementById('editorBoard');
        if (editorBtn && editorModal) {
            editorBtn.addEventListener('click', () => {
                this.editorMode = true;
                this.editorLayout = [];
                this.initializeEditorBoard();
                editorModal.classList.remove('hidden');
            });
        }
        if (closeEditor && editorModal) {
            closeEditor.addEventListener('click', () => {
                editorModal.classList.add('hidden');
                this.editorMode = false;
            });
        }
        // Tool selection
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedTool = btn.dataset.tool || 'CAO_CAO';
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        // Save level
        if (saveLevel) {
            saveLevel.addEventListener('click', () => {
                const name = document.getElementById('levelName').value;
                const description = document.getElementById('levelDesc').value;
                const difficulty = parseInt(document.getElementById('levelDifficulty').value);
                if (!name || !description) {
                    alert('Please fill in all fields');
                    return;
                }
                this.createNewLevel(name, description, this.editorLayout, difficulty);
                editorModal?.classList.add('hidden');
                this.editorMode = false;
            });
        }
        // Test level
        if (testLevel) {
            testLevel.addEventListener('click', () => {
                const name = document.getElementById('levelName').value || 'Test Level';
                const description = document.getElementById('levelDesc').value || 'Test level';
                // Create temporary level for testing
                const tempLevel = {
                    name,
                    description,
                    layout: this.editorLayout,
                    difficulty: 3
                };
                // Switch to test mode
                this.editorMode = false;
                this.levels = [tempLevel];
                this.changeLevel(0);
                editorModal?.classList.add('hidden');
            });
        }
    }
    initializeEditorBoard() {
        const editorBoard = document.getElementById('editorBoard');
        if (!editorBoard)
            return;
        editorBoard.innerHTML = '';
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 4; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.x = x.toString();
                cell.dataset.y = y.toString();
                cell.addEventListener('click', () => this.handleEditorCellClick(x, y));
                editorBoard.appendChild(cell);
            }
        }
    }
    handleEditorCellClick(x, y) {
        if (!this.editorMode)
            return;
        // Remove existing block at this position
        this.editorLayout = this.editorLayout.filter(block => !(block.x === x && block.y === y));
        // Add new block if not erasing
        if (this.selectedTool !== 'ERASE') {
            const block = {
                type: this.selectedTool,
                x,
                y
            };
            this.editorLayout.push(block);
        }
        this.updateEditorBoard();
    }
    updateEditorBoard() {
        const cells = document.querySelectorAll('.editor-board .cell');
        cells.forEach(cell => {
            const x = parseInt(cell.getAttribute('data-x') || '0');
            const y = parseInt(cell.getAttribute('data-y') || '0');
            const block = this.editorLayout.find(b => b.x === x && b.y === y);
            if (block) {
                cell.style.backgroundColor = this.getBlockColor(block.type);
            }
            else {
                cell.style.backgroundColor = 'var(--piece-color)';
            }
        });
    }
    getBlockColor(type) {
        switch (type) {
            case 'CAO_CAO':
                return 'var(--cao-color)';
            case 'VERTICAL':
                return 'var(--vertical-color)';
            case 'HORIZONTAL':
                return 'var(--horizontal-color)';
            case 'SINGLE':
                return 'var(--single-color)';
            default:
                return 'var(--piece-color)';
        }
    }
}
