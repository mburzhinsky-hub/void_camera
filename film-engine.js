(()=> {
  const PROFILES={
    'FUJI CLASSIC':{exposure:0.02,contrast:1.10,saturation:.80,temp:.035,tint:-.01,shadows:.035,highlights:-.10,fade:.025,grain:.018,vignette:.10,halation:.018,mono:0},
    'FUJI SOFT':{exposure:.08,contrast:.86,saturation:.78,temp:.025,tint:.015,shadows:.09,highlights:-.16,fade:.055,grain:.014,vignette:.055,halation:.012,mono:0},
    'FUJI STREET':{exposure:-.04,contrast:1.26,saturation:1.10,temp:-.015,tint:.015,shadows:-.055,highlights:-.055,fade:.010,grain:.022,vignette:.14,halation:.010,mono:0},
    'FUJI WARM':{exposure:.03,contrast:1.02,saturation:1.04,temp:.12,tint:.015,shadows:.035,highlights:-.12,fade:.030,grain:.017,vignette:.08,halation:.030,mono:0},
    'FUJI COOL':{exposure:.01,contrast:1.08,saturation:.88,temp:-.11,tint:-.025,shadows:.018,highlights:-.07,fade:.018,grain:.015,vignette:.075,halation:.006,mono:0},
    'FUJI MONO':{exposure:-.015,contrast:1.28,saturation:0,temp:0,tint:0,shadows:-.02,highlights:-.08,fade:.018,grain:.028,vignette:.12,halation:0,mono:1},
    'PORTRAIT 400':{exposure:.07,contrast:.92,saturation:.90,temp:.065,tint:.020,shadows:.07,highlights:-.18,fade:.045,grain:.016,vignette:.06,halation:.018,mono:0},
    'DAYLIGHT 250':{exposure:.035,contrast:.94,saturation:.84,temp:.045,tint:-.008,shadows:.055,highlights:-.18,fade:.035,grain:.017,vignette:.08,halation:.015,mono:0},
    'TUNGSTEN 500':{exposure:-.055,contrast:1.14,saturation:1.00,temp:-.14,tint:.035,shadows:-.01,highlights:-.08,fade:.02,grain:.026,vignette:.14,halation:.060,mono:0},
    'BLEACH':{exposure:-.02,contrast:1.38,saturation:.34,temp:.00,tint:0,shadows:-.05,highlights:-.04,fade:.012,grain:.024,vignette:.13,halation:.004,mono:0}
  };

  const VERT=`
    attribute vec2 a_pos;
    attribute vec2 a_uv;
    varying vec2 v_uv;
    void main(){v_uv=a_uv;gl_Position=vec4(a_pos,0.0,1.0);}
  `;
  const FRAG=`
    precision mediump float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform vec2 u_res;
    uniform float u_time;
    uniform float u_exposure;
    uniform float u_contrast;
    uniform float u_saturation;
    uniform float u_temp;
    uniform float u_tint;
    uniform float u_shadows;
    uniform float u_highlights;
    uniform float u_fade;
    uniform float u_grain;
    uniform float u_vignette;
    uniform float u_halation;
    uniform float u_mono;

    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
    vec3 sat(vec3 c,float s){
      float l=dot(c,vec3(.2126,.7152,.0722));
      return mix(vec3(l),c,s);
    }
    vec3 curve(vec3 c){
      c=(c-.5)*u_contrast+.5;
      float l=dot(c,vec3(.2126,.7152,.0722));
      float sh=(1.0-smoothstep(.0,.42,l))*u_shadows;
      float hi=smoothstep(.58,1.0,l)*u_highlights;
      c+=vec3(sh+hi);
      c=mix(c,vec3(.5),u_fade*(1.0-l)*.7);
      return c;
    }
    void main(){
      vec2 uv=v_uv;
      vec3 c=texture2D(u_tex,uv).rgb;

      if(u_halation>0.001){
        vec2 px=1.0/u_res;
        vec3 a=texture2D(u_tex,uv+vec2(px.x*3.0,0.0)).rgb;
        vec3 b=texture2D(u_tex,uv-vec2(px.x*3.0,0.0)).rgb;
        float hot=max(max(a.r,b.r),c.r);
        float lum=dot(c,vec3(.2126,.7152,.0722));
        float h=smoothstep(.68,1.0,max(hot,lum))*u_halation;
        c+=vec3(h,h*.18,h*.05);
      }

      c*=pow(2.0,u_exposure);
      c.r+=u_temp*.16+u_tint*.04;
      c.b-=u_temp*.16;
      c.g+=u_tint*.035;
      c=curve(c);
      c=sat(c,u_saturation);

      float l=dot(c,vec3(.2126,.7152,.0722));
      if(u_mono>.5)c=vec3(l);

      vec2 q=uv-.5;
      float vig=smoothstep(.28,.73,length(q))*u_vignette;
      c*=1.0-vig;

      float n=hash(gl_FragCoord.xy)-.5;
      c+=n*u_grain*(.45+.55*(1.0-l));

      gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);
    }
  `;

  function shader(gl,type,src){
    const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'shader compile failed');
    return s;
  }

  class FilmEngine{
    constructor(video,canvas){
      this.video=video;this.canvas=canvas;this.profileName='FUJI CLASSIC';
      this.controls={iso:100,shutterIndex:3,wb:5200,ev:0,hdr:false};
      this.running=false;this.ready=false;
      try{this.init()}catch(e){console.warn('FilmEngine fallback',e);this.failed=true}
    }
    init(){
      const gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true})||this.canvas.getContext('experimental-webgl',{alpha:false,preserveDrawingBuffer:true});
      if(!gl)throw new Error('WebGL unavailable');
      this.gl=gl;
      const p=gl.createProgram();
      gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,VERT));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(p);
      if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'program link failed');
      this.program=p;gl.useProgram(p);
      const data=new Float32Array([-1,-1,0,1, 1,-1,1,1, -1,1,0,0, 1,1,1,0]);
      const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
      const ap=gl.getAttribLocation(p,'a_pos'),au=gl.getAttribLocation(p,'a_uv');
      gl.enableVertexAttribArray(ap);gl.vertexAttribPointer(ap,2,gl.FLOAT,false,16,0);
      gl.enableVertexAttribArray(au);gl.vertexAttribPointer(au,2,gl.FLOAT,false,16,8);
      this.tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      this.uniforms={};
      ['u_res','u_time','u_exposure','u_contrast','u_saturation','u_temp','u_tint','u_shadows','u_highlights','u_fade','u_grain','u_vignette','u_halation','u_mono'].forEach(n=>this.uniforms[n]=gl.getUniformLocation(p,n));
      gl.uniform1i(gl.getUniformLocation(p,'u_tex'),0);
      this.ready=true;
    }
    setLook(name){if(PROFILES[name])this.profileName=name}
    setControls(patch){Object.assign(this.controls,patch)}
    params(){
      const p={...(PROFILES[this.profileName]||PROFILES['FUJI CLASSIC'])};
      const iso=Math.max(50,this.controls.iso||100);
      const isoEV=Math.log2(iso/100)*.06;
      const shutter=[-.16,-.10,-.05,0,.07,.13,.18][this.controls.shutterIndex||3]||0;
      const wb=((this.controls.wb||5200)-5200)/3800;
      p.exposure+=(this.controls.ev||0)*.16+isoEV+shutter;
      p.temp+=wb*.16;
      if(this.controls.hdr){p.contrast*=.90;p.highlights-=.10;p.shadows+=.06;p.saturation*=1.03}
      return p;
    }
    resize(maxW=1280){
      const vw=this.video.videoWidth||720,vh=this.video.videoHeight||1280;
      const scale=Math.min(1,maxW/vw);
      const w=Math.max(2,Math.round(vw*scale)),h=Math.max(2,Math.round(vh*scale));
      if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h}
      this.gl.viewport(0,0,w,h);
    }
    render(maxW=1280){
      if(!this.ready||this.video.readyState<2)return;
      const gl=this.gl;this.resize(maxW);
      gl.useProgram(this.program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.tex);
      try{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.video)}catch{return}
      const p=this.params(),u=this.uniforms;
      gl.uniform2f(u.u_res,this.canvas.width,this.canvas.height);
      gl.uniform1f(u.u_time,performance.now()/1000);
      gl.uniform1f(u.u_exposure,p.exposure);gl.uniform1f(u.u_contrast,p.contrast);gl.uniform1f(u.u_saturation,p.saturation);
      gl.uniform1f(u.u_temp,p.temp);gl.uniform1f(u.u_tint,p.tint);gl.uniform1f(u.u_shadows,p.shadows);gl.uniform1f(u.u_highlights,p.highlights);
      gl.uniform1f(u.u_fade,p.fade);gl.uniform1f(u.u_grain,p.grain);gl.uniform1f(u.u_vignette,p.vignette);gl.uniform1f(u.u_halation,p.halation);gl.uniform1f(u.u_mono,p.mono);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    }
    start(){
      if(this.running||this.failed)return;this.running=true;
      const loop=()=>{if(!this.running)return;this.render();this.raf=requestAnimationFrame(loop)};loop();
    }
    stop(){this.running=false;cancelAnimationFrame(this.raf)}
    captureTo(target,maxW=2400){
      if(!this.ready)return false;
      const oldW=this.canvas.width,oldH=this.canvas.height;
      this.render(maxW);
      target.width=this.canvas.width;target.height=this.canvas.height;
      const c=target.getContext('2d');c.drawImage(this.canvas,0,0);
      if(oldW&&oldH){this.canvas.width=oldW;this.canvas.height=oldH;this.gl.viewport(0,0,oldW,oldH)}
      return true;
    }
  }

  window.VoidFilmProfiles=PROFILES;
  window.VoidFilmEngine=FilmEngine;
})();