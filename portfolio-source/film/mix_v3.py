"""Licensed recorded soundtrack; no generated tones or transition-noise layer."""
from pathlib import Path
import os,json,subprocess as sp,re,hashlib

def run(args):return sp.run(['ffmpeg','-y','-hide_banner',*map(str,args)],capture_output=True,check=True)
def measure(path):
 r=run(['-i',path,'-af','loudnorm=I=-14:TP=-2.8:LRA=9:print_format=json','-f','null','-'])
 return json.loads(re.findall(r'\{\s*"input_i".*?\}',r.stderr.decode(),re.S)[-1])
def packet_hash(path):
 r=run(['-v','error','-i',path,'-map','0:a:0','-c:a','copy','-f','adts','-'])
 return hashlib.sha256(r.stdout).hexdigest()
def mix_audio(out_path,source_video=None,duration=24):
 out_path=Path(out_path);local=os.environ.get('FILM_SCORE_FILE')
 if local:
  source=Path(local);m=measure(source)
  af='loudnorm=I=-14:TP=-2.8:LRA=9:linear=true:'+':'.join(f'{k}={m[v]}' for k,v in [('measured_I','input_i'),('measured_TP','input_tp'),('measured_LRA','input_lra'),('measured_thresh','input_thresh'),('offset','target_offset')])
  run(['-v','error','-i',source,'-af',af,'-ar','48000','-ac','2','-t',duration,'-c:a','aac','-b:a','256k',out_path])
 else:
  if source_video is None or not Path(source_video).exists():raise RuntimeError('Current synchronized licensed film is required to restore its soundtrack')
  run(['-v','error','-i',source_video,'-map','0:a:0','-c:a','copy','-t',duration,out_path])
  expected=json.loads((Path(__file__).parent/'inputs/score-license.json').read_text()).get('edited_aac_sha256')
  if not expected or packet_hash(out_path)!=expected:raise RuntimeError('The synchronized source does not carry the current licensed soundtrack')
 final=measure(out_path)
 if abs(float(final['input_i'])+14)>1 or float(final['input_tp'])>-.9:raise RuntimeError('Encoded soundtrack failed loudness/peak validation')
 report={'speech':False,'procedural_music':False,'transition_noise':False,'stock_asset_id':'511566807','title':'The Signs Of Progress','duration':duration,'edited_aac_sha256':packet_hash(out_path),'encoded_final':final}
 out_path.with_suffix('.json').write_text(json.dumps(report,indent=2)+'\n');return report
