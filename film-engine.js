(()=> {
  /*
   * VOID Film Engine 2
   * Profiles are intentionally scene-specific rather than simple global filters.
   * Every look controls tone, split colour, vibrance, skin protection, grain,
   * halation, highlight shoulder and black density independently.
   */
  const PROFILES={
    'VOID CLASSIC':{
      exposure:.01,contrast:1.055,saturation:.90,vibrance:.08,temp:.018,tint:.000,green:0,
      shadows:.030,highlights:-.105,shadowTemp:-.018,highlightTemp:.024,
      black:.008,shoulder:.20,fade:.022,skin:.38,grain:.014,grainScale:1.15,vignette:.060,halation:.012,mono:0
    },
    'NOIR CITY':{
      exposure:-.095,contrast:1.235,saturation:.56,vibrance:.025,temp:-.015,tint:.018,green:-.008,
      shadows:-.075,highlights:-.085,shadowTemp:-.090,highlightTemp:.038,
      black:.042,shoulder:.13,fade:.006,skin:.12,grain:.030,grainScale:.86,vignette:.165,halation:.014,mono:0
    },
    'COLD CINEMA':{
      exposure:-.030,contrast:1.135,saturation:.73,vibrance:.045,temp:-.070,tint:-.008,green:.010,
      shadows:-.020,highlights:-.145,shadowTemp:-.120,highlightTemp:-.025,
      black:.020,shoulder:.29,fade:.018,skin:.48,grain:.021,grainScale:1.05,vignette:.095,halation:.009,mono:0
    },
    'CINEMA 25':{
      exposure:-.020,contrast:1.155,saturation:.84,vibrance:.070,temp:.030,tint:-.012,green:.016,
      shadows:-.042,highlights:-.125,shadowTemp:-.070,highlightTemp:.075,
      black:.025,shoulder:.26,fade:.015,skin:.52,grain:.023,grainScale:.98,vignette:.095,halation:.021,mono:0
    },
    'SKIN CINEMA':{
      exposure:.042,contrast:1.045,saturation:.91,vibrance:.040,temp:.048,tint:.015,green:-.004,
      shadows:.040,highlights:-.185,shadowTemp:-.025,highlightTemp:.065,
      black:.004,shoulder:.38,fade:.032,skin:.82,grain:.012,grainScale:1.25,vignette:.045,halation:.018,mono:0
    },
    'NEON NIGHT':{
      exposure:-.080,contrast:1.255,saturation:1.12,vibrance:.22,temp:-.055,tint:.070,green:-.030,
      shadows:-.080,highlights:-.055,shadowTemp:-.135,highlightTemp:.050,
      black:.045,shoulder:.12,fade:.004,skin:.18,grain:.028,grainScale:.82,vignette:.175,halation:.082,mono:0
    },
    'RAIN GRADIENT':{
      exposure:-.040,contrast:1.175,saturation:.96,vibrance:.16,temp:-.035,tint:.055,green:-.012,
      shadows:-.028,highlights:-.105,shadowTemp:-.110,highlightTemp:.085,
      black:.020,shoulder:.21,fade:.018,skin:.22,grain:.024,grainScale:.93,vignette:.115,halation:.050,mono:0
    },
    'AUTO NIGHT':{
      exposure:-.115,contrast:1.285,saturation:.86,vibrance:.095,temp:.040,tint:.008,green:-.004,
      shadows:-.095,highlights:-.040,shadowTemp:-.075,highlightTemp:.105,
      black:.055,shoulder:.10,fade:.003,skin:.14,grain:.030,grainScale:.80,vignette:.190,halation:.070,mono:0
    },
    'ICE DAY':{
      exposure:.045,contrast:1.015,saturation:.88,vibrance:.055,temp:-.045,tint:.004,green:.004,
      shadows:.045,highlights:-.145,shadowTemp:-.080,highlightTemp:.018,
      black:.000,shoulder:.31,fade:.026,skin:.55,grain:.010,grainScale:1.40,vignette:.040,halation:.006,mono:0
    },
    'CYAN WINTER':{
      exposure:-.020,contrast:1.145,saturation:.66,vibrance:.035,temp:-.120,tint:-.018,green:.028,
      shadows:-.050,highlights:-.095,shadowTemp:-.175,highlightTemp:-.045,
      black:.028,shoulder:.24,fade:.010,skin:.36,grain:.018,grainScale:1.12,vignette:.100,halation:.003,mono:0
    },
    'SNOW DAY':{
      exposure:.105,contrast:1.025,saturation:.84,vibrance:.035,temp:-.035,tint:.006,green:0,
      shadows:.070,highlights:-.245,shadowTemp:-.065,highlightTemp:.030,
      black:0,shoulder:.46,fade:.034,skin:.72,grain:.008,grainScale:1.55,vignette:.028,halation:.004,mono:0
    },
    'DEEP FOREST':{
      exposure:-.055,contrast:1.165,saturation:.80,vibrance:.075,temp:-.025,tint:-.018,green:.030,
      shadows:-.060,highlights:-.100,shadowTemp:-.055,highlightTemp:.055,
      black:.034,shoulder:.19,fade:.010,skin:.28,grain:.022,grainScale:1.00,vignette:.135,halation:.005,mono:0
    },
    'NATURE SOFT':{
      exposure:.035,contrast:.945,saturation:.86,vibrance:.050,temp:.010,tint:-.010,green:.006,
      shadows:.078,highlights:-.175,shadowTemp:-.020,highlightTemp:.030,
      black:0,shoulder:.36,fade:.045,skin:.46,grain:.010,grainScale:1.42,vignette:.040,halation:.006,mono:0
    },
    'AQUA SUMMER':{
      exposure:.060,contrast:1.015,saturation:1.02,vibrance:.15,temp:-.020,tint:-.010,green:.015,
      shadows:.035,highlights:-.155,shadowTemp:-.070,highlightTemp:.055,
      black:0,shoulder:.34,fade:.018,skin:.58,grain:.008,grainScale:1.60,vignette:.030,halation:.009,mono:0
    },
    'PASTEL GLOW':{
      exposure:.095,contrast:.855,saturation:.80,vibrance:.020,temp:.060,tint:.018,green:-.005,
      shadows:.115,highlights:-.245,shadowTemp:.010,highlightTemp:.075,
      black:0,shoulder:.48,fade:.075,skin:.84,grain:.007,grainScale:1.75,vignette:.025,halation:.020,mono:0
    },
    'WARM NATURAL':{
      exposure:.042,contrast:.975,saturation:.92,vibrance:.035,temp:.072,tint:.010,green:-.002,
      shadows:.052,highlights:-.175,shadowTemp:-.010,highlightTemp:.075,
      black:.002,shoulder:.37,fade:.030,skin:.80,grain:.009,grainScale:1.50,vignette:.035,halation:.014,mono:0
    },
    'AUTUMN GOLD':{
      exposure:.030,contrast:1.005,saturation:.96,vibrance:.095,temp:.105,tint:-.010,green:.010,
      shadows:.035,highlights:-.145,shadowTemp:.020,highlightTemp:.115,
      black:.008,shoulder:.29,fade:.030,skin:.50,grain:.012,grainScale:1.30,vignette:.055,halation:.015,mono:0
    },
    'CHROME FILM':{
      exposure:.000,contrast:1.105,saturation:.76,vibrance:.035,temp:.018,tint:.018,green:.012,
      shadows:-.010,highlights:-.125,shadowTemp:-.085,highlightTemp:.045,
      black:.018,shoulder:.27,fade:.020,skin:.40,grain:.020,grainScale:1.02,vignette:.075,halation:.010,mono:0
    },
    'FUJI MONO':{
      exposure:-.010,contrast:1.245,saturation:0,vibrance:0,temp:0,tint:0,green:0,
      shadows:-.025,highlights:-.115,shadowTemp:0,highlightTemp:0,
      black:.026,shoulder:.30,fade:.016,skin:0,grain:.032,grainScale:.88,vignette:.115,halation:0,mono:1
    },
    'BLEACH':{
      exposure:-.028,contrast:1.335,saturation:.28,vibrance:.010,temp:-.005,tint:.004,green:.004,
      shadows:-.060,highlights:-.055,shadowTemp:-.045,highlightTemp:.045,
      black:.040,shoulder:.14,fade:.008,skin:.16,grain:.028,grainScale:.92,vignette:.125,halation:.004,mono:0
    }
  };

  const VERT=`
    attribute vec2 a_pos;
    attribute vec2 a_uv;
    varying vec2 v_uv;
    void main(){v_uv=a_uv;gl_Position=vec4(a_pos,0.0,1.0);}
  `;

  const FRAG=`
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform vec2 u_res;
    uniform float u_time;
    uniform float u_exposure;
    uniform float u_contrast;
    uniform float u_saturation;
    uniform float u_vibrance;
    uniform float u_temp;
    uniform float u_tint;
    uniform float u_green;
    uniform float u_shadows;
    uniform float u_highlights;
    uniform float u_shadowTemp;
    uniform float u_highlightTemp;
    uniform float u_black;
    uniform float u_shoulder;
    uniform float u_fade;
    uniform float u_skin;
    uniform float u_grain;
    uniform float u_grainScale;
    uniform float u_vignette;
    uniform float u_halation;
    uniform float u_mono;

    float hash(vec2 p){
      vec2 q=floor(p/max(.35,u_grainScale));
      return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453123);
    }
    float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
    vec3 sat(vec3 c,float s){
      float l=luma(c);
      return mix(vec3(l),c,s);
    }
    float chroma(vec3 c){
      float mx=max(max(c.r,c.g),c.b);
      float mn=min(min(c.r,c.g),c.b);
      return mx-mn;
    }
    float skinMask(vec3 c){
      float r=c.r,g=c.g,b=c.b;
      float warm=smoothstep(.015,.16,r-b);
      float rg=1.0-smoothstep(.18,.42,abs(r-g));
      float gb=1.0-smoothstep(.10,.34,abs(g-b));
      float lum=smoothstep(.10,.26,luma(c))*(1.0-smoothstep(.82,1.0,luma(c)));
      return clamp(warm*rg*gb*lum,0.0,1.0);
    }
    vec3 toneCurve(vec3 c){
      c=(c-.5)*u_contrast+.5;
      float l=luma(c);
      float sh=(1.0-smoothstep(.04,.44,l))*u_shadows;
      float hi=smoothstep(.56,.98,l)*u_highlights;
      c+=vec3(sh+hi);

      if(u_black>0.0){
        c=max(c-vec3(u_black),0.0)/max(.01,1.0-u_black);
      }

      // Soft film shoulder: compress only the upper tonal range.
      float shoulderMask=smoothstep(.54,1.0,luma(c));
      vec3 rolled=1.0-exp(-max(c,0.0)*1.34);
      rolled/=1.0-exp(-vec3(1.34));
      c=mix(c,rolled,shoulderMask*u_shoulder);

      c=mix(c,vec3(.5),u_fade*(1.0-luma(c))*.72);
      return c;
    }

    void main(){
      vec2 uv=v_uv;
      vec3 src=texture2D(u_tex,uv).rgb;
      vec3 c=src;

      // Red-emulsion glow around hard highlights.
      if(u_halation>0.001){
        vec2 px=1.0/u_res;
        vec3 a=texture2D(u_tex,uv+vec2(px.x*3.0,0.0)).rgb;
        vec3 b=texture2D(u_tex,uv-vec2(px.x*3.0,0.0)).rgb;
        vec3 d=texture2D(u_tex,uv+vec2(0.0,px.y*2.0)).rgb;
        float hot=max(max(max(a.r,b.r),d.r),c.r);
        float lum=luma(c);
        float h=smoothstep(.69,1.0,max(hot,lum))*u_halation;
        c+=vec3(h,h*.22,h*.055);
      }

      c*=pow(2.0,u_exposure);

      // Global balance.
      c.r+=u_temp*.16+u_tint*.035;
      c.b-=u_temp*.16;
      c.g+=u_tint*.030+u_green*.070;
      c.r-=u_green*.020;
      c.b-=u_green*.010;

      c=toneCurve(c);

      // Split temperature gives each look a different shadow/highlight response.
      float lum=luma(c);
      float sm=1.0-smoothstep(.20,.58,lum);
      float hm=smoothstep(.48,.88,lum);
      c.r+=u_shadowTemp*.075*sm + u_highlightTemp*.075*hm;
      c.b-=u_shadowTemp*.090*sm + u_highlightTemp*.090*hm;

      // Vibrance lifts quiet colours without making already-saturated colours radioactive.
      float chr=clamp(chroma(c)*2.0,0.0,1.0);
      float vib=1.0+u_vibrance*(1.0-chr);
      vec3 graded=sat(c,u_saturation*vib);

      // Preserve plausible skin from the strongest colour biases.
      float smask=skinMask(src)*u_skin;
      vec3 skinBase=src*pow(2.0,u_exposure);
      skinBase=(skinBase-.5)*mix(1.0,u_contrast,.38)+.5;
      skinBase.r+=u_temp*.050;
      skinBase.b-=u_temp*.035;
      c=mix(graded,skinBase,smask*.62);

      float l=luma(c);
      if(u_mono>.5)c=vec3(l);

      vec2 q=uv-.5;
      float vig=smoothstep(.30,.73,length(q))*u_vignette;
      c*=1.0-vig;

      // Stable film grain, stronger in shadows and midtones.
      float n=hash(gl_FragCoord.xy)-.5;
      c+=n*u_grain*(.35+.65*(1.0-l));

      gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);
    }
  `;

  function shader(gl,type,src){
    const s=gl.createShader(type);
    gl.shaderSource(s,src);
    gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'shader compile failed');
    return s;
  }

  class FilmEngine{
    constructor(video,canvas){
      this.video=video;
      this.canvas=canvas;
      this.profileName='VOID CLASSIC';
      this.controls={iso:100,shutterIndex:3,wb:5200,ev:0,hdr:false};
      this.running=false;
      this.ready=false;
      try{this.init()}catch(e){console.warn('FilmEngine fallback',e);this.failed=true}
    }

    init(){
      const gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true})||
               this.canvas.getContext('experimental-webgl',{alpha:false,preserveDrawingBuffer:true});
      if(!gl)throw new Error('WebGL unavailable');
      this.gl=gl;

      const p=gl.createProgram();
      gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,VERT));
      gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,FRAG));
      gl.linkProgram(p);
      if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'program link failed');
      this.program=p;
      gl.useProgram(p);

      const data=new Float32Array([-1,-1,0,1, 1,-1,1,1, -1,1,0,0, 1,1,1,0]);
      const buf=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,buf);
      gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
      const ap=gl.getAttribLocation(p,'a_pos'),au=gl.getAttribLocation(p,'a_uv');
      gl.enableVertexAttribArray(ap);gl.vertexAttribPointer(ap,2,gl.FLOAT,false,16,0);
      gl.enableVertexAttribArray(au);gl.vertexAttribPointer(au,2,gl.FLOAT,false,16,8);

      this.tex=gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D,this.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);

      this.uniforms={};
      [
        'u_res','u_time','u_exposure','u_contrast','u_saturation','u_vibrance','u_temp','u_tint','u_green',
        'u_shadows','u_highlights','u_shadowTemp','u_highlightTemp','u_black','u_shoulder','u_fade','u_skin',
        'u_grain','u_grainScale','u_vignette','u_halation','u_mono'
      ].forEach(n=>this.uniforms[n]=gl.getUniformLocation(p,n));

      gl.uniform1i(gl.getUniformLocation(p,'u_tex'),0);
      this.ready=true;
    }

    setLook(name){if(PROFILES[name])this.profileName=name}
    setControls(patch){Object.assign(this.controls,patch)}

    params(){
      const p={...(PROFILES[this.profileName]||PROFILES['VOID CLASSIC'])};
      const iso=Math.max(50,this.controls.iso||100);
      // Preview exposure response is intentionally restrained: manual ISO should not destroy the look.
      const isoEV=Math.log2(iso/100)*.038;
      const shutter=[-.12,-.075,-.035,0,.045,.085,.12][this.controls.shutterIndex||3]||0;
      const wb=((this.controls.wb||5200)-5200)/3800;

      p.exposure+=(this.controls.ev||0)*.145+isoEV+shutter;
      p.temp+=wb*.125;

      if(this.controls.hdr){
        p.contrast*=.92;
        p.highlights-=.075;
        p.shadows+=.045;
        p.shoulder=Math.min(.60,p.shoulder+.08);
        p.saturation*=1.015;
      }
      return p;
    }

    resize(maxW=1280){
      const vw=this.video.videoWidth||720,vh=this.video.videoHeight||1280;
      const scale=Math.min(1,maxW/vw);
      const w=Math.max(2,Math.round(vw*scale)),h=Math.max(2,Math.round(vh*scale));
      if(this.canvas.width!==w||this.canvas.height!==h){
        this.canvas.width=w;
        this.canvas.height=h;
      }
      this.gl.viewport(0,0,w,h);
    }

    render(maxW=1280){
      if(!this.ready||this.video.readyState<2)return;
      const gl=this.gl;
      this.resize(maxW);
      gl.useProgram(this.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D,this.tex);
      try{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.video)}catch{return}

      const p=this.params(),u=this.uniforms;
      gl.uniform2f(u.u_res,this.canvas.width,this.canvas.height);
      gl.uniform1f(u.u_time,performance.now()/1000);
      gl.uniform1f(u.u_exposure,p.exposure);
      gl.uniform1f(u.u_contrast,p.contrast);
      gl.uniform1f(u.u_saturation,p.saturation);
      gl.uniform1f(u.u_vibrance,p.vibrance);
      gl.uniform1f(u.u_temp,p.temp);
      gl.uniform1f(u.u_tint,p.tint);
      gl.uniform1f(u.u_green,p.green);
      gl.uniform1f(u.u_shadows,p.shadows);
      gl.uniform1f(u.u_highlights,p.highlights);
      gl.uniform1f(u.u_shadowTemp,p.shadowTemp);
      gl.uniform1f(u.u_highlightTemp,p.highlightTemp);
      gl.uniform1f(u.u_black,p.black);
      gl.uniform1f(u.u_shoulder,p.shoulder);
      gl.uniform1f(u.u_fade,p.fade);
      gl.uniform1f(u.u_skin,p.skin);
      gl.uniform1f(u.u_grain,p.grain);
      gl.uniform1f(u.u_grainScale,p.grainScale);
      gl.uniform1f(u.u_vignette,p.vignette);
      gl.uniform1f(u.u_halation,p.halation);
      gl.uniform1f(u.u_mono,p.mono);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    }

    start(){
      if(this.running||this.failed)return;
      this.running=true;
      const loop=()=>{
        if(!this.running)return;
        this.render();
        this.raf=requestAnimationFrame(loop);
      };
      loop();
    }

    stop(){
      this.running=false;
      cancelAnimationFrame(this.raf);
    }

    captureTo(target,maxW=2400){
      if(!this.ready)return false;
      const oldW=this.canvas.width,oldH=this.canvas.height;
      this.render(maxW);
      target.width=this.canvas.width;
      target.height=this.canvas.height;
      const c=target.getContext('2d');
      c.drawImage(this.canvas,0,0);
      if(oldW&&oldH){
        this.canvas.width=oldW;
        this.canvas.height=oldH;
        this.gl.viewport(0,0,oldW,oldH);
      }
      return true;
    }
  }

  window.VoidFilmProfiles=PROFILES;
  window.VoidFilmEngine=FilmEngine;
})();