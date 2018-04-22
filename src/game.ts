/// <reference path="../base/utils.ts" />
/// <reference path="../base/geom.ts" />
/// <reference path="../base/entity.ts" />
/// <reference path="../base/text.ts" />
/// <reference path="../base/scene.ts" />
/// <reference path="../base/app.ts" />

///  game.ts
///


//  Initialize the resources.
let FONT: Font;
let FONT2: Font;
let FONT3: Font;
let SPRITES:ImageSpriteSheet;
let TILES:ImageSpriteSheet;
addInitHook(() => {
    FONT = new Font(APP.images['font'], 'white');
    FONT2 = new Font(APP.images['font'], '#0cf');
    FONT3 = new Font(APP.images['font'], '#fc0');
    SPRITES = new ImageSpriteSheet(
	APP.images['sprites'], new Vec2(8,8), new Vec2(4,4));
    TILES = new ImageSpriteSheet(
	APP.images['sprites'], new Vec2(8,8), new Vec2(0,0));
});


class PoissonTimer {

    prob: number;
    fired: number = 0;

    constructor(prob: number) {
        this.prob = prob;
    }

    tick(): boolean {
        let t = getTime();
        if (this.fired == 0) {
            this.fired = t;
        } else {
            let dt = t-this.fired;
            let p = (1.0-this.prob)**dt;
            if (p < Math.random()) {
                this.fired = t;
                return true;
            }
        }
        return false;
    }
}

//  TextMap
//
class TextMap extends TileMap {

    putText(x: number, y: number, text: string) {
        for (let i = 0; i < text.length; i++) {
            let c = text.charCodeAt(i);
            this.set(x+i, y, c);
        }
    }

    getLine(y: number) {
        return range(this.width).map((x) => {
            return String.fromCharCode(this.get(x,y));
        }).join('');
    }

    getText() {
        return range(this.height).map((y) => {
            return this.getLine(y);
        });
    }

    renderText(ctx: CanvasRenderingContext2D) {
	for (let y = 0; y < this.height; y++) {
	    for (let x = 0; x < this.width; x++) {
                let c = this.get(x, y);
                if (32 < c) {
                    let text = String.fromCharCode(c);
                    FONT.renderString(ctx, text, x*10+1, y*10+1);
                }
            }
	}
    }
}


//  CharSprite
//
class CharSprite extends EntitySprite {

    font: Font;
    text: string;

    constructor(entity: Entity, c: number) {
	super(entity);
        this.font = FONT2;
	this.text = String.fromCharCode(c);
    }

    renderImage(ctx: CanvasRenderingContext2D) {
        this.font.renderString(ctx, this.text, -4, -4);
    }
}


//  CharEntity
//
class CharEntity extends Entity {

    c: number;

    constructor(pos: Vec2, c: number) {
	super(pos);
        this.c = c;
	this.collider = new Rect(-4, -4, 8, 8);
	this.sprite = new CharSprite(this, c);
    }

    tick() {
	super.tick();
	this.moveIfPossible(new Vec2(0, 1));
        if (!this.getCollider().overlaps(this.world.area)) {
            this.stop();
        }
    }
}


//  CharParticle
//
class CharParticle extends Entity {

    constructor(pos: Vec2, c: number) {
	super(pos);
        log(pos);
        let sprite = new CharSprite(this, c);
        sprite.font = FONT3;
	this.sprite = sprite;
    }

    tick() {
	super.tick();
        if (1 < this.getTime()) {
            this.stop();
        }
    }
}


//  Monster
//
class Monster extends PlatformerEntity {

    movement: Vec2;
    carried = false;
    timer = new PoissonTimer(0.1);

    constructor(scene: Game, pos: Vec2, skin: ImageSource) {
	super(scene.textmap, scene.physics, pos);
	this.skin = skin;
	this.collider = this.skin.getBounds();
        this.movement = new Vec2(rnd(2)*2-1, 1);
    }

