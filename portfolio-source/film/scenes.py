"""Eight continuously animated shots using the portfolio's original materials."""
from functools import lru_cache
from pathlib import Path
import math

import moderngl
import numpy as np
from PIL import Image, ImageDraw


W, H = 1920, 1080
CUTS = (0, 2.2, 4.4, 9, 12.2, 14.4, 17, 20, 24)
TITLES = (
    '把想法做成作品',
    '萌芽保卫队 · 实际游戏录屏',
    '面包挑战 · 从规则到现场',
    '电商教学 · 累计服务约 1,000 名学员',
    '宿舍打印店 · 黑白打印 0.2 元，1 份起送',
    '直播内容与互动 · 2026 家乡荣耀季，青山湖区区县100强',
    '马嘉程 · 产品与运营',
    '马嘉程 · 继续看我的作品',
)
CHAPTERS = (
    (CUTS[0], '开场'),
    (CUTS[1], '游戏'),
    (CUTS[2], '活动'),
    (CUTS[3], '运营'),
    (CUTS[6], '关于我'),
)
WHITE = (.94, .97, 1.)
ICE = (.70, .85, 1.)
BLUE = (.20, .57, .98)
VIOLET = (.61, .41, .96)

SCREEN_VERTEX = '''
#version 330
in vec2 corner;
out vec2 uv;
void main() {
    uv = corner * .5 + .5;
    gl_Position = vec4(corner, 0.0, 1.0);
}
'''
UPSCALE = '''
#version 330
uniform sampler2D image;
in vec2 uv;
out vec4 color;
void main() { color = texture(image, uv); }
'''
LABEL_VERTEX = '''
#version 330
in vec2 corner;
uniform vec2 topLeft;
uniform vec2 size;
out vec2 uv;
void main() {
    uv = vec2(corner.x, -corner.y) * .5 + .5;
    vec2 p = (topLeft + uv * size) / vec2(1920, 1080);
    gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
}
'''
LABEL_FRAGMENT = '''
#version 330
uniform sampler2D image;
uniform vec3 ink;
uniform float opacity;
in vec2 uv;
out vec4 color;
void main() { color = vec4(ink, texture(image, uv).r * opacity); }
'''
PANEL_VERTEX = '''
#version 330
in vec2 corner;
uniform vec2 center;
uniform vec2 halfSize;
uniform vec3 turn;
out vec2 point;
void main() {
    point = corner * (halfSize + 53.0);
    vec3 p = vec3(point, 0.0);
    p.xz = mat2(cos(turn.x), sin(turn.x), -sin(turn.x), cos(turn.x)) * p.xz;
    p.yz = mat2(cos(turn.y), sin(turn.y), -sin(turn.y), cos(turn.y)) * p.yz;
    p.xy = mat2(cos(turn.z), sin(turn.z), -sin(turn.z), cos(turn.z)) * p.xy;
    vec2 screen = vec2(1920, 1080);
    vec2 anchor = vec2(center.x, screen.y - center.y) / screen * 2.0 - 1.0;
    float perspective = 1.0 + p.z / 2400.0;
    gl_Position = vec4(anchor * perspective + p.xy * 2.0 / screen, 0.0, perspective);
}
'''
PANEL_FRAGMENT = '''
#version 330
uniform sampler2D image;
uniform vec2 halfSize;
uniform vec3 accent;
uniform float radius;
uniform float clock;
uniform float opacity;
in vec2 point;
out vec4 color;

float rounded(vec2 p, vec2 extent, float corner) {
    vec2 q = abs(p) - extent + corner;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - corner;
}

void main() {
    float edge = rounded(point, halfSize, radius);
    float shadowDistance = rounded(point + vec2(0, 16), halfSize, radius);
    float shadow = .69 * exp(-max(0.0, shadowDistance) / 16.0) * (1.0 - smoothstep(34.0, 49.0, edge));
    if (edge > 1.0) {
        color = vec4(.015, .03, .08, shadow * opacity);
        return;
    }
    vec2 screen = point / halfSize;
    float lightPosition = (screen.x + .74 * screen.y - .55 * sin(clock * .9)) * 2.8;
    float gleam = exp(-lightPosition * lightPosition);
    float rim = exp(-abs(edge) / 5.0);
    vec3 glass = mix(vec3(.065, .13, .23), accent * .68, .23 + .22 * screen.y)
        + vec3(.81, .92, 1.0) * rim * (.28 + .30 * gleam + .17 * screen.y)
        + gleam * accent * .26;
    vec2 content = halfSize - 12.0;
    float inside = 1.0 - smoothstep(-1.0, 1.0, rounded(point, content, max(4.0, radius - 10.0)));
    vec2 uv = vec2(point.x, -point.y) / content * .5 + .5;
    vec3 art = texture(image, uv).rgb;
    color = vec4(mix(glass, art, inside), (1.0 - .25 * smoothstep(-1.0, 1.0, edge)) * opacity);
}
'''


