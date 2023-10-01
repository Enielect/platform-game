//start platform game
class Level {
    constructor(levelPlan) {
        let rows = levelPlan.trim().split('\n').map(l => [...l]);
        this.width = rows[0].length;
        this.height = rows.length;
        this.startActors = [];

        this.rows = rows.map((row, y) => {
            return row.map((ch, x) => {
                let type = levelChar[ch];
                if (typeof type == 'string') return type;
                this.startActors.push(
                    type.create(new Vec(x, y), ch)
                );
                return 'empty';
            });
        });
    }
}

//State Class: tracking the state of the running game

class State {
    constructor(level, actors, status) {
        this.level = level;
        this.actors = actors;
        this.status = status;
    }
    static start(level) {
        return new State(level, level.startActors, 'playing');
    }
    get player() {
        return this.actors.find(r => r.type == 'player');
    }
}

//vectors
class Vec {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    plus(val) {
        return new Vec(this.x + val.x, this.y + val.y);
    }
    times(ele) {
        return new Vec(this.x * ele, this.y * ele);
    }
}

//Actors

class Lava {
    constructor(pos, speed, reset) {
        this.pos = pos;
        this.speed = speed;
        this.reset = reset;
    }
    get type() {
        return 'lava';
    }
    static create(pos, ch) {
        if (ch == 'v') {
            return new Lava(pos, new Vec(0, 3), pos)
        } else if (ch == '=') {
            return new Lava(pos, new Vec(2, 0));
        } else if (ch == '|') {
            return new Lava(pos, new Vec(0, 2));
        }
    }
}
Lava.prototype.size = new Vec(1, 1);

class Player {
    constructor(pos, speed) {
        this.pos = pos;
        this.speed = speed;
    }
    get type() {
        return 'player';
    }
    static create(pos) {
        return new Player(pos.plus(new Vec(0, -0.5)), new Vec(0, 0));
    }
}
Player.prototype.size = new Vec(0.8, 1.5)


class Coin {
    constructor(pos, basePos, wobble) {
        this.pos = pos;
        this.basePos = basePos;
        this.wobble = wobble;
    }
    get type() {
        return 'coin';
    }
    static create(pos) {
        let basePos = pos.plus(new Vec(0.2, 0.1));
        return new Coin(basePos, basePos, Math.random() * 2 * Math.PI);
    }
}

Coin.prototype.size = new Vec(0.6, 0.6);

const levelChar = {
    '=': Lava, '|': Lava, '@': Player,
    '.': 'empty', 'v': Lava, 'o': Coin, '+': 'lava',
    '#': 'wall'
}


//drawing

class DOmDisplay {
    constructor(level, parent) {
        this.dom = elt('div', { class: 'game' }, drawGrid(level));
        this.actorLayer = null;
        parent.appendChild(this.dom);
    }
    clear() {
        this.dom.remove();
    }
}

//HELPER FUNCTION

function elt(node, attributes, ...children) {
    let dom = document.createElement(node);
    for (let attr of Object.keys(attributes)) {
        dom.setAttribute(attr, attributes[attr]);
    }
    for (let child of children) {
        dom.appendChild(child);
    }
    return dom;
}

function drawGrid(level) {
    return elt('table', { style: `width: ${level.width * scale}px`, class: 'table' }, ...level.rows.map(row => {
        return elt('tr', { style: `height: ${scale}px` }, ...row.map(ele => elt('td', { class: ele })))
    }));
}

const scale = 20;

//drawing actors
function drawActors(actors) {
    return elt('div', {}, ...actors.map(actor => {
        let rect = elt('div', { class: `actor ${actor.type}` });
        rect.style.left = `${actor.pos.x * scale}px`;
        rect.style.top = `${actor.pos.y * scale}px`;
        rect.style.width = `${actor.size.x * scale}px`;
        rect.style.height = `${actor.size.y * scale}px`;
        return rect;
    }));
}

//syncstate method of the state class

DOmDisplay.prototype.syncState = function (state) {
    if (this.actorLayer) this.actorLayer.remove();
    this.actorLayer = drawActors(state.actors);
    this.dom.setAttribute('class', `game ${state.status}`);
    this.dom.appendChild(this.actorLayer);
    this.scrollPlayerIntoView(state);
}

//next day (5/08/23)

DOmDisplay.prototype.scrollPlayerIntoView = function (state) {
    let left = this.dom.scrollLeft;
    let width = this.dom.clientWidth;
    let height = this.dom.clientHeight;
    let right = left + width;
    let margin = width / 3;
    let center = state.player.pos.plus(state.player.size.times(0.5)).times(scale);
    let top = this.dom.scrollTop;
    let bottom = top + height;

    if (center.x < left + margin) {
        this.dom.scrollLeft = center.x - margin;
    } else if (center.x > right - margin) {
        this.dom.scrollLeft = center.x + margin - width;
    }
    if (center.y < top + margin) {
        this.dom.scrollTop = center.y - margin;
    } else if (center.y > bottom - margin) {
        this.dom.scrollTop = center.y + margin - height;
    }
}




//viewing the game in the body of the docuement to get some encouragement
//definitely had some handful of bugs before i could i coud get visual but generally
// i am happy with my progress so far (yuppy)


