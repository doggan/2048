function GameManager(InputManager, Actuator, StorageManager) {
  this.size           = { x: 3, y: 4 }; // Size of the grid
  this.inputManager   = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator       = new Actuator;

  this.startTiles     = this.size.x * this.size.y - 1;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));

  this.setup();
}

// Restart the game
GameManager.prototype.restart = function () {
  this.storageManager.clearGameState();
  this.actuator.continueGame(); // Clear the game won/lost message
  this.setup();
};

// Is the current grid configuration solvable? Return true if solvable, false if not.
GameManager.prototype.checkSolvableConfiguration = function() {
  // Algorithm based on the explanation here:
  // http://www.cs.princeton.edu/courses/archive/fall12/cos226/assignments/8puzzle.html
  var inversionCount = 0;

  for (var y = 0; y < this.size.y; y++) {
    for (var x = 0; x < this.size.x; x++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        var x2 = x;
        for (var y2 = y; y2 < this.size.y; y2++) {
          for (; x2 < this.size.x; x2++) {
            var otherTile = this.grid.cellContent({ x: x2, y: y2 });
            if (otherTile) {
              if (tile.value > otherTile.value) {
                inversionCount++;
              }
            }
          }

          // Beginning of the row.
          x2 = 0;
        }
      }
    }
  }

  // TODO: support even size boards

  // Number of inversions must be even for this to be a solvable board.
  return (inversionCount % 2) == 0;
}

GameManager.prototype.checkWinCondition = function() {
  var tile;

  for (var x = 0; x < this.size.x; x++) {
    for (var y = 0; y < this.size.y; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        if (!tile.isInCorrectPosition()) {
          return;
        }
      }
    }
  }

  // If we make it here, all tiles are in their correct positions.
  this.won = true;
};

// Set up the game
GameManager.prototype.setup = function () {
  var previousState = this.storageManager.getGameState();

  // Reload the game from a previous game if present
  if (previousState) {
    this.grid        = new Grid(previousState.grid.size,
                                previousState.grid.cells); // Reload grid
    this.won         = previousState.won;
  } else {
    this.won         = false;

    // Continue re-shuffling until we find a solvable configuration.
    do {
      this.grid        = new Grid(this.size);
      this.shuffleTiles();
    } while (!this.checkSolvableConfiguration());
  }

  // Only one cell will be available, and this will be the empty cell.
  this.emptyCell = this.grid.randomAvailableCell();

  // Update the actuator
  this.actuate();
};

// Shuffle the tiles for the initial layout of the board
GameManager.prototype.shuffleTiles = function () {
  var value = 1;
  for (var i = 0; i < this.startTiles; i++) {
    // Calculate the 'correct' grid position.
    var correctPosition;
    {
      var y = Math.floor((value - 1) / this.size.x);
      var x = value - (y * this.size.x) - 1;
      correctPosition = { x: x, y: y };
    }
    var tile = new Tile(this.grid.randomAvailableCell(), correctPosition, value);
    this.grid.insertTile(tile);

    value++;
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  this.storageManager.setGameState(this.serialize());

  this.checkWinCondition();
  
  this.actuator.actuate(this.grid, {
    won:        this.won
  });

};

// Represent the current game as an object
GameManager.prototype.serialize = function () {
  return {
    grid:        this.grid.serialize(),
    won:         this.won
  };
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this;

  if (this.won) return; // Don't do anything if the game's over

  var cell, tile;

  var vector     = this.getVector(direction);

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Get cell in opposite direction of move.
  cell = { x: this.emptyCell.x - vector.x, y: this.emptyCell.y - vector.y };
  tile = self.grid.cellContent(cell)
  if (tile) {
    self.moveTile(tile, this.emptyCell)

    this.emptyCell = cell;

    this.actuate();
  }
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1 }, // Up
    1: { x: 1,  y: 0 },  // Right
    2: { x: 0,  y: 1 },  // Down
    3: { x: -1, y: 0 }   // Left
  };

  return map[direction];
};