    tick() {
	super.tick();
        if (!this.carried) {
            if (this.timer.tick()) {
                this.movement.x = -this.movement.x;
            }
            this.sprite.scale.x = sign(this.movement.x);
	    this.moveIfPossible(this.movement);
            if (!this.getCollider().overlaps(this.world.area)) {
                this.stop();
            }
            if (5 < this.getTime()) {
                this.stop();
            }
        }
    }

    canFall() {
        return (!this.carried && super.canFall());
    }

    getObstaclesFor(range: Rect, v: Vec2, context: string): Rect[] {
        let rects = super.getObstaclesFor(range, v, context);
        rects.push(this.world.area.move(0, this.world.area.height));
        return rects;
    }
}

// Chicken
class Chicken extends Monster {
    constructor(scene: Game, pos: Vec2) {
        super(scene, pos, SPRITES.get(2));
    }
}

// Snake
class Snake extends Monster {
    constructor(scene: Game, pos: Vec2) {
        super(scene, pos, SPRITES.get(3));
    }
}


//  Flying
//
class Flying extends Projectile {

    constructor(pos: Vec2, movement: Vec2, skin: ImageSource) {
	super(pos);
        this.movement = movement.scale(2);
	this.skin = skin;
	this.collider = this.skin.getBounds();
    }

    tick() {
	super.tick();
        this.sprite.scale.x = sign(this.movement.x);
    }
}

// Hero
class Hero extends Flying {
    constructor(pos: Vec2, movement: Vec2) {
	super(pos, movement, SPRITES.get(4));
    }
}

// Fire
class Fire extends Flying {
    constructor(pos: Vec2, movement: Vec2) {
	super(pos, movement, SPRITES.get(5));
    }
}


//  Player
//
class Player extends PlatformerEntity {

    laddermap: TileMap;
    usermove: Vec2;
    carrying: Entity = null;

    constructor(scene: Game, pos: Vec2) {
	super(scene.textmap, scene.physics, pos);
        this.laddermap = scene.laddermap;
	this.skin = SPRITES.get(1);
	this.collider = this.skin.getBounds().inflate(-1,0);
	this.usermove = new Vec2();
    }

    setJump(jumpend: number) {
	super.setJump(jumpend);
	if (0 < jumpend && this.isJumping()) {
	    APP.playSound('jump');
	}
    }

    setMove(v: Vec2) {
	this.usermove = v.copy();
    }

    hasLadder() {
        let f = this.physics.isGrabbable;
	let range = this.getCollider().getAABB();
	return (this.laddermap.findTileByCoord(f, range) !== null);
    }

    canFall() {
	return !this.hasLadder();
    }

    getFencesFor(range: Rect, v: Vec2, context: string): Rect[] {
	return [this.world.area];
    }

    renderExtra(ctx: CanvasRenderingContext2D) {
        if (this.carrying instanceof CharEntity) {
            let text = String.fromCharCode(this.carrying.c);
            FONT3.renderString(ctx, text, -4, -12);
        }
    }

    tick() {
	super.tick();
	let v = this.usermove.scale(2);
        if (!this.hasLadder()) {
	    v = new Vec2(v.x, lowerbound(0, v.y));
	}
	this.moveIfPossible(v);
        if (this.carrying instanceof Monster) {
            this.carrying.pos = this.pos.move(0, -8);
        }
    }

    collidedWith(entity: Entity) {
        if (entity instanceof CharEntity) {
            entity.stop();
            this.carry(entity);
        } else if (entity instanceof Monster) {
            if (!entity.carried) {
                entity.carried = true;
                this.carry(entity);
            }
        } else if (entity instanceof Flying) {
            entity.stop();
            APP.playSound('hurt');
        }
    }

    carry(entity: Entity) {
        if (this.carrying !== null) {
            this.carrying.stop();
        }
        this.carrying = entity;
	APP.playSound('pick');
    }