///motion and collision

//touches method for the level object
Level.prototype.touches = function (pos, size, type) {
    let xStart = Math.floor(pos.x);
    let xEnd = Math.ceil(pos.x + size.x);
    let yStart = Math.floor(pos.y);
    let yEnd = Math.ceil(pos.y + size.y)

    for (let y = yStart; y < yEnd; y++) {
        for (let x = xStart; x < xEnd; x++) {
            let outside = x < 0 || x >= this.width || y < 0 || y >= this.height;
            let here = outside ? 'wall' : this.rows[y][x];
            if (here == type) return true;
        }
    }
    return false;
}

//The State update method
//updates the the state based on the time step passed and the keys pressed

State.prototype.update = function (time, keys) {
    let actors = this.actors.map(actor => actor.update(time, this, keys));
    let newState = new State(this.level, actors, this.status)
    if (newState.status != 'playing') return newState;
    let player = newState.player;
    if (this.level.touches(player.pos, player.size, 'lava')) return new State(this.level, actors, 'lost');
    for (let actor of actors) {
        if (actor != player && overlap(player, actor)) newState = actor.collide(newState);
    }
    return newState;
}

function overlap(actor1, actor2) {
    return actor1.pos.plus(actor1.size).x > actor2.pos.x &&
        actor2.pos.plus(actor2.size).x > actor1.pos.x &&
        actor1.pos.plus(actor1.size).y > actor2.pos.y &&
        actor2.pos.plus(actor2.size).y > actor1.pos.y;
}

// specifically for lava actor unlike touches which worked for string lava character

Lava.prototype.collide = function (state) {
    return new State(state.level, state.actors, 'lost');
}

Coin.prototype.collide = function (state) {
    let actorsRemain = state.actors.filter(l => l != this);
    if (!actorsRemain.some(l => l.type == 'coin')) return new State(state.level, actorsRemain, 'won')
    return new State(state.level, actorsRemain, 'playing');
}

Lava.prototype.update = function (time, state) {
    let pos = this.pos.plus(this.speed.times(time));
    if (!state.level.touches(pos, this.size, 'wall')) return new Lava(pos, this.speed, this.reset);
    if (this.reset) return new Lava(this.reset, this.speed, this.reset);
    return new Lava(this.pos, this.speed.times(-1));
}

const wobbleSpeed = 8;
const wobbleDist = 0.07;

Coin.prototype.update = function (time) {
    let wobble = this.wobble + wobbleSpeed * time; //why did you add??? [i think i get now, the addition
    // specifires how much the position shoud increase by based on the previous position and since we are
    //  getting the sin of it, and multiplying it to the wobbleDist it makes a difference]
    let wobblePos = Math.sin(wobble) * wobbleDist;
    return new Coin(this.basePos.plus(new Vec(0, wobblePos)), this.basePos, wobble);
}

const playerXspeed = 7;
const jumpSpeed = 17;
const gravity = 30;

Player.prototype.update = function (time, state, keys) {
    let xSpeed = 0;
    if (keys.ArrowLeft) xSpeed -= playerXspeed;
    if (keys.ArrowRight) xSpeed += playerXspeed;
    let pos = this.pos;
    let movedX = pos.plus(new Vec(xSpeed * time, 0));
    if (!state.level.touches(movedX, this.size, 'wall')) pos = movedX;

    let ySpeed = this.speed.y + gravity * time;
    let movedY = pos.plus(new Vec(0, ySpeed * time));
    if (!state.level.touches(movedY, this.size, 'wall')) {
        pos = movedY;
    } else if (keys.ArrowUp && ySpeed > 0) {
        ySpeed = -jumpSpeed;
    } else {
        ySpeed = 0;
    }
    return new Player(pos, new Vec(xSpeed, ySpeed));
}


//track this i kinda did something differet!!!!!!!!
function trackKeys(keys) {
    let down = Object.create(null);
    function handler(event) {
        for (let key of keys) {
            if (key == event.key) {
                down[key] = event.type == 'keydown';
                event.preventDefault();
            }
        }
    }
    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', handler);
    return down;
}

const keys = trackKeys(['ArrowLeft', 'ArrowRight', 'ArrowUp']);


function runAnimation(frameFunc) {
    let lastTime = null;
    function frame(time) {
        if (lastTime != null) {
            let timeStep = Math.min(time - lastTime, 100) / 1000;
            if (frameFunc(timeStep) === false) return;
        }
        lastTime = time;
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

function runLevel(level, Display) {
    let display = new Display(level, document.body);
    let state = State.start(level);
    let ending = 1;
    return new Promise(resolve => {
        runAnimation(time => {
            state = state.update(time, keys);
            display.syncState(state);
            if (state.status == 'playing') {
                return true;
            } else if (ending > 0) {
                ending -= time;
                return true;
            } else {
                display.clear();
                resolve(state.status);
                return false;
            }
        });
    });
}

async function runGame(plans, Display) {
    for (let level = 0; level < plans.length;) {
        let status = await runLevel(new Level(plans[level]),
            Display);
        if (status == "won") level++;
    }

}