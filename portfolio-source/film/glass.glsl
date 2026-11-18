#version 330

uniform float clock;
uniform float tilt;
uniform vec2 resolution;
uniform vec2 center;
uniform vec3 accent;
uniform vec3 secondary;
uniform float lensSize;
uniform float sweep;
out vec4 color;

vec2 rotate(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c) * p;
}

float glow(vec2 p, vec2 spread) {
    vec2 q = p / spread;
    return exp(-dot(q, q));
}

vec3 environment(vec2 p) {
    vec2 q = rotate(p - vec2(.39, .04), -.49);
    float beam = exp(-abs(q.y + .07 * sin(q.x * 5.0)) * 28.0);
    return vec3(.013, .026, .064)
        + accent * (.19 * glow(p - vec2(.47, .24), vec2(.73, .48)) + .095 * beam)
        + secondary * .18 * glow(p - vec2(.50, -.37), vec2(.53, .37))
        + vec3(.086, .16, .24) * glow(p - vec2(-.21, -.44), vec2(1.0, .23));
}

vec3 refractLight(vec2 p, vec3 outside, vec2 direction, float depth, float angle) {
    float front = sqrt(max(0.0, 1.0 - depth * depth));
    vec2 normal = direction * depth;
    vec2 bent = p - normal * (.075 + .16 * (1.0 - front));
    vec3 transmitted = environment(bent);
    float reflected = pow(1.0 - front, 2.2);
    float strip = abs(dot(normal, normalize(vec2(-.59, .81))) - .63);
    float secondStrip = abs(dot(normal, normalize(vec2(.68, -.72))) - .76);
    float silver = exp(-strip * 37.0) * (.22 + .97 * pow(.5 + .5 * sin(angle * 1.9 + clock * .41), 2.5));
    float lilac = exp(-secondStrip * 28.0) * (.17 + .42 * pow(.5 + .5 * cos(angle * 2.0 - clock * .29), 2.0));
    float internal = exp(-abs(depth + .46) * 11.0) * (.07 + .32 * max(0.0, sin(angle + .8)));
    return mix(outside, transmitted + accent * .13, .78)
        + vec3(.69, .87, 1.0) * silver + secondary * lilac
        + mix(accent, vec3(.77, .9, 1.0), .42) * (.73 * reflected + internal);
}

vec3 droplet(vec3 outside, vec2 p, vec2 position, vec2 size, float angle) {
    vec2 q = rotate(p - position, angle) / size;
    float r = length(q);
    if (r >= 1.04) return outside;
    vec2 normal = rotate(q / max(r, .001), -angle);
    vec3 glass = refractLight(p, outside, normal, clamp(r, 0.0, 1.0), atan(q.y, q.x));
    return mix(outside, glass, 1.0 - smoothstep(.97, 1.04, r));
}

void main() {
    vec2 p = (gl_FragCoord.xy / resolution - .5) * vec2(16.0 / 9.0, 1.0);
    vec3 result = environment(p);
    vec2 q = rotate(p - center, tilt + .10 * sin(clock * .91)) / lensSize;
    q.y *= 1.19 + .13 * sin(clock * .55);
    float r = length(q);
    if (r > .20 && r < .65) {
        float phi = atan(q.y, q.x);
        float flow = clock * .78;
        float orbit = .388 + .066 * cos(2.0 * phi + flow)
            + .043 * sin(3.0 * phi - .7 * flow) + .023 * cos(phi + 1.4);
        float width = .076 + .026 * sin(phi + flow + .5) + .020 * cos(3.0 * phi - flow);
        float depth = (r - orbit) / width;
        if (abs(depth) < 1.07) {
            vec2 tangent = normalize(vec2(-q.y, q.x));
            vec2 direction = normalize(q / r + tangent * (.24 * sin(2.0 * phi + flow) + .16 * cos(3.0 * phi - flow)));
            direction = rotate(direction, -tilt);
            result = mix(result, refractLight(p, result, direction, clamp(depth, -1.0, 1.0), phi),
                1.0 - smoothstep(.96, 1.07, abs(depth)));
        }
    }
    result = droplet(result, p, center + lensSize * vec2(.29 + .06 * sin(clock * 1.1), .27 + .034 * cos(clock * 1.3)),
        lensSize * vec2(.060, .073), -.42);
    result = droplet(result, p, center + lensSize * vec2(-.36 + .05 * cos(clock * .8), -.25 + .03 * sin(clock * 1.4)),
        lensSize * vec2(.036, .044), .73);
    result = droplet(result, p, center + lensSize * vec2(.19 + .04 * cos(clock * 1.5), -.36 + .04 * sin(clock * .97)),
        lensSize * vec2(.021, .025), .21);
    float crossing = p.x + p.y * .61 - mix(-1.05, 1.22, sweep);
    result += accent * .14 * sin(3.14159 * sweep) * exp(-abs(crossing) * 10.0);
    color = vec4(result, 1.0);
}