def ease(x):
    x = max(0., min(1., x))
    return x * x * (3. - 2. * x)


def print_artwork():
    page = Image.new('RGB', (510, 650), (229, 243, 255))
    draw = ImageDraw.Draw(page)
    for y in range(page.height):
        tint = round(16 * y / page.height)
        draw.line((0, y, page.width, y), fill=(242 - tint, 250 - tint // 2, 255))
    draw.rounded_rectangle((57, 73, 165, 89), radius=8, fill=(48, 113, 182))
    draw.rounded_rectangle((57, 135, 436, 318), radius=20, fill=(205, 226, 246))
    draw.polygon([(75, 291), (168, 216), (235, 266), (329, 170), (421, 291)], fill=(149, 193, 232))
    for y, width in ((374, 376), (410, 335), (446, 365), (482, 264), (552, 193)):
        draw.rounded_rectangle((57, y, 57 + width, y + 9), radius=4, fill=(147, 180, 215))
    return page


def create_scenes(ctx):
    gl = moderngl.create_standalone_context(backend='egl')
    site, font, gameframe = (ctx[key] for key in ('SITE', 'font', 'gameframe'))
    frame_buffer = gl.simple_framebuffer((W, H), components=3)
    # The soft optical field is sampled separately from the full-resolution type and evidence.
    optical_size = (960, 540)
    optical_texture = gl.texture(optical_size, 3)
    optical_texture.filter = (moderngl.LINEAR, moderngl.LINEAR)
    optical_buffer = gl.framebuffer(color_attachments=[optical_texture])
    vertices = gl.buffer(np.array([[-1, -1], [1, -1], [-1, 1], [1, 1]], dtype='f4').tobytes())

    def layer(fragment, vertex=SCREEN_VERTEX):
        program = gl.program(vertex_shader=vertex, fragment_shader=fragment)
        return program, gl.simple_vertex_array(program, vertices, 'corner')

    optic, optic_quad = layer(Path(__file__).with_name('glass.glsl').read_text())
    optic['resolution'] = optical_size
    _, optical_blit = layer(UPSCALE)
    type_program, type_quad = layer(LABEL_FRAGMENT, LABEL_VERTEX)
    panel_program, panel_quad = layer(PANEL_FRAGMENT, PANEL_VERTEX)

    def texture(im):
        return gl.texture(im.size, 3, im.convert('RGB').tobytes())

    def load(relative, size, crop=None):
        with Image.open(site / relative) as source:
            im = (source.crop(crop) if crop else source).convert('RGB')
        im.thumbnail(size, Image.Resampling.LANCZOS)
        return texture(im), im.width / im.height

    poster = load('poster/poster.png', (640, 900))
    honor = load('honor/live-honor-2026.jpeg', (1070, 680), crop=(0, 690, 1080, 1180))
    portrait = load(next(site.glob('assets/portrait-white-960*.webp')).relative_to(site), (660, 660))
    print_card = texture(print_artwork()), 510 / 650
    game_texture = gl.texture((1280, 720), 3)
    game_index = None

    @lru_cache(maxsize=48)
    def lettering(text, size):
        face = font(size, True)
        x, y, right, bottom = face.getbbox(text)
        image = Image.new('L', (right - x + 4, bottom - y + 4))
        ImageDraw.Draw(image).text((2 - x, 2 - y), text, font=face, fill=255)
        return gl.texture(image.size, 1, image.tobytes()), image.size

    def label(text, size, x, y, ink=WHITE, opacity=1.):
        im, dimensions = lettering(text, size)
        im.use()
        type_program['size'] = dimensions
        type_program['topLeft'] = (x, y)
        type_program['ink'] = ink
        type_program['opacity'] = opacity
        type_quad.render(moderngl.TRIANGLE_STRIP)

    def panel(art, x, y, width, clock, accent=BLUE, turn=(0., 0., 0.), radius=42, opacity=1.):
        im, aspect = art
        im.repeat_x = im.repeat_y = False
        im.use()
        panel_program['halfSize'] = (width / 2 + 12, width / aspect / 2 + 12)
        panel_program['center'] = (x, y)
        panel_program['turn'] = turn
        panel_program['accent'] = accent
        panel_program['radius'] = radius
        panel_program['clock'] = clock
        panel_program['opacity'] = opacity
        panel_quad.render(moderngl.TRIANGLE_STRIP)

    def field(t, center, primary, secondary, lens, tilt):
        cut = min(CUTS[1:-1], key=lambda mark: abs(t - mark))
        sweep = max(0., min(1., (t - cut + .20) / .40))
        gl.disable(moderngl.BLEND)
        optical_buffer.use()
        optic['clock'] = t
        optic['center'] = center
        optic['accent'] = primary
        optic['secondary'] = secondary
        optic['lensSize'] = lens
        optic['tilt'] = tilt
        optic['sweep'] = sweep
        optic_quad.render(moderngl.TRIANGLE_STRIP)
        frame_buffer.use()
        optical_texture.use()
        optical_blit.render(moderngl.TRIANGLE_STRIP)
        gl.enable(moderngl.BLEND)
        gl.blend_func = moderngl.SRC_ALPHA, moderngl.ONE_MINUS_SRC_ALPHA

    def frame(t):
        nonlocal game_index
        t = max(0., min(CUTS[-1] - .00001, float(t)))
        shot = next(i for i, end in enumerate(CUTS[1:]) if t < end)
        u = t - CUTS[shot]
        k = ease(u / (CUTS[shot + 1] - CUTS[shot]))
        settle = ease(u / .46)
        drift = 22 * (1 - settle)

        if shot == 0:
            field(t, (.43 - .03 * k, .07), BLUE, VIOLET, .86 - .06 * k, -.28)
            label('马嘉程', 51, 147, 266 + drift, ICE)
            label('把想法', 120, 136, 359 + drift)
            label('做成作品', 120, 136, 497 + drift)
        elif shot == 1:
            field(t, (.58, -.04), (.19, .64, .82), BLUE, .78, -.70)
            index = int((5.5 + u) * 30)
            if index != game_index:
                game_texture.write(gameframe(index).tobytes())
                game_index = index
            panel((game_texture, 16 / 9), 1264 - 22 * k + 2 * drift, 526 + drift, 1060 + 23 * k - 3 * drift, u,
                  turn=(-.13 + .10 * k - .10 * (1 - settle), -.05, .03 - .02 * k))
            label('萌芽保卫队', 82, 140, 414 + drift)
            label('实际游戏录屏', 48, 147, 544 + drift, ICE)
        elif shot == 2:
            warm = (1., .55, .25)
            field(t, (.59, .05), (.28, .43, .93), warm, .90, .43)
            panel(poster, 1394 - 43 * k + drift, 518 + drift, 448 + 21 * k, u, accent=warm,
                  turn=(-.27 + .30 * k - .16 * (1 - settle), -.025, -.075 + .092 * k), radius=34)
            label('面包挑战', 101, 138, 386 + drift)
            label('从规则到现场', 58, 147, 538 + drift, ICE)
        elif shot == 3:
            teal = (.20, .81, .83)
            field(t, (.52 - .035 * k, .045), teal, (.26, .41, 1.), .76 + .06 * k, .62)
            label('电商教学', 57, 146, 301 + drift, ICE)
            label('约', 68, 146, 444 + drift)
            label('1,000', 203, 235, 376 + drift)
            label('累计服务学员', 61, 147, 618 + drift, ICE)
        elif shot == 4:
            field(t, (.54, .11), BLUE, (.46, .62, 1.), .82, -.27)
            fan = ease(u / .78)
            panel(print_card, 1308 + 125 * fan, 566 - 83 * fan, 394, u, turn=(.14, -.11, -.22 * fan), opacity=.66)
            panel(print_card, 1308 + 72 * fan, 566 - 36 * fan, 409, u, turn=(.08, -.07, -.09 * fan), opacity=.91)
            panel(print_card, 1308, 566 + drift, 418, u, turn=(-.10 + .07 * k, -.04, .04 + .03 * k))
            label('宿舍打印店', 62, 147, 302 + drift, ICE)
            label('0.2', 198, 138, 410 + drift)
            label('元', 63, 459, 502 + drift)
            label('黑白打印 · 1 份起送', 49, 149, 641 + drift, ICE)
        elif shot == 5:
            field(t, (.51, .02), (.28, .63, .99), (.50, .77, .61), .84, -.61)
            panel(honor, 1318 - 32 * k, 523 + drift, 916 + 16 * k, u,
                  turn=(-.17 + .18 * k, .03, .04 - .035 * k))
            label('直播内容与互动', 72, 140, 376 + drift)
            label('2026 家乡荣耀季', 49, 147, 497 + drift, ICE)
            label('青山湖区区县100强', 42, 147, 570 + drift, ICE)
        elif shot == 6:
            field(t, (.49 - .025 * k, .05), BLUE, VIOLET, .91, .42)
            panel(portrait, 1347 - 21 * k, 526 + drift, 514 + 20 * k, u,
                  turn=(-.17 + .17 * k, .025, .043 - .04 * k), radius=59)
            label('马嘉程', 132, 136, 365 + drift)
            label('产品与运营', 67, 147, 542 + drift, ICE)
        else:
            field(t, (.43 + .04 * k, .05), BLUE, VIOLET, .91 - .09 * k, -.40)
            label('马嘉程', 132, 136, 355 + drift)
            label('majiacheng619-collab.github.io', 47, 145, 560 + drift, ICE)

        return Image.frombytes('RGB', (W, H), frame_buffer.read(components=3, alignment=1)).transpose(
            Image.Transpose.FLIP_TOP_BOTTOM)

    return frame
