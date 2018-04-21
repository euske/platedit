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
let SPRITES:ImageSpriteSheet;
addInitHook(() => {
    FONT = new Font(APP.images['font'], 'white');
    SPRITES = new ImageSpriteSheet(
	APP.images['sprites'], new Vec2(8,8), new Vec2(4,4));
});


//  Player
//
class Player extends PlatformerEntity {

    usermove: Vec2;
    holding: boolean = false;

    constructor(scene: Game, pos: Vec2) {
	super(scene.tilemap, scene.physics, pos);
	this.skin = SPRITES.get(0);
	this.collider = this.skin.getBounds().inflate(-1,0);
	this.usermove = new Vec2();
    }

    tick() {
	super.tick();
	let v = this.usermove.scale(2);
	if (!this.holding) {
	    v = new Vec2(v.x, 0);
	} else if (!this.hasLadder()) {
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
	if (v.y != 0) {
	    this.holding = true;
	}
    }

    hasLadder() {
	return this.hasTile(this.physics.isGrabbable);
    }

    canFall() {
	return !(this.holding && this.hasLadder());
    }

    getObstaclesFor(range: Rect, v: Vec2, context: string): Rect[] {
	if (!this.holding) {
	    return this.tilemap.getTileRects(this.physics.isObstacle, range);
	}
	return super.getObstaclesFor(range, v, context);
    }

    getFencesFor(range: Rect, v: Vec2, context: string): Rect[] {
	return [this.world.area];
    }
}


//  TextMap
//
class TextMap extends TileMap {

    font: Font = FONT;

    putText(x: number, y: number, text: string) {
        for (let i = 0; i < text.length; i++) {
            let c = text.charCodeAt(i);
            this.set(x+i, y, c);
        }
    }

    renderText(ctx: CanvasRenderingContext2D) {
	for (let y = 0; y < this.height; y++) {
            let text = range(this.width).map((x) => {
                return String.fromCharCode(this.get(x,y));
            }).join('');
            this.font.renderString(ctx, text, 0, y*this.tilesize);
	}
    }
}


//  Game
//
class Game extends GameScene {

    player: Player;
    tilemap: TextMap;
    physics: PhysicsConfig;

    init() {
	super.init();
	this.physics = new PhysicsConfig();
	this.physics.jumpfunc = ((vy:number, t:number) => {
	    return (0 <= t && t <= 4)? -3 : vy+1;
	});
	this.physics.maxspeed = new Vec2(4, 4);
	this.physics.isObstacle =
            ((c:number) => { return 32 < c; });
	this.physics.isGrabbable =
            ((c:number) => { return c == 2; });
	this.physics.isStoppable =
            ((c:number) => { return c != 0 && c != 32; });
	this.tilemap = new TextMap(8, 40, 30);
        this.tilemap.set(0, 0, 1);
        this.tilemap.putText(0, 10, 'Hello, World!');
	let p = this.tilemap.findTile((c:number) => { return c == 1; });
	this.player = new Player(this, this.tilemap.map2coord(p).center());
	this.add(this.player);
    }

    tick() {
	super.tick();
    }

    onDirChanged(v: Vec2) {
	this.player.setMove(v);
    }
    onButtonPressed(keysym: KeySym) {
	this.player.setJump(Infinity);
    }
    onButtonReleased(keysym: KeySym) {
	this.player.setJump(0);
    }

    render(ctx: CanvasRenderingContext2D) {
	ctx.fillStyle = 'rgb(64,64,64)';
	fillRect(ctx, this.screen);
        this.tilemap.renderText(ctx);
	super.render(ctx);
    }
}