    place() {
        if (this.carrying instanceof CharEntity) {
            let c = this.carrying.c;
            let collider = this.getCollider();
            let pos = this.tilemap.coord2map(this.pos);
            let rect: Rect;
            while (true) {
                rect = this.tilemap.map2coord(pos);
                if (!rect.overlaps(collider)) break;
                pos.y += 1;
            }
            this.tilemap.set(pos.x, pos.y, c);
            let particle = new CharParticle(rect.center(), c);
            this.world.add(particle);
        }
        if (this.carrying instanceof Entity) {
            this.carrying.stop();
            this.carrying = null;
	    APP.playSound('place');
        }
    }
}


//  Game
//
class Game extends GameScene {

    player: Player;
    textmap: TextMap;
    laddermap: TileMap;
    physics: PhysicsConfig;
    timer1 = new PoissonTimer(0.1);
    timer2 = new PoissonTimer(0.05);
    timer3 = new PoissonTimer(0.01);

    init() {
	super.init();

	this.physics = new PhysicsConfig();
	this.physics.jumpfunc = ((vy:number, t:number) => {
	    return (0 <= t && t <= 5)? -3 : vy+1;
	});
	this.physics.maxspeed = new Vec2(4, 4);
	this.physics.isObstacle =
            ((c:number) => { return 32 < c; });
	this.physics.isGrabbable =
            ((c:number) => { return c == 1; });
	this.physics.isStoppable =
            ((c:number) => { return c != 0 && c != 32; });

	this.textmap = new TextMap(10, 32, 24);
        this.textmap.putText(0, 10, 'function main() {');
        this.textmap.putText(0, 11, '  print("Hello, world!");');
        this.textmap.putText(0, 12, '}');

	this.laddermap = new TileMap(8, 40, 30);
        for (let y = 0; y < 30; y++) {
            for (let x = 0; x < 40; x++) {
                if ((x % 5 == 2) && (((y+x) % 10) <= 5)) {
                    this.laddermap.set(x, y, 1);
                }
            }
        }

	let pos = new Vec2(this.world.area.cx(), 8);
	this.player = new Player(this, pos);
	this.add(this.player);

	//APP.setMusic('music', 0, 16.1);
    }

    tick() {
	super.tick();

        if (this.timer1.tick()) {
            let c = rnd(33, 127);
            let x = rnd(8, this.world.area.width-16);
            let pos = new Vec2(x, 0);
            let entity = new CharEntity(pos, c);
            this.add(entity);
        }

        if (this.timer2.tick()) {
            let x = rnd(8, this.world.area.width-16);
            let pos = new Vec2(x, 0);
            switch (rnd(2)) {
            case 0:
                this.add(new Chicken(this, pos));
                break;
            case 1:
                this.add(new Snake(this, pos));
                break;
            }
        }

        if (this.timer3.tick()) {
            let vx = rnd(2)*2-1;
            let x = (0 < vx)? 0 : this.world.area.width;
            let pos = new Vec2(x, this.player.pos.y);
            let dir = new Vec2(vx, 0);
            switch (rnd(2)) {
            case 0:
                this.add(new Hero(pos, dir));
                break;
            case 1:
                this.add(new Fire(pos, dir));
                break;
            }
        }
    }

    onDirChanged(v: Vec2) {
	this.player.setMove(v);
    }
    onButtonPressed(keysym: KeySym) {
        switch (keysym) {
        case KeySym.Action1:
	    this.player.setJump(Infinity);
            break;
        case KeySym.Action2:
            this.player.place();
            break;
        }
    }
    onButtonReleased(keysym: KeySym) {
        switch (keysym) {
        case KeySym.Action1:
	    this.player.setJump(0);
            break;
        }
    }

    render(ctx: CanvasRenderingContext2D) {
	ctx.fillStyle = 'rgb(64,64,128)';
	fillRect(ctx, this.screen);
        this.laddermap.renderFromTopRight(
            ctx, (x,y,c) => { return (c == 1)? TILES.get(0) : null; }
        );
        this.textmap.renderText(ctx);
	super.render(ctx);
    }
}
