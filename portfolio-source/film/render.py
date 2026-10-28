#!/usr/bin/env python3
"""24-second physical portfolio film: 11,520-frame 480fps master + 60fps web film."""
from pathlib import Path
import os,sys,json,hashlib,functools,subprocess as sp
os.environ.setdefault('LIBGL_ALWAYS_SOFTWARE','1');os.environ.setdefault('EGL_PLATFORM','surfaceless');os.environ.setdefault('LP_NUM_THREADS','2')
import numpy as np
from PIL import Image,ImageFont,ImageDraw
ROOT=Path(__file__).resolve().parent;SITE=ROOT.parent/'site';TMP=ROOT/'.build';TMP.mkdir(exist_ok=True)
W,H,FPS,MASTER_FPS,DURATION=1920,1080,60,480,24
FONT=os.environ.get('FILM_FONT',str(ROOT/'inputs/film-font.otf'));BOLD=os.environ.get('FILM_FONT_BOLD',FONT)
@functools.lru_cache(maxsize=120)
def font(size,bold=False):
 p=BOLD if bold else FONT;return ImageFont.truetype(p,int(size),index=2 if p.endswith('.ttc') else 0)
def ff(args):sp.run(['ffmpeg','-y','-hide_banner','-loglevel','error']+list(map(str,args)),check=True)
@functools.lru_cache(maxsize=16)
def gameframe(n):return Image.open(TMP/'game'/f'{min(359,max(0,int(n)))+1:04}.jpg').convert('RGB')
from scenes_v3 import create_scenes,CUTS,TITLES
from cache_probe import signature
RENDER_KEY=signature(lambda n:(SITE/n).read_bytes(),[p.relative_to(SITE).as_posix() for p in SITE.rglob('*') if p.is_file()])
CACHE=SITE/'assets/media/film-build.json'
frame=None
def init_scene():
 global frame
 frame=create_scenes(globals())
def encoder(path,fps):
 return sp.Popen(['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','1920x1080','-r',str(fps),'-i','-','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p',str(path)],stdin=sp.PIPE)
