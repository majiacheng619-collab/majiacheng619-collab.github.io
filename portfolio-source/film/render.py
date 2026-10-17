#!/usr/bin/env python3
"""Native 1080p60 editorial film. Dry authorized voice; measured word timing."""
from pathlib import Path
import os,sys,json,hashlib,re,functools,subprocess as sp,difflib
import numpy as np
from opencc import OpenCC
SIMPLIFY=OpenCC("t2s").convert
from PIL import Image,ImageFont,ImageDraw,ImageFilter
ROOT=Path(__file__).resolve().parent; SITE=ROOT.parent/'site'; TMP=ROOT/'.build'; TMP.mkdir(exist_ok=True)
W,H,FPS=1920,1080,60
KEY_FILES=[Path(__file__),ROOT/'scenes_v3.py',ROOT/'optical.py',ROOT/'mix_v3.py',ROOT/'inputs/narrator-v3.flac',ROOT/'inputs/narrator-v3.json',ROOT/'inputs/game-demo.mp4',ROOT/'credits.md',SITE/'poster/poster.png',SITE/'honor/live-honor-2026.jpeg']+sorted((SITE/'assets').glob('growth-seed-*.png'))+sorted((SITE/'assets/media').glob('ambient*.mp3'))
RENDER_KEY=hashlib.sha256(b''.join(p.read_bytes() for p in KEY_FILES)).hexdigest()
CACHE=SITE/'assets/media/film-build.json'
if not any(a in sys.argv for a in ['--contact','--skip-render','--audio-only']):
    if CACHE.exists():
        cached=json.loads(CACHE.read_text());m=cached.get('manifest',{})
        if cached.get('renderKey')==RENDER_KEY and all((SITE/m.get(k,'missing')).is_file() for k in ['video','poster','captions']):
            (ROOT.parent/'film-manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');print('Film cache hit',flush=True);sys.exit()
FONT=os.environ.get('FILM_FONT','');BOLD=os.environ.get('FILM_FONT_BOLD','')
for p in [FONT,'/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc']:
    if p and Path(p).is_file():FONT=p;break
if not BOLD:
    BOLD=FONT.replace('Regular','Bold')
    if not Path(BOLD).is_file():BOLD=FONT
@functools.lru_cache(maxsize=100)
def font(size,bold=False):
    p=BOLD if bold else FONT
    return ImageFont.truetype(p,int(size),index=2 if p.endswith('.ttc') else 0)

def ff(args):sp.run(['ffmpeg','-y','-hide_banner','-loglevel','error']+list(map(str,args)),check=True)
def smooth(x):x=max(0,min(1,x));return x*x*x*(x*(6*x-15)+10)
def norm(s):return ''.join(c for c in SIMPLIFY(s) if c.isalnum()).replace('0','零').replace('1','一').replace('2','二').replace('3','三').replace('7','七')
SOURCE=json.loads((ROOT/'inputs/narrator-v3.json').read_text())
SOURCE_SEGMENTS=SOURCE['segments'] if isinstance(SOURCE,dict) else SOURCE
EXPECTED_IDS=['intro','ecom_metric','ecom_manual','ai','growth','gameplay','live','field','outro']
if [s.get('id') for s in SOURCE_SEGMENTS]!=EXPECTED_IDS:raise RuntimeError('Require complete, ordered nine-segment narration.')
# Remove only the measured silent end of the long AI sentence; no speech is cut.
ai_segment=SOURCE_SEGMENTS[3]
if ai_segment['duration']>=10 and any(a<=9.30 and b>=9.99 for a,b in ai_segment.get('quiet_intervals',[])):
    ai_segment=dict(ai_segment,source_end=ai_segment['source_start']+9.30,duration=9.30,trimmed_silent_tail=.70)
    SOURCE_SEGMENTS[3]=ai_segment
voice_seconds=sum(float(s['source_end'])-float(s['source_start']) for s in SOURCE_SEGMENTS)
intro_pad=.75;tail=2.6;budget=60-intro_pad-tail-voice_seconds
if budget<3.2:raise RuntimeError(f'Voice {voice_seconds:.2f}s too long; edit copy rather than accelerate.')
weights=np.array([.9,.42,1.25,.8,.55,1.05,.65,1.15]);gaps=weights/weights.sum()*budget
SCHEDULE=[];cursor=intro_pad
for i,s in enumerate(SOURCE_SEGMENTS):
    dur=s['source_end']-s['source_start'];SCHEDULE.append(dict(s,start=cursor,end=cursor+dur,voice_start=cursor,voice_end=cursor+dur));cursor+=dur+(float(gaps[i]) if i<8 else 0)
BOUNDS=[0]+[(a['end']+b['start'])/2 for a,b in zip(SCHEDULE,SCHEDULE[1:])]+[60]
SEGMENTS=[dict(s,start=BOUNDS[i],end=BOUNDS[i+1]) for i,s in enumerate(SCHEDULE)]

