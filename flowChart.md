graph TD
    A[Constructor] -->|1| B[Initialize Game State]
    B --> B1[Set Language]
    B --> B2[Initialize BLOCKS]
    B --> B3[Load Level Layout]
    
    A -->|2| C[initializeGame]
    C --> C1[Create Board]
    C --> C2[Render Pieces]
    C --> C3[Update Stats]
    C --> C4[Update UI Text]
    C --> C5[Setup Event Listeners]

    D[User Interactions] --> D1[Level Selection]
    D --> D2[Language Selection]
    D --> D3[Piece Click]
    D --> D4[Reset Game]
    D --> D5[Undo Move]

    D3 --> E[handlePieceClick]
    E --> F[Get Possible Moves]
    F --> G{Multiple Moves?}
    G -->|Yes| H[Show Move Options]
    G -->|No| I[Move Piece]
    H --> I
    
    I --> J[moveToPosition]
    J --> J1[Save History]
    J --> J2[Update Position]
    J --> J3[Update Stats]
    J --> J4[Render Pieces]
    J --> J5[Check Win]

    J5 -->|Win| K[Handle Win]
    K --> K1[Prompt UserID]
    K1 --> K2[Save Best Score]
    K2 --> K3[Reset Game]

    D4 --> L[resetGame]
    L --> L1[Clear Arrows]
    L --> L2[Reset State]
    L --> L3[Reset Stats]
    L --> L4[Render Pieces]

    D5 --> M[undoMove]
    M --> M1[Pop History]
    M1 --> M2[Update State]
    M2 --> M3[Update Stats]
    M3 --> M4[Render Pieces]

    subgraph Game Loop
        E
        F
        G
        H
        I
        J
    end

    subgraph Rendering
        C2
        J4
        L4
        M4
    end

    subgraph State Management
        J1
        J2
        L2
        M2
    end


Here's how to add a comprehensive tutorial system to the game:

1. First, add a tutorial modal HTML structure to index.html:

````html
<div id="tutorialModal" class="modal hidden">
  <div class="modal-content">
    <h2>How to Play</h2>
    <div class="tutorial-steps">
      <div class="tutorial-step active">
        <img src="tutorial1.png" alt="Click any piece">
        <p>1. Click any piece to see where it can move</p>
      </div>
      <div class="tutorial-step">
        <img src="tutorial2.png" alt="Click arrows">
        <p>2. Click the arrows to move the piece</p>
      </div>
      <div class="tutorial-step">
        <img src="tutorial3.png" alt="Help Cao Cao">
        <p>3. Help Cao Cao (2x2 red block) reach the bottom exit</p>
      </div>
    </div>
    <div class="tutorial-nav">
      <button id="prevStep">Previous</button>
      <button id="nextStep">Next</button>
      <button id="closeTutorial">Start Playing</button>
    </div>
  </div>
</div>
````

2. Add CSS styles for the tutorial:

````css
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  max-width: 500px;
  text-align: center;
}

.tutorial-steps {
  margin: 2rem 0;
}

.tutorial-step {
  display: none;
}

.tutorial-step.active {
  display: block;
}

.tutorial-step img {
  max-width: 100%;
  margin-bottom: 1rem;
}

.tutorial-nav {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.hidden {
  display: none;
}

/* Add Help button styles */
.help-button {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #4CAF50;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 20px;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}
````

3. Add tutorial management to the game class:

````typescript
export class HuarongGame {
  private currentTutorialStep = 0;
  
  constructor(level: number = 0) {
    // ...existing initialization code...
    
    this.initializeTutorial();
  }

  private initializeTutorial() {
    // Add help button to the page
    const helpButton = document.createElement('button');
    helpButton.className = 'help-button';
    helpButton.textContent = '❔ How to Play';
    helpButton.onclick = () => this.showTutorial();
    document.body.appendChild(helpButton);

    // Initialize tutorial controls
    document.getElementById('prevStep')?.addEventListener('click', () => this.prevTutorialStep());
    document.getElementById('nextStep')?.addEventListener('click', () => this.nextTutorialStep());
    document.getElementById('closeTutorial')?.addEventListener('click', () => this.closeTutorial());

    // Show tutorial automatically for first-time visitors
    if (!localStorage.getItem('tutorialSeen')) {
      this.showTutorial();
      localStorage.setItem('tutorialSeen', 'true');
    }
  }

  private showTutorial() {
    const modal = document.getElementById('tutorialModal');
    if (modal) {
      modal.classList.remove('hidden');
      this.currentTutorialStep = 0;
      this.updateTutorialStep();
    }
  }

  private closeTutorial() {
    const modal = document.getElementById('tutorialModal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  private updateTutorialStep() {
    const steps = document.querySelectorAll('.tutorial-step');
    steps.forEach(step => step.classList.remove('active'));
    steps[this.currentTutorialStep]?.classList.add('active');

    // Update navigation buttons
    const prevBtn = document.getElementById('prevStep');
    const nextBtn = document.getElementById('nextStep');
    const closeBtn = document.getElementById('closeTutorial');

    if (prevBtn) prevBtn.style.display = this.currentTutorialStep === 0 ? 'none' : 'block';
    if (nextBtn) nextBtn.style.display = this.currentTutorialStep === steps.length - 1 ? 'none' : 'block';
    if (closeBtn) closeBtn.style.display = this.currentTutorialStep === steps.length - 1 ? 'block' : 'none';
  }

  private prevTutorialStep() {
    if (this.currentTutorialStep > 0) {
      this.currentTutorialStep--;
      this.updateTutorialStep();
    }
  }

  private nextTutorialStep() {
    const steps = document.querySelectorAll('.tutorial-step');
    if (this.currentTutorialStep < steps.length - 1) {
      this.currentTutorialStep++;
      this.updateTutorialStep();
    }
  }
}
````

4. Create tutorial images:
- Create three tutorial images (`tutorial1.png`, `tutorial2.png`, `tutorial3.png`) showing:
  1. A highlighted piece with arrows indicating where to click
  2. Direction arrows showing how to move pieces
  3. The Cao Cao piece highlighted with an arrow pointing to the bottom exit

This implementation:
- Shows a "How to Play" button in the bottom-right corner
- Automatically shows the tutorial for first-time visitors
- Provides a step-by-step guide with images and text
- Can be accessed at any time via the help button
- Saves tutorial viewed state in localStorage

Remember to create appropriate tutorial images that clearly demonstrate each step of the gameplay.

Similar code found with 2 license types