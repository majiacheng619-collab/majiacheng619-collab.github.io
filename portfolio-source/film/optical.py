"""Deterministic studio glass, rendered with real two-surface ray refraction.

Requires moderngl/glcontext and a Mesa EGL implementation; no display or GPU
is required. ``frame`` returns an RGB PIL image at the requested native size.
``offset`` is a screen-space displacement in units of the image height, with
positive x moving the sculpture right and positive y moving it down.
Content, when supplied, is a PIL image on a plane behind the glass. It is not
an overlay: the incoming ray is refracted twice before sampling that plane.
"""
import os

os.environ.setdefault("LIBGL_ALWAYS_SOFTWARE", "1")
os.environ.setdefault("EGL_PLATFORM", "surfaceless")

import numpy as np
from PIL import Image
import moderngl


VERTEX = """#version 330
in vec2 in_pos;
void main() { gl_Position = vec4(in_pos, 0.0, 1.0); }
"""

FRAGMENT = """#version 330
uniform vec2 resolution;
uniform float time;
uniform float distance;
uniform float angle;
uniform int mode;
uniform vec2 offset;
uniform sampler2D content_texture;
uniform bool has_content;
out vec4 fragColor;

mat3 ry(float a) { float c=cos(a),s=sin(a); return mat3(c,0,-s, 0,1,0, s,0,c); }
mat3 rx(float a) { float c=cos(a),s=sin(a); return mat3(1,0,0, 0,c,s, 0,-s,c); }
mat3 rz(float a) { float c=cos(a),s=sin(a); return mat3(c,s,0, -s,c,0, 0,0,1); }

float sdf(vec3 p) {
    p = rz(-0.13)*ry(angle)*rx(0.12)*p;
    // A broad, extremely shallow bend keeps the plane optically alive.
    p.z += 0.085*cos(p.x*1.2)*cos(p.y*1.8 + 0.035*sin(time*0.18));
    vec3 q=abs(p)-vec3(1.9,1.18,0.13);
    return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0)-0.23;
}

vec3 normalAt(vec3 p) {
    const float e=0.001;
    return normalize(vec3(sdf(p+vec3(e,0,0))-sdf(p-vec3(e,0,0)),
                          sdf(p+vec3(0,e,0))-sdf(p-vec3(0,e,0)),
                          sdf(p+vec3(0,0,e))-sdf(p-vec3(0,0,e))));
}

vec3 studio(vec3 rd) {
    // Neutral photographic softboxes; no coloured emissive shapes.
    vec3 col=vec3(0.035,0.037,0.043);
    col += vec3(0.11)*pow(max(rd.y,0.0),2.0);
    float left=exp(-pow(abs((rd.x+0.60)/0.085),2.0)-pow(abs((rd.y-0.30)/0.70),8.0));
    float top=exp(-pow(abs((rd.y-0.72)/0.026),2.0)-pow(abs(rd.x/0.88),8.0));
    float right=exp(-pow(abs((rd.x-0.80)/0.035),2.0)-pow(abs((rd.y-0.07)/0.73),8.0));
    col += vec3(0.99,0.985,0.97)*left*3.2;
    col += vec3(0.985,0.99,1.0)*top*4.5;
    col += vec3(1.0)*right*1.7;
    return col;
}

vec3 backdrop(vec3 ro,vec3 rd) {
    float z=(-3.0-ro.z)/rd.z;
    vec3 p=ro+rd*max(z,0.0);
    vec2 uv=p.xy/vec2(10.0,5.625)+0.5;
    if(has_content && z>0.0 && all(greaterThanEqual(uv,vec2(0))) && all(lessThanEqual(uv,vec2(1))))
        return pow(texture(content_texture,uv).rgb,vec3(2.2));
    // Very broad light falloff gives depth without an obvious colour halo.
    float broad=exp(-dot((p.xy-vec2(-1.0,0.8))*vec2(0.20,0.28),
                         (p.xy-vec2(-1.0,0.8))*vec2(0.20,0.28)));
    vec3 c=vec3(0.0033,0.0035,0.0041)+broad*vec3(0.0090,0.0093,0.0100);
    if(mode==0) {
        float card=(1.0-smoothstep(1.72,1.77,abs(p.x+0.65))) *
                   (1.0-smoothstep(1.95,2.0,abs(p.y)));
        c=mix(c,vec3(0.62),card);
    }
    return c;
}

vec3 trace(vec2 pixel) {
    vec2 q=(2.0*pixel-resolution)/resolution.y;
    q-=2.0*vec2(offset.x,-offset.y);
    vec3 ro=vec3(0.12,0.1,distance);
    vec3 fw=normalize(-ro),rt=normalize(cross(fw,vec3(0,1,0))),up=cross(rt,fw);
    vec3 rd=normalize(fw*2.65+rt*q.x+up*q.y);
    // Analytic bounding sphere avoids marching empty studio pixels.
    float b=dot(ro,rd),c=dot(ro,ro)-7.84,h=b*b-c;
    if(h<0.0) return backdrop(ro,rd);
    float travel=max(0.0,-b-sqrt(h));
    float limit=-b+sqrt(h);
    vec3 p=ro+rd*travel;
    bool hit=false;
    for(int i=0;i<88;i++) {
        p=ro+rd*travel;
        float d=sdf(p);
        if(d<0.001) { hit=true; break; }
        travel+=max(d*0.85,0.0005);
        if(travel>limit) break;
    }
    if(!hit) return backdrop(ro,rd);
    vec3 n=normalAt(p);
    float facing=clamp(dot(-rd,n),0.0,1.0);
    float f=0.04+0.96*pow(1.0-facing,5.0);
    vec3 reflected=studio(reflect(rd,n));
    vec3 inside=refract(rd,n,1.0/1.48);
    vec3 entry=p;
    float depth=0.009;
    vec3 exitP=p+inside*depth;
    for(int j=0;j<72;j++) {
        exitP=entry+inside*depth;
        float d=sdf(exitP);
        if(d>-0.0008 && depth>0.015) break;
        depth+=max(abs(d)*0.82,0.001);
        if(depth>6.0) break;
    }
    vec3 exitN=normalAt(exitP);
    vec3 transmitted=refract(inside,-exitN,1.48);
    vec3 through;
    if(dot(transmitted,transmitted)<0.05) {
        // Total internal reflection is visible along the curved shoulder.
        through=studio(reflect(inside,exitN))*0.65;
    } else {
        through=backdrop(exitP+transmitted*0.012,transmitted);
        float backF=0.04+0.96*pow(1.0-clamp(dot(inside,exitN),0.0,1.0),5.0);
        through=mix(through,studio(reflect(inside,-exitN)),backF*0.70);
    }
    through*=exp(-vec3(0.10,0.070,0.045)*depth);
    vec3 col=mix(through,reflected,f);
    // Wide reflected illumination follows the true normal, never a screen rim.
    col+=studio(reflect(rd,n))*0.012;
    return col;
}

vec3 aces(vec3 c) {
    return clamp((c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14),0.0,1.0);
}

void main() {
    vec3 col=vec3(0);
    // Four native pixel samples keep the rotating silhouette and highlights stable.
    for(int y=0;y<2;y++) for(int x=0;x<2;x++) {
        vec2 delta=(vec2(float(x),float(y))+0.5)/2.0-0.5;
        col+=trace(gl_FragCoord.xy+delta);
    }
    col=pow(aces(col*0.25),vec3(1.0/2.2));
    fragColor=vec4(col,1.0);
}
"""


