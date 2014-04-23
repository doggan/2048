function GameManager(size, InputManager, Actuator, StorageManager) {
  this.size           = size; // Size of the grid
  this.inputManager   = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator       = new Actuator;

  this.startTiles     = size * size - 1;

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
  // TODO:
  return true;
}

GameManager.prototype.checkWinCondition = function() {
  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
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
      var y = Math.floor((value - 1) / this.size);
      var x = value - (y * this.size) - 1;
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
  var traversals = this.buildTraversals(vector);

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

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.grid.withinBounds(cell) &&
           this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = self.grid.cellContent(cell);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};
