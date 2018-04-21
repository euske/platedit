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
        if (1 <= this.getTime()) {
            this.stop();
        }
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


//  Player
//
class Player extends PlatformerEntity {

    laddermap: TileMap;
    usermove: Vec2;
    carrying: number = 0;

    constructor(scene: Game, pos: Vec2) {
	super(scene.textmap, scene.physics, pos);
        this.laddermap = scene.laddermap;
	this.skin = SPRITES.get(1);
	this.collider = this.skin.getBounds().inflate(-1,0);
	this.usermove = new Vec2();
    }

    tick() {
	super.tick();
	let v = this.usermove.scale(2);
        if (!this.hasLadder()) {
	    v = new Vec2(v.x, lowerbound(0, v.y));
	}
	this.moveIfPossible(v);
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

    collidedWith(entity: Entity) {
        if (entity instanceof CharEntity) {
            entity.stop();
            this.carrying = entity.c;
	    APP.playSound('pick');
        }
    }

    renderExtra(ctx: CanvasRenderingContext2D) {
        if (this.carrying != 0) {
            let text = String.fromCharCode(this.carrying);
            FONT3.renderString(ctx, text, -4, -12);
        }
    }

    place() {
        if (this.carrying != 0) {
            let rect = this.tilemap.coord2map(this.pos).move(0,1);
            this.tilemap.set(rect.x, rect.y, this.carrying);
	    APP.playSound('place');
            let p = this.tilemap.map2coord(rect);
            let particle = new CharParticle(p.center(), this.carrying);
            this.world.add(particle);
            this.carrying = 0;
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

	let p = new Vec2(0,0);
	this.player = new Player(this, this.textmap.map2coord(p).center());
	this.add(this.player);

	APP.setMusic('music', 0, 16.1);
    }

    tick() {
	super.tick();

        if (rnd(10) == 0) {
            let fc = FONT.width;
            let c = rnd(33, 127);
            let x = rnd(fc, this.world.area.width-fc*2);
            let pos = new Vec2(x, 0);
            let entity = new CharEntity(pos, c);
            this.add(entity);
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