def chunk(args):
 global frame
 if frame is None:init_scene()
 a,b=args;master=TMP/f'master-{a:05}.mp4';web=TMP/f'web-{a:05}.mp4';mp=encoder(master,MASTER_FPS);wp=encoder(web,FPS);hashes=[];samples=[]
 try:
  for n in range(a,b):
   raw=frame((n+.5)/MASTER_FPS).tobytes();mp.stdin.write(raw);hashes.append(hashlib.sha256(raw).hexdigest())
   # 180-degree shutter: integrate the middle four of eight actual master frames.
   if n%8 in (2,3,4,5):samples.append(np.frombuffer(raw,dtype=np.uint8).reshape(H,W,3))
   if n%8==7:
    averaged=np.rint(sum(x.astype(np.float32) for x in samples)/4).astype(np.uint8);wp.stdin.write(averaged.tobytes());samples=[]
  mp.stdin.close();wp.stdin.close()
  master_rc=mp.wait();web_rc=wp.wait()
  if master_rc or web_rc:raise RuntimeError('Encoder failed')
  for artifact,expected in [(master,b-a),(web,(b-a)//8)]:
   check=json.loads(sp.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=nb_frames','-of','json',str(artifact)]))
   if int(check['streams'][0]['nb_frames'])!=expected:raise RuntimeError('Incomplete encoded segment')
 except BaseException:mp.kill();wp.kill();raise
 (TMP/f'hashes-{a:05}.json').write_text(json.dumps(hashes));return {'a':a,'b':b,'master':str(master),'web':str(web),'hashes':str(TMP/f'hashes-{a:05}.json')}
def stamp(t):return f'00:{int(t)//60:02}:{int(t)%60:02}.{round(t%1*1000):03}'
def source_film():
 try:return SITE/json.loads(CACHE.read_text())['manifest']['video']
 except (OSError,KeyError,ValueError):return None
def probe(path,expected_fps,expected_frames):
 d=json.loads(sp.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)]));v=next(x for x in d['streams'] if x['codec_type']=='video');a=next(x for x in d['streams'] if x['codec_type']=='audio')
 if v['codec_name']!='h264' or (v['width'],v['height'])!=(W,H) or v['r_frame_rate']!=str(expected_fps)+'/1' or int(v['nb_frames'])!=expected_frames or abs(float(d['format']['duration'])-DURATION)>.025 or a['codec_name']!='aac' or int(a['sample_rate'])!=48000 or int(a['channels'])!=2:raise RuntimeError('Film failed delivery specification')
 return {'fps':expected_fps,'frames':expected_frames,'duration':float(d['format']['duration']),'width':W,'height':H,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
def publish():
 verification=probe(TMP/'film.mp4',FPS,DURATION*FPS)
 outdir=SITE/'assets/media';outdir.mkdir(exist_ok=True)
 def put(src,prefix,suffix):
  raw=(TMP/src).read_bytes();name=f'{prefix}.{hashlib.sha256(raw).hexdigest()[:12]}.{suffix}';(outdir/name).write_bytes(raw);return 'assets/media/'+name
 (TMP/'captions.vtt').write_text('WEBVTT\n\n'+'\n\n'.join(f'{stamp(a)} --> {stamp(b)}\n[器乐，无旁白] {s}' for a,b,s in zip(CUTS,CUTS[1:],TITLES))+'\n')
 if frame is None:init_scene()
 frame(25).save(TMP/'poster.jpg',quality=95,subsampling=0)
 m={k:put(src,prefix,suffix) for k,src,prefix,suffix in [('video','film.mp4','intro','mp4'),('poster','poster.jpg','intro-poster','jpg'),('captions','captions.vtt','intro','vtt')]}
 m.update(duration=DURATION,width=W,height=H,fps=FPS,scenes=len(TITLES),voice='无旁白；经授权的录制器乐配乐。',master_fps=MASTER_FPS,master_frames=DURATION*MASTER_FPS)
 (ROOT.parent/'film-manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
 timeline={'version':5,'duration':DURATION,'fps':FPS,'output_frames':DURATION*FPS,'master_fps':MASTER_FPS,'master_frames':DURATION*MASTER_FPS,'speech':False,'procedural_music':False,'gameplay_seconds':2.2,'gameplay_source':[5.5,7.7],'scenes':[{'id':str(i+1),'start':a,'end':b,'text':s} for i,(a,b,s) in enumerate(zip(CUTS,CUTS[1:],TITLES))]}
 (ROOT/'timeline.json').write_text(json.dumps(timeline,ensure_ascii=False,indent=2)+'\n');(outdir/'intro-script.txt').write_text('我把想法，做成作品。\n'+'\n'.join(TITLES)+'\n');(outdir/'CREDITS.md').write_text((ROOT/'credits.md').read_text())
 for pattern,key in [('intro.*.mp4','video'),('intro.*.vtt','captions'),('intro-poster.*.jpg','poster')]:
  for old in outdir.glob(pattern):
   if old!=SITE/m[key]:old.unlink()
 CACHE.write_text(json.dumps({'renderKey':RENDER_KEY,'manifest':m},ensure_ascii=False,indent=2)+'\n');print(json.dumps(m,ensure_ascii=False),flush=True)
if __name__=='__main__':
 import argparse,multiprocessing
 p=argparse.ArgumentParser();p.add_argument('--contact',action='store_true');p.add_argument('--skip-render',action='store_true');args=p.parse_args()
 if not any(vars(args).values()) and CACHE.exists():
  m=json.loads(CACHE.read_text())
  if m.get('renderKey')==RENDER_KEY and all((SITE/m['manifest'].get(k,'missing')).is_file() for k in ['video','poster','captions']):
   (ROOT.parent/'film-manifest.json').write_text(json.dumps(m['manifest'],ensure_ascii=False,indent=2)+'\n');print('Film cache hit');sys.exit()
 (TMP/'game').mkdir(exist_ok=True)
 if not (TMP/'game/0360.jpg').exists():ff(['-i',ROOT/'inputs/game-demo.mp4','-vf','fps=30','-q:v','3',TMP/'game/%04d.jpg'])
 if args.contact:
  init_scene();sheet=Image.new('RGB',(1920,600),(12,16,20));d=ImageDraw.Draw(sheet)
  for i,(a,b) in enumerate(zip(CUTS,CUTS[1:])):
   x=i%4*480;y=i//4*300;sheet.paste(frame((a+b)/2).resize((480,270)),(x,y));d.text((x+8,y+275),f'{a:04.1f}-{b:04.1f}s',fill='white')
  sheet.save(TMP/'contact.jpg',quality=95);print(TMP/'contact.jpg');sys.exit()
 if not args.skip_render:
  from mix_v3 import mix_audio
  report=mix_audio(TMP/'audio-final.m4a',source_video=source_film(),duration=DURATION);print(json.dumps(report),flush=True)
  jobs=[(round(a*MASTER_FPS),round(b*MASTER_FPS)) for a,b in zip(CUTS,CUTS[1:])];parts=[]
  with multiprocessing.get_context('spawn').Pool(int(os.environ.get('FILM_WORKERS','2'))) as pool:
   for result in pool.imap(chunk,jobs):parts.append(result);print('Rendered actual master frames '+str(result['a'])+'..'+str(result['b']),flush=True)
  hashes=[]
  for part in parts:hashes+=json.loads(Path(part['hashes']).read_text())
  for kind,target in [('master','film-master.mp4'),('web','film.mp4')]:
   listing=TMP/f'concat-{kind}.txt';listing.write_text(''.join("file '"+r[kind]+"'\n" for r in parts));ff(['-f','concat','-safe','0','-i',listing,'-i',TMP/'audio-final.m4a','-map','0:v','-map','1:a','-c','copy','-t',DURATION,'-movflags','+faststart',TMP/target])
  checks={'master':probe(TMP/'film-master.mp4',MASTER_FPS,DURATION*MASTER_FPS),'web':probe(TMP/'film.mp4',FPS,DURATION*FPS),'rendered_frames':len(hashes),'unique_pixel_frame_hashes':len(set(hashes)),'frame_hash_sequence_sha256':hashlib.sha256(''.join(hashes).encode()).hexdigest(),'web_shutter_samples':4,'audio':report}
  (TMP/'verification.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2)+'\n');(TMP/'frame-hashes.txt').write_text('\n'.join(hashes)+'\n')
  if len(hashes)!=DURATION*MASTER_FPS or len(set(hashes))<10001:raise RuntimeError('Missing independently rendered master frames')
 publish()
