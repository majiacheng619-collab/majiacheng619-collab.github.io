"""Original thirty-second 3D film. Every frame is evaluated at continuous time.
EGL rasterisation: extruded glyph silhouettes, moving perspective cameras,
and a tessellated, bending physical poster carrying the authentic artwork.
"""
from pathlib import Path
import math, functools
import numpy as np
from PIL import Image,ImageDraw,ImageOps
W,H=1920,1080
CUTS=[0,2.2,4.4,9,12.2,14.4,17,20,24]
TITLES=['做。把想法做成作品','萌芽保卫队 · 实际游戏录屏','真实活动海报 · 从规则到现场','累计服务约 1,000 名学员','3 支 AI 叙事短片 · 独立完成全流程','直播内容与互动 · 2026 家乡荣耀季','马嘉程 · 产品与运营','马嘉程 · 继续看我的作品']
def smooth(x):
 x=max(0.,min(1.,x));return x*x*(3-2*x)
def mix(a,b,k):return a+(b-a)*k
def matlook(eye,target):
 e=np.array(eye,dtype='f4');f=np.array(target,dtype='f4')-e;f/=np.linalg.norm(f);s=np.cross(f,[0,1,0]);s/=np.linalg.norm(s);u=np.cross(s,f)
 m=np.eye(4,dtype='f4');m[0,:3]=s;m[1,:3]=u;m[2,:3]=-f;m[:3,3]=[-s@e,-u@e,f@e];return m
def perspective(fov,aspect=16/9):
 a=1/math.tan(fov*math.pi/360);m=np.zeros((4,4),dtype='f4');m[0,0]=a/aspect;m[1,1]=a;m[2,2]=-1.002;m[2,3]=-.2002;m[3,2]=-1;return m
def model(x=0,y=0,z=0,ry=0,rx=0,rz=0,scale=1):
 c,s=math.cos(ry),math.sin(ry);a,b=math.cos(rx),math.sin(rx);d,e=math.cos(rz),math.sin(rz)
 R=np.array([[c,0,s,0],[0,1,0,0],[-s,0,c,0],[0,0,0,1]],dtype='f4')@np.array([[1,0,0,0],[0,a,-b,0],[0,b,a,0],[0,0,0,1]],dtype='f4')@np.array([[d,-e,0,0],[e,d,0,0],[0,0,1,0],[0,0,0,1]],dtype='f4');R[:3,:3]*=scale;R[:3,3]=[x,y,z];return R