class Optical:
    def __init__(self, w=1920, h=1080):
        self.w, self.h = int(w), int(h)
        self.ctx = moderngl.create_standalone_context(backend="egl", require=330)
        self.program = self.ctx.program(vertex_shader=VERTEX, fragment_shader=FRAGMENT)
        vertices = np.array([-1, -1, 1, -1, -1, 1, 1, 1], dtype="f4")
        self.vbo = self.ctx.buffer(vertices.tobytes())
        self.vao = self.ctx.simple_vertex_array(self.program, self.vbo, "in_pos")
        self.texture = self.ctx.texture((self.w, self.h), 3, dtype="f1")
        self.fbo = self.ctx.framebuffer(color_attachments=[self.texture])
        self.content = self.ctx.texture((1, 1), 3, bytes([0, 0, 0]))
        self.content.filter = (moderngl.LINEAR, moderngl.LINEAR)
        self._content_key = None
        self.program["resolution"].value = (self.w, self.h)
        self.program["content_texture"].value = 0
        self.ctx.viewport = (0, 0, self.w, self.h)

    def frame(self, t=0.0, dist=7.7, angle=0.6, mode=1, content=None, offset=(0, 0)):
        """Return an RGB PIL image; 1920×1080 is rendered natively, not upscaled."""
        key = id(content) if content is not None else None
        if key is not None and key != self._content_key:
            image = content.convert("RGB") if hasattr(content, "convert") else Image.fromarray(np.asarray(content)).convert("RGB")
            self.content.release()
            self.content = self.ctx.texture(image.size, 3, image.transpose(Image.Transpose.FLIP_TOP_BOTTOM).tobytes())
            self.content.filter = (moderngl.LINEAR, moderngl.LINEAR)
            self.content.repeat_x = self.content.repeat_y = False
            self._content_key = key
        self.content.use(location=0)
        self.program["time"].value = float(t)
        self.program["distance"].value = float(dist)
        self.program["angle"].value = float(angle)
        self.program["mode"].value = int(mode)
        self.program["offset"].value = tuple(map(float, offset))
        self.program["has_content"].value = content is not None
        self.fbo.use()
        self.vao.render(moderngl.TRIANGLE_STRIP)
        return Image.frombytes("RGB", (self.w, self.h), self.fbo.read(components=3, alignment=1)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)

    def close(self):
        for resource in (self.vao, self.vbo, self.content, self.fbo, self.texture, self.program):
            resource.release()
        self.ctx.release()
