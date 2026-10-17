"""Nine authored scenes for the original portfolio film, native 1920 x 1080.

create_scenes(ctx) returns frame(t) -> RGB Pillow Image. Required context:
SITE, SEGMENTS [{id,start,end}], font(size,bold=False), gameframe(frame_number),
and optical: Optical instance. Assets are real portfolio evidence; the teaching
page and editing tracks are explicitly labelled process illustrations.
"""
from pathlib import Path
import math
import functools
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W,H=1920,1080
NAMES=['身份与光学玻璃','电商教学规模','问题整理与教学交付','三支独立叙事作品','萌芽保卫队三种形态','真实游戏体验','直播内容与互动','一次线下活动','继续看作品']

def smooth(x):
    x=max(0.,min(1.,x)); return x*x*x*(x*(x*6-15)+10)
def ease(x):
    x=max(0.,min(1.,x)); return 1-(1-x)**3

def create_scenes(ctx):
    SITE=Path(ctx['SITE']); segments=ctx['SEGMENTS']; f=ctx['font']; gameframe=ctx['gameframe']; optical=ctx['optical']
    INK=(26,27,31,255); GRAY=(116,119,125,255); WHITE=(246,247,250,255); MUTED=(148,155,169,255)
    @functools.lru_cache(maxsize=220)
    def glyph(s,size,col,bold=False):
        ft=f(size,bold);bb=ft.getbbox(s)
        im=Image.new('RGBA',(math.ceil(ft.getlength(s))+12,bb[3]-bb[1]+12))
        ImageDraw.Draw(im).text((6,6-bb[1]),s,font=ft,fill=col)
        return im
    def text(im,s,size,x,y,col=WHITE,a=1.,center=False,bold=False):
        if a<=0:return
        g=glyph(s,size,col,bold)
        if a<.999:
            g=g.copy();g.putalpha(g.getchannel('A').point(lambda v:round(v*max(0,min(1,a)))))
        if center:x-=g.width/2
        im.alpha_composite(g,(round(x),round(y)))
    def reveal(im,s,size,x,y,u,delay=0,col=WHITE,center=False,bold=True):
        a=ease((u-delay)/.95);text(im,s,size,x,y+26*(1-a),col,a,center,bold)
    # Broad studio light has no moving texture or repeated decorative particle field.
    yy,xx=np.mgrid[0:270,0:480];xx=(xx-240)/240;yy=(yy-135)/135
    a=np.exp(-((xx-.5)**2/.8+(yy+.4)**2/1.8));b=np.exp(-((xx+.6)**2/1.2+(yy-.75)**2/.35))
    backgrounds={}
    for kind in ('paper','warm','black','ink'):
        if kind=='paper':arr=np.ones((270,480,3))*[248,248,250]-a[:,:,None]*5-b[:,:,None]*8
        elif kind=='warm':arr=np.ones((270,480,3))*[235,231,223]+a[:,:,None]*[16,17,21]-b[:,:,None]*11
        elif kind=='ink':arr=np.ones((270,480,3))*[10,13,18]+a[:,:,None]*[7,10,15]+b[:,:,None]*[8,9,11]
        else:arr=np.ones((270,480,3))*[4,5,7]+a[:,:,None]*[7,8,10]+b[:,:,None]*[5,6,8]
        backgrounds[kind]=Image.fromarray(np.uint8(np.clip(arr,0,255))).resize((W,H),Image.Resampling.BICUBIC).convert('RGBA')
    def base(kind='black'):return backgrounds[kind].copy()
    # A single cropped typographic light plane makes the two-surface optical
    # displacement perceptible during the macro shot. It carries no identity
    # or claim, and clears before the primary name appears.
    refraction_plane=Image.new('RGBA',(2048,1152),(15,16,19,255))
    text(refraction_plane,'作',880,540,-160,(242,243,246,255),bold=True)
    ImageDraw.Draw(refraction_plane).rectangle((0,904,2048,1010),fill=(225,228,233,255))
    refraction_plane=refraction_plane.convert('RGB')
    def pic(path):return Image.open(path).convert('RGBA')
    poster=pic(SITE/'poster/poster.png')
    reward=pic(SITE/'honor/live-honor-2026.jpeg').crop((24,732,1056,1185))
    plants=[pic(next((SITE/'assets').glob('growth-seed-'+n+'.*.png'))) for n in ('sprout','adult','flower')]
    @functools.lru_cache(maxsize=18)
    def shadow(w,h,alpha=50):
        g=Image.new('RGBA',(w+160,h+160));ImageDraw.Draw(g).rectangle((80,66,w+80,h+66),fill=(39,34,28,alpha));return g.filter(ImageFilter.GaussianBlur(32))
    def put_pic(im,p,w,x,y,drop=False):
        w=round(w);h=round(p.height*w/p.width)
        if drop:im.alpha_composite(shadow(round(w/16)*16,round(h/16)*16),(round(x)-80,round(y)-55))
        im.alpha_composite(p.resize((w,h),Image.Resampling.LANCZOS),(round(x),round(y)))
        return h
    # A legible editorial document is a workflow diagram, never presented as an
    # actual client record or a screen capture of personal data.
    page=Image.new('RGBA',(1500,1840),(255,255,255,255));d=ImageDraw.Draw(page)
    text(page,'交付工作台',32,108,72,GRAY)
    d.line((112,155,1388,155),fill=(211,215,222,255),width=2)
    text(page,'从一个问题',86,104,222,INK,bold=True);text(page,'找到下一步',86,104,335,INK,bold=True)
    for n,(heading,body) in enumerate([('咨询记录','先记录问题与需求'),('操作手册','把处理步骤写清楚'),('常见问题','将反复出现的疑问归档')]):
        y=600+n*345
        text(page,f'0{n+1}',25,112,y+8,GRAY)
        text(page,heading,59,220,y,INK,bold=True)
        text(page,body,29,220,y+100,GRAY)
        for j,ln in enumerate([990,810,920]):d.line((224,y+179+j*28,224+ln,y+179+j*28),fill=(223,226,231,255),width=3)
    dots=Image.new('RGBA',(W,H));d=ImageDraw.Draw(dots)
    for n in range(1000):
        x=1200+(n%20)*22;y=230+(n//20)*11
        d.ellipse((x-1.8,y-1.8,x+1.8,y+1.8),fill=(123,132,147,155))
    # Feather reserves a consistent lower safe area for burned-in captions.
    feather=Image.new('L',(1,H));feather.putdata([round(255*smooth((y-850)/85)) for y in range(H)]);feather=feather.resize((W,H))
    intro_safety=Image.new('L',(1,H));intro_safety.putdata([round(220*smooth((y-820)/130)) for y in range(H)]);intro_safety=intro_safety.resize((W,H))
    def safe_paper(im):
        layer=backgrounds['paper'].copy();layer.putalpha(feather);im.alpha_composite(layer)
    intro_plate=[None]
    def scene(i,u,t):
        s=segments[i];dur=max(.01,s['end']-s['start']);q=max(0,min(1,u/dur))
        if i==0:
            k=smooth(u/3.7)
            if u>=3.7:
                if intro_plate[0] is None:intro_plate[0]=optical.frame(t=3.7,dist=8.55,angle=.47,mode=1,offset=(0,0)).convert('RGBA')
                im=intro_plate[0].copy()
            else:im=optical.frame(t=u,dist=3.15+5.40*k,angle=.95-.48*k,mode=1,offset=(0,0)).convert('RGBA')
            beat=smooth((u-.22)/.30)*(1-smooth((u-1.02)/.55))
            if beat>0:
                refracted=optical.frame(t=u,dist=3.15+5.40*k,angle=.95-.48*k,mode=1,content=refraction_plane,offset=(0,0)).convert('RGBA')
                im=Image.blend(im,refracted,beat*.82)
                # The bright refracted light band never competes with speech captions.
                shade=Image.new('RGBA',(W,H),(0,0,0,0));shade.putalpha(intro_safety.point(lambda v:round(v*beat)));im.alpha_composite(shade)
            reveal(im,'马嘉程',170,960,275,u,1.58,center=True)
            reveal(im,'2027 届本科 · 产品与运营',34,960,500,u,2.0,col=(180,186,197,255),center=True,bold=False)
            text(im,'南昌理工学院',24,960,575,(134,141,154,255),ease((u-2.2)/.9),True)
        elif i==1:
            im=base('paper');k=ease(u/.9)
            im.alpha_composite(dots)
            text(im,'电商教学',34,150,160,GRAY,k)
            text(im,'约',60,153,349,INK,k)
            text(im,'1,000',300,245,288,INK,k,bold=True)
            text(im,'累计服务学员',39,155,676,GRAY,k)
            # The incoming page links a real scale fact to the working method.
            entering=smooth((q-.72)/.28)
            if entering>0:
                pw=1250;px=1950-650*entering;ph=round(page.height*pw/page.width)
                im.alpha_composite(shadow(pw,ph,25),(round(px)-80,35))
                put_pic(im,page,pw,px,90)
            safe_paper(im)
        elif i==2:
            im=base('paper');k=smooth((u-1.1)/max(.1,dur-1.1))
            pw=1240+520*k;px=960-pw/2;py=80-560*k
            if u<1.1:px=1300-960*ease(u/1.1)
            put_pic(im,page,pw,px,py,False)
            safe_paper(im)
            # Right align the disclosure in the reserved lower safe area.
            g=glyph('流程示意 · 非实际项目文档',22,GRAY);im.alpha_composite(g,(1750-g.width,860))
        elif i==3:
            im=base();d=ImageDraw.Draw(im)
            text(im,'独立创作',30,148,130,MUTED,ease(u/.7))
            reveal(im,'三支叙事短片',96,145,190,u,.05)
            titles=['升学与就业选择','从赢两千到欠八十万','陪家人抗癌']
            active=min(2,int(q*3));xs=[150,730,1350]
            for n,(x,title) in enumerate(zip(xs,titles)):
                col=WHITE if n==active else (116,126,142,255)
                text(im,f'0{n+1}',22,x,370,(125,137,157,255))
                text(im,title,36,x,420,col,bold=n==active)
                d.line((x,506,x+420,506),fill=(59,65,76,255),width=1)
            # Three purposeful tracks, moving continuously beneath a fixed edit head.
            left,right=150,1770;phase=u*82
            for track,y in enumerate((610,708,809)):
                text(im,['脚本','镜头','声音'][track],23,150,y-44,MUTED)
                for j in range(-3,20):
                    x=150+j*(179+track*17)-phase*(.65+track*.17)
                    ww=152+track*17
                    x0=max(left,x);x1=min(right,x+ww)
                    if x1<=x0:continue
                    d.rectangle((x0,y,x1,y+54),fill=[(48,58,74,255),(61,70,86,255),(51,66,77,255)][track])
                    if track==2:
                        for a in range(math.ceil(x0/10)*10,math.floor(x1/10)*10,10):
                            h=6+12*(.5+.5*math.sin((a+phase)*.07))*abs(math.sin((a+phase)*.025))
                            d.line((a,y+27-h,a,y+27+h),fill=(137,161,179,255),width=2)
                d.line((left,y+62,right,y+62),fill=(40,45,55,255),width=1)
            play=1035;d.line((play,560,play,881),fill=(231,235,242,255),width=2)
            d.polygon([(play-6,554),(play+6,554),(play,562)],fill=(231,235,242,255))
            text(im,'创作流程示意',22,1518,900,(118,128,145,255))
        elif i==4:
            im=base('paper');text(im,'萌芽保卫队',32,150,135,GRAY)
            labels=['萌芽','成株','开花']
            if q<.24:stage,nxt,blend=0,0,0.
            elif q<.38:stage,nxt,blend=0,1,smooth((q-.24)/.14)
            elif q<.60:stage,nxt,blend=1,1,0.
            elif q<.74:stage,nxt,blend=1,2,smooth((q-.60)/.14)
            else:stage,nxt,blend=2,2,0.
            # Text changes through a brief clear interval; overlapping Chinese
            # glyphs would look like a broken typeface in the plant dissolve.
            old_label=1-smooth(blend/.35) if nxt!=stage else 1.
            new_label=smooth((blend-.65)/.35) if nxt!=stage else 0.
            text(im,labels[stage],136,960,228,INK,old_label,True,True)
            if nxt!=stage:text(im,labels[nxt],136,960,228,INK,new_label,True,True)
            # Alpha-crop each actual sprite and register it to one ground point.
            def place(p,alpha):
                if alpha<=0:return
                p=p.crop(p.getbbox());scale=340/max(p.size);sz=(round(p.width*scale),round(p.height*scale));x=p.resize(sz,Image.Resampling.LANCZOS)
                if alpha<.999:x=x.copy();x.putalpha(x.getchannel('A').point(lambda v:round(v*alpha)))
                im.alpha_composite(x,(round(960-x.width/2),790-x.height))
            place(plants[stage],1-blend)
            if nxt!=stage:place(plants[nxt],blend)
            d=ImageDraw.Draw(im);d.line((640,799,1280,799),fill=(210,214,220,255),width=1)
            for n,name in enumerate(labels):
                weight=(1-blend if n==stage else 0)+(blend if n==nxt and nxt!=stage else 0)
                col=tuple(round(GRAY[c]*(1-weight)+INK[c]*weight) for c in range(4))
                text(im,name,29,720+n*240,827,col,1,True,False)
        elif i==5:
            im=base('ink');k=smooth(q);w=round(1450+95*k);p=gameframe(min(359,max(0,int((u+5.0)*30)))).convert('RGBA');x=(W-w)/2
            put_pic(im,p,w,x,30,False)
            text(im,'实际游戏录屏',23,165,900,(171,183,201,255))
        elif i==6:
            im=base('paper');k=ease(u/1.1)
            text(im,'直播内容与互动',32,150,140,GRAY,k)
            reveal(im,'区县 100 强',125,145,248,u,.05,col=INK)
            text(im,'青山湖区',34,158,438,GRAY,k)
            # The source screenshot is cropped to the award only, never the faces.
            width=1000+40*smooth(q);x=(W-width)/2;y=438-8*smooth(q)
            put_pic(im,reward,width,x,y,True)
            # Keep the complete cropped award strip above the subtitle safe area.
            text(im,'实际荣誉记录',22,158,883,GRAY,k)
        elif i==7:
            im=base('warm');k=smooth(q);h=780+30*k;w=h*poster.width/poster.height;x=1190-w/2;y=53-10*k
            text(im,'线下活动',31,150,155,(115,109,99,255),ease(u/.8))
            reveal(im,'把活动',100,143,285,u,.05,col=INK)
            reveal(im,'带到现场',100,143,413,u,.2,col=INK)
            text(im,'规则设计 · 现场组织',29,155,610,(108,104,99,255),ease((u-.35)/.9))
            put_pic(im,poster,w,x,y,True)
            text(im,'实际活动物料',22,1155,872,(111,106,99,255),1,True)
        else:
            im=base();text(im,'继续看作品。',99,960,309,WHITE,ease((u-.15)/1.0),True,True)
            text(im,'majiacheng619-collab.github.io',37,960,500,(162,170,185,255),ease((u-.7)/1.),True)
            # A late, low glass edge provides a quiet final movement. Its
            # feathered entry prevents a horizontal seam across the studio.
            k=smooth((q-.55)/.45)
            if k>0:
                gl=optical.frame(t=t,dist=6.9,angle=.34+.18*k,mode=1,offset=(0,.62)).convert('RGBA')
                mask=Image.new('L',(1,H));mask.putdata([round(255*k*smooth((y-640)/155)) for y in range(H)]);mask=mask.resize((W,H))
                gl.putalpha(mask);im.alpha_composite(gl)
        return im
    bounds=[float(s['start']) for s in segments]+[float(segments[-1]['end'])]
    def frame(t):
        i=min(8,max(0,int(np.searchsorted(bounds,t,side='right')-1)));u=t-bounds[i]
        im=scene(i,u,t)
        # Short dissolves bridge editorial chapters; camera motions within each
        # scene are continuous and never reset at a subtitle or voice boundary.
        transition=.20
        if i and 0<=u<transition:
            prev=scene(i-1,bounds[i]-bounds[i-1],bounds[i])
            im=Image.blend(prev,im,smooth(u/transition))
        return im.convert('RGB')
    return frame