def create_scenes(ctx):
 import moderngl
 site=Path(ctx['SITE']);font=ctx['font'];game=ctx['gameframe'];gl=moderngl.create_standalone_context(backend='egl');gl.enable(moderngl.DEPTH_TEST|moderngl.BLEND);gl.blend_func=moderngl.SRC_ALPHA,moderngl.ONE_MINUS_SRC_ALPHA
 fb=gl.simple_framebuffer((W,H),components=3);fb.use()
 prog=gl.program(vertex_shader='''#version 330
 in vec3 in_pos;in vec3 in_normal;in vec2 in_uv;uniform mat4 model;uniform mat4 vp;uniform float bend;uniform float clock;out vec2 uv;out vec3 normal;out vec3 world;
 void main(){vec3 p=in_pos;float wave=sin(p.x*.85+clock)*bend;p.z+=wave+p.x*p.x*bend*.12;vec3 n=normalize(in_normal+vec3(-cos(p.x*.85+clock)*bend*.85-p.x*bend*.24,0,0));vec4 w=model*vec4(p,1);world=w.xyz;normal=mat3(model)*n;uv=in_uv;gl_Position=vp*w;}''',fragment_shader='''#version 330
 uniform sampler2D tex;uniform vec3 tint;uniform bool textured;uniform bool unlit;uniform float opacity;uniform vec3 light;uniform float reveal;uniform float studio;uniform float clock;in vec2 uv;in vec3 normal;in vec3 world;out vec4 color;
 void main(){vec4 c=textured?texture(tex,uv):vec4(1);if(c.a<.05||uv.x>reveal)discard;float diffuse=max(dot(normalize(normal),normalize(light-world)),0);float lit=unlit?1.:.46+.54*diffuse;float spec=unlit?0.:pow(max(dot(normalize(normal),normalize(light-world+vec3(0,0,5))),0),40)*.11;float glow=studio*exp(-length((uv-vec2(.48+.12*sin(clock*.21),.45))*vec2(1.4,1.))*2.);color=vec4(c.rgb*tint*lit+spec+vec3(.25,.40,.19)*glow,c.a*opacity);}''')
 def texture(im):
  im=im.convert('RGBA');tx=gl.texture(im.size,4,im.tobytes());tx.filter=(moderngl.LINEAR,moderngl.LINEAR);return tx
 white=texture(Image.new('RGBA',(2,2),'white'))
 def mesh(arr):
  v=gl.buffer(np.array(arr,dtype='f4').tobytes());return gl.vertex_array(prog,[(v,'3f 3f 2f','in_pos','in_normal','in_uv')])
 def quad(width,height,nx=1,ny=1):
  arr=[]
  for j in range(ny):
   for i in range(nx):
    for a,b in [(0,0),(1,0),(1,1),(0,0),(1,1),(0,1)]:
     u=(i+a)/nx;v=(j+b)/ny;arr.append(((u-.5)*width,(.5-v)*height,0,0,0,1,u,v))
  return mesh(arr)
 screen=quad(2,2);paper=quad(4,6,44,24)
 @functools.lru_cache(maxsize=64)
 def lettering(s,size=220):
  ft=font(size,True);box=ft.getbbox(s);im=Image.new('RGBA',(int(ft.getlength(s))+12,box[3]-box[1]+12));ImageDraw.Draw(im).text((6,6-box[1]),s,font=ft,fill='white');return im,texture(im)
 def glyph3d(s,width,depth=.25):
  im,tx=s if isinstance(s,tuple) else lettering(s,400);height=width*im.height/im.width;q=quad(width,height)
  import contourpy
  mask=np.asarray(im.getchannel('A'),dtype='f4')/255.;hh,ww=mask.shape;arr=[]
  contours=contourpy.contour_generator(z=mask).lines(.5)
  for contour in contours:
   pts=np.column_stack(((contour[:,0]/ww-.5)*width,(.5-contour[:,1]/hh)*height))
   for p1,p2 in zip(pts[:-1],pts[1:]):
    tangent=p2-p1;length=np.linalg.norm(tangent)
    if length<1e-7:continue
    normal=(float(tangent[1]/length),float(-tangent[0]/length),0.)
    for p in [(*p1,0),(*p2,0),(*p2,-depth),(*p1,0),(*p2,-depth),(*p1,-depth)]:arr.append((*p,*normal,0,0))
  return q,mesh(arr),tx
 hero=glyph3d('做。',6.8,.5);three=glyph3d('3',5.5,.6)
 # Separate authentic glyph meshes retain the complete number's baseline.
 num_im,_=lettering('1,000',400);ft=font(400,True);edges=[0]+[6+int(ft.getlength('1,000'[:j])) for j in range(1,5)]+[num_im.width];numberparts=[]
 for left,right in zip(edges[:-1],edges[1:]):
  tile=num_im.crop((left,0,right,num_im.height));width=9*tile.width/num_im.width;cx=9*((left+right)/2/num_im.width-.5);numberparts.append((glyph3d((tile,texture(tile)),width,.46),cx))
 poster=texture(Image.open(site/'poster/poster.png'));portrait=texture(Image.open(next((site/'assets').glob('portrait-white-960*'))))
 honor=texture(Image.open(site/'honor/live-honor-2026.jpeg').crop((24,732,1056,1185)));honor_q=quad(10,10*453/1032)
 portrait_q=quad(5.2,5.2);black=(.035,.045,.04);green=(.51,.77,.40);red=(.88,.16,.11)
 def draw(vao,m,tx=white,tint=(1,1,1),flat=False,bend=0,clock=0,opacity=1,reveal=1):
  prog['reveal']=reveal;prog['model'].write(np.asarray(m,dtype='f4').T.tobytes());prog['bend']=bend;prog['clock']=clock;prog['tint']=tint;prog['textured']=tx is not white;prog['unlit']=flat;prog['opacity']=opacity;tx.use();vao.render()
 def camera(eye=(0,0,12),target=(0,0,0),fov=45):prog['vp'].write((perspective(fov)@matlook(eye,target)).T.tobytes());prog['light']=(5.,8.,10.)
 def extrude(obj,m,front=(.96,.96,.9),side=green):
  q,w,tx=obj;draw(w,m,tint=side);draw(q,m,tx,front)
 def label(s,size,x,y,color=black,alpha=1,reveal=1):
  im,tx=lettering(s,size);hh=im.height/H*2;ww=im.width/W*2
  # Overlay uses the same GPU rasterizer in normalized screen space.
  gl.disable(moderngl.DEPTH_TEST);prog['vp'].write(np.eye(4,dtype='f4').tobytes());draw(screen,model(x=x/W*2-1+ww/2,y=1-y/H*2-hh/2,scale=1)@np.diag([ww/2,hh/2,1,1]),tx,color,True,opacity=alpha,reveal=reveal);gl.enable(moderngl.DEPTH_TEST)
 def overlay_image(tx,scale=1):
  gl.disable(moderngl.DEPTH_TEST);prog['vp'].write(np.eye(4,dtype='f4').tobytes());draw(screen,model(scale=scale),tx,flat=True);gl.enable(moderngl.DEPTH_TEST)
 game_tx=None
 def authored_frame(t):
  nonlocal game_tx
  t=max(0,float(t));fb.use();gl.viewport=(0,0,W,H);fb.clear(.94,.94,.90,1,depth=1)
  if t<3.5:
   k=smooth(t/3.5);camera((mix(3.6,.1,k),mix(.9,.1,k),mix(5.3,11.3,k)),(mix(.9,0,k),0,0),45)
   extrude(hero,model(ry=mix(-.24,.04,k),rx=-.08,rz=mix(-.08,0,k)),front=(.96,.96,.9),side=(.14,.34,.19))
   label('MA JIACHENG / SELECTED WORK',24,100,80,black,smooth(t/.4));label('把想法，做成作品。',46,104,902,black,smooth((t-.55)/.6))
   label('2026',22,1730,88,black)
  elif t<5.7:
   # Exactly one continuous 2.2-second excerpt, source 5.5–7.7 seconds.
   p=ImageOps.fit(game(round((5.5+t-3.5)*30)),(W,H),method=Image.Resampling.BILINEAR)
   if game_tx is None:game_tx=texture(p)
   else:game_tx.write(p.convert('RGBA').tobytes())
   overlay_image(game_tx,1+.009*smooth((t-3.5)/2.2));label('萌芽保卫队',62,95,75,(1,1,1));label('独立策划 · AI 辅助开发',28,100,170,(1,1,1));label('实际游戏录屏',23,1570,990,(1,1,1))
  elif t<13:
   u=t-5.7;k=smooth(u/7.3)
   # A sweeping macro starts within the printed artwork; the camera pulls
   # past the curled edge and resolves into a complete vertical paper object.
   camera((mix(-.85,3.2,k),mix(.65,.35,k),mix(2.0,11.8,k)),(mix(-.5,0,k),mix(.65,0,k),0),42)
   m=model(ry=mix(.34,-.17,k),rz=mix(-.14,.03,k));draw(paper,m,poster,bend=mix(.32,.055,k),clock=u*.65)
   # A thickness layer behind the actual sheet catches the travelling light.
   draw(paper,m@model(z=-.025),tint=(.32,.37,.27),bend=mix(.32,.055,k),clock=u*.65)
   label('规则，让参与发生。',49,102,856,black,smooth((u-3.4)/.7));label('活动规则设计 / 现场组织',27,106,944,black,smooth((u-4)/.7))
   label('真实活动海报',22,1550,83,black,smooth((u-3.8)/.6))
  elif t<18:
   u=t-13;k=smooth(u/5);fb.clear(.042,.065,.05,1,depth=1);camera((mix(-2.4,1.5,k),mix(.65,.2,k),mix(9.2,12.8,k)),(0,-.1,0),44)
   for j,(obj,cx) in enumerate(numberparts):
    settle=smooth((u-j*.11)/1.0)
    extrude(obj,model(x=cx+.6*(1-settle),y=.3+(.45 if j%2 else -.45)*(1-settle),z=-6*(1-settle),ry=1.48*(1-settle)+mix(.10,-.06,k),rx=.025,rz=-.01),front=(.88,1.,.76),side=(.28,.59,.31))
   label('约',56,150,245,(.84,.96,.72));label('累计服务学员',46,111,811,(.94,.95,.9),smooth((u-.3)/.65));label('电商知识付费项目 / 独立发起与操盘',29,115,923,(.68,.76,.67),smooth((u-.7)/.65))
  elif t<23:
   u=t-18;k=smooth(u/5);fb.clear(.88,.13,.08,1,depth=1);camera((mix(2.6,-.6,k),mix(.5,.1,k),mix(8,11.8,k)),(0,0,0),44)
   extrude(three,model(x=-2.25,z=-2.5*(1-smooth(u/1.0)),ry=1.48*(1-smooth(u/1.0))+mix(-.06,.10,k),rz=.04),front=(.98,.94,.85),side=(.48,.055,.025))
   label('支',88,990,320,(.99,.94,.85),smooth((u-.15)/.45));label('AI 叙事短片',74,986,470,(.99,.94,.85),smooth((u-.35)/.6));label('脚本  /  镜头  /  声音  /  发布',31,995,690,(.99,.86,.76),1,reveal=smooth((u-.9)/2.5))
   label('独立完成全流程',32,111,930,(.99,.94,.85),smooth((u-1.1)/.7))
  elif t<27:
   u=t-23;k=smooth(u/4);camera((mix(1.4,0,k),0,mix(10.7,12,k)),(0,0,0),43)
   draw(portrait_q,model(x=3.0,y=-.1,ry=mix(-.15,0,k)),portrait,flat=True)
   label('马嘉程',132,110,325,black,smooth(u/.65));label('产品与运营',44,120,525,black,smooth((u-.2)/.6));label('把想法，做成作品。',38,122,687,(.25,.38,.24),smooth((u-.5)/.6));label('2027 届本科',25,122,919,black,smooth((u-.8)/.6))
  else:
   # Deliberately readable three-second end card after the camera resolves.
   fb.clear(.038,.055,.044,1,depth=1)
   prog['vp'].write(np.eye(4,dtype='f4').tobytes());prog['studio']=.13;draw(screen,np.eye(4,dtype='f4'),tint=(.038,.055,.044),flat=True,clock=t);prog['studio']=0.
   label('马嘉程',119,112,278,(.96,.96,.9));label('把想法，做成作品。',53,119,475,(.69,.88,.53));label('majiacheng619-collab.github.io',49,119,695,(.96,.96,.9));label('PORTFOLIO / PRODUCT & OPERATIONS',24,123,930,(.63,.71,.61))
  return Image.frombytes('RGB',(W,H),fb.read(components=3,alignment=1)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
 def frame(t):
  # Retimed camera trajectories retain continuous subframe evaluation.
  t=max(0,min(23.999999,float(t)))
  if t<2.2:return authored_frame(t*3.5/2.2)
  if t<4.4:return authored_frame(3.5+t-2.2)
  if t<9:return authored_frame(5.7+(t-4.4)*7.3/4.6)
  if t<12.2:return authored_frame(13+(t-9)*5/3.2)
  if t<14.4:return authored_frame(18+(t-12.2)*5/2.2)
  if t<17:
   u=t-14.4;k=smooth(u/2.6);fb.use();gl.viewport=(0,0,W,H);fb.clear(.038,.055,.044,1,depth=1)
   camera((mix(-1.4,1.0,k),mix(.5,.1,k),mix(9.0,11.7,k)),(0,.3,0),43)
   draw(honor_q,model(y=.45,ry=mix(.18,-.10,k),rx=.015,rz=mix(-.035,.015,k)),honor,bend=.025,clock=u*.7)
   label('直播内容与互动',51,110,826,(.96,.96,.90),smooth(u/.35));label('2026 家乡荣耀季 / 青山湖区区县100强',30,115,928,(.72,.84,.65),smooth((u-.25)/.4))
   return Image.frombytes('RGB',(W,H),fb.read(components=3,alignment=1)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
  if t<20:return authored_frame(23+(t-17)*4/3)
  return authored_frame(27+(t-20)*.75)
 return frame