def phrase_groups(text):
    # Semantic groups have measured word boundaries, never guessed even spacing.
    preferred={
      '《萌芽保卫队》，有萌芽、成株与开花三种形态。':['《萌芽保卫队》，','有萌芽、成株与开花三种形态。'],
      '先种谁，保护谁，何时进化，留给玩家决定。':['先种谁，保护谁，何时进化，','留给玩家决定。'],
      '直播间里，我策划主题，调整内容与互动。':['直播间里，我策划主题，','调整内容与互动。'],
      '线下，我和朋友设计挑战规则，组织现场。':['线下，我和朋友设计挑战规则，','组织现场。'],
      '从咨询转化到教学交付，我把反复出现的问题，整理成操作手册。':['从咨询转化到教学交付，','我把反复出现的问题，','整理成操作手册。'],
      '三支人工智能叙事短片，从脚本、分镜，到素材、配音与剪辑，由我独立完成。':['三支人工智能叙事短片，','从脚本、分镜，','到素材、配音与剪辑，','由我独立完成。'],
    }
    if text in preferred:return preferred[text]
    parts=re.findall(r'[^，。！？；]+[，。！？；]?',text);out=[];buf=''
    for part in parts:
        if buf and len(norm(buf+part))>17:out.append(buf);buf=''
        buf+=part
    if buf:out.append(buf)
    return out

def measured_cues(s):
    text=s['text'];canonical=norm(text);words=s.get('words',[])
    if not words:raise RuntimeError('Measured word timings required: '+s['id'])
    observed='';times=[]
    for w in words:
        chars=norm(w.get('word',w.get('text','')))
        observed+=chars;times.extend([(float(w['start']),float(w['end']))]*len(chars))
    mapping={}
    for op,a,b,c,d in difflib.SequenceMatcher(None,canonical,observed,autojunk=False).get_opcodes():
        if op=='equal':
            for j in range(b-a):mapping[a+j]=times[c+j]
        elif op in ('replace','delete'):
            lo=times[min(c,len(times)-1)][0];hi=times[min(max(c,d-1),len(times)-1)][1]
            for j in range(a,b):mapping[j]=(lo,hi)
    result=[];pos=0;dur=s['source_end']-s['source_start']
    for phrase in phrase_groups(text):
        n=len(norm(phrase));start=mapping.get(pos,(0,0))[0];end=mapping.get(pos+n-1,(dur,dur))[1];pos+=n
        result.append((s['start']+max(0,start-.035),s['start']+min(dur,end+.10),phrase.replace('二零二七','2027')))
    for i in range(len(result)-1):
        a,b,txt=result[i];result[i]=(a,min(b,result[i+1][0]-.025),txt)
    if any(b-a<.50 for a,b,_ in result):raise RuntimeError('Caption too short '+str(result))
    return result
CUES=[cue for s in SCHEDULE for cue in measured_cues(s)]
@functools.lru_cache(maxsize=16)
def gameframe(n):return Image.open(TMP/'game'/f'{min(359,max(0,int(n)))+1:04}.jpg').convert('RGB')
from optical import Optical
from scenes_v3 import create_scenes
optical=Optical(W,H)
scene=create_scenes(globals())
@functools.lru_cache(maxsize=80)
def caption_image(text,light):
    f=font(58);bb=f.getbbox(text);width=int(f.getlength(text))+36;height=bb[3]-bb[1]+30
    im=Image.new('RGBA',(width,height));shadow=Image.new('RGBA',im.size)
    color=(23,23,26,255) if light else (249,249,251,255);shade=(255,255,255,150) if light else (0,0,0,180)
    ImageDraw.Draw(shadow).text((18,15-bb[1]),text,font=f,fill=shade);im=shadow.filter(ImageFilter.GaussianBlur(3))
    ImageDraw.Draw(im).text((18,12-bb[1]),text,font=f,fill=color);return im
CONTRAST={}
def frame(t):
    im=scene(t).convert('RGBA')
    for i,(a,b,text) in enumerate(CUES):
        if a<=t<b:
            if i not in CONTRAST:
                probe=np.asarray(scene((a+b)/2).resize((192,108)))
                CONTRAST[i]=float(probe[94:104,:,:3].mean())>150
            label=caption_image(text,CONTRAST[i]);alpha=min(1,(t-a)/.075,(b-t)/.075)
            if alpha<1:
                label=label.copy();label.putalpha(label.getchannel('A').point(lambda p:round(p*max(0,alpha))))
            im.alpha_composite(label,(round((W-label.width)/2),946));break
    if t<.25:im=Image.blend(Image.new('RGBA',(W,H),(5,5,7,255)),im,smooth(t/.25))
    return im.convert('RGB')

def timestamp(t):
    ms=round(t*1000);s,ms=divmod(ms,1000);m,s=divmod(s,60);h,m=divmod(m,60);return f'{h:02}:{m:02}:{s:02}.{ms:03}'
def audio():
    from mix_v3 import mix_audio
    report=mix_audio(ROOT/'inputs/narrator-v3.flac',SCHEDULE,next((SITE/'assets/media').glob('ambient*.mp3')),TMP/'audio-final.m4a',duration=60)
    (TMP/'sound-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def publish():
    outdir=SITE/'assets/media';outdir.mkdir(exist_ok=True)
    def put(src,prefix,suffix):
        raw=src.read_bytes();name=f'{prefix}.{hashlib.sha256(raw).hexdigest()[:12]}.{suffix}';(outdir/name).write_bytes(raw);return 'assets/media/'+name
    vtt='WEBVTT\n\n'+'\n\n'.join(f'{i+1}\n{timestamp(a)} --> {timestamp(b)}\n{text}' for i,(a,b,text) in enumerate(CUES))+'\n';(TMP/'captions.vtt').write_text(vtt)
    scene(2.6).convert('RGB').save(TMP/'poster.jpg',quality=94,subsampling=0)
    m={k:put(TMP/src,prefix,suffix) for k,src,prefix,suffix in [('video','film.mp4','intro','mp4'),('poster','poster.jpg','intro-poster','jpg'),('captions','captions.vtt','intro','vtt')]}
    m.update(duration=60,width=W,height=H,fps=FPS,scenes=9,voice='经本人授权，以原始录音音色重新合成的新文案旁白；使用原生语速、独立干声混音。')
    (ROOT.parent/'film-manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
    timeline={'version':3,'duration':60,'fps':FPS,'scenes':[{'id':s['id'],'start':s['start'],'end':s['end']} for s in SEGMENTS],'voice_segments':[{k:s[k] for k in ['id','text','start','end','source_start','source_end']} for s in SCHEDULE],'captions':[{'start':a,'end':b,'text':t} for a,b,t in CUES],'source_voice_disclosure':m['voice']}
    (ROOT/'timeline.json').write_text(json.dumps(timeline,ensure_ascii=False,indent=2)+'\n')
    (outdir/'intro-script.txt').write_text('\n'.join(s['text'] for s in SCHEDULE)+'\n');(outdir/'CREDITS.md').write_text((ROOT/'credits.md').read_text())
    for pattern,key in [('intro.*.mp4','video'),('intro.*.vtt','captions'),('intro-poster.*.jpg','poster')]:
        for old in outdir.glob(pattern):
            if old!=SITE/m[key]:old.unlink()
    CACHE.write_text(json.dumps({'renderKey':RENDER_KEY,'manifest':m},ensure_ascii=False,indent=2)+'\n');print(json.dumps(m,ensure_ascii=False),flush=True)
if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--contact',action='store_true');p.add_argument('--skip-render',action='store_true');p.add_argument('--audio-only',action='store_true');args=p.parse_args()
    (TMP/'game').mkdir(exist_ok=True)
    if not (TMP/'game/0360.jpg').is_file():ff(['-i',ROOT/'inputs/game-demo.mp4','-vf','fps=30','-q:v','3',TMP/'game/%04d.jpg'])
    if args.contact:
        sheet=Image.new('RGB',(1920,1170),(29,30,34))
        for i,s in enumerate(SEGMENTS):
            t=(s['start']+s['end'])/2;im=frame(t).resize((640,360));sheet.paste(im,((i%3)*640,(i//3)*390));ImageDraw.Draw(sheet).text(((i%3)*640+10,(i//3)*390+365),f'{i+1} / {t:.2f}s / {s["id"]}',fill='white')
        sheet.save(TMP/'contact.jpg',quality=95);print(TMP/'contact.jpg');sys.exit()
    if args.audio_only:
        audio();ff(['-i',TMP/'film.mp4','-i',TMP/'audio-final.m4a','-map','0:v','-map','1:a','-c','copy','-t','60','-movflags','+faststart',TMP/'remux.mp4']);(TMP/'remux.mp4').replace(TMP/'film.mp4')
    elif not args.skip_render:
        audio();proc=sp.Popen(['ffmpeg','-y','-hide_banner','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s','1920x1080','-r','60','-i','-','-i',str(TMP/'audio-final.m4a'),'-map','0:v','-map','1:a','-c:v','libx264','-preset','fast','-crf','18','-maxrate','12000k','-bufsize','24000k','-pix_fmt','yuv420p','-c:a','copy','-t','60','-movflags','+faststart',str(TMP/'film.mp4')],stdin=sp.PIPE)
        try:
            for n in range(3600):
                proc.stdin.write(frame(n/60).tobytes())
                if n%300==0:print(f'Rendered {n}/3600',flush=True)
            proc.stdin.close()
            if proc.wait()!=0:raise RuntimeError('Encoder failed')
        except BaseException:proc.kill();raise
    publish()
