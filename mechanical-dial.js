(()=> {
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

  class MechanicalDial {
    constructor(input, config={}){
      this.input=input;
      this.values=config.values||[];
      this.format=config.format||(v=>String(v));
      this.sound=config.sound||(()=>{});
      this.major=config.major||(()=>false);
      this.onChange=config.onChange||(()=>{});
      this.index=Math.max(0,this.values.findIndex(v=>Number(v)===Number(input.value)));
      if(this.index<0)this.index=0;
      this.dragging=false;
      this.startX=0;
      this.startOffset=0;
      this.offset=0;
      this.stepPx=config.stepPx||54;
      this.lastSoundIndex=this.index;
      this.build();
      this.syncFromInput();
    }

    build(){
      this.input.classList.add('mechanical-source-hidden');
      this.root=document.createElement('div');
      this.root.className='mechanical-dial';
      this.root.tabIndex=0;
      this.root.setAttribute('role','slider');
      this.root.innerHTML=`
        <div class="mechanical-window">
          <div class="mechanical-tape"></div>
          <span class="mechanical-center"></span>
          <span class="mechanical-glow"></span>
        </div>
        <div class="mechanical-value mono"></div>
      `;
      this.tape=this.root.querySelector('.mechanical-tape');
      this.valueEl=this.root.querySelector('.mechanical-value');
      this.input.insertAdjacentElement('afterend',this.root);

      this.renderTape();
      this.root.addEventListener('pointerdown',e=>this.start(e));
      this.root.addEventListener('pointermove',e=>this.move(e));
      this.root.addEventListener('pointerup',e=>this.end(e));
      this.root.addEventListener('pointercancel',()=>this.cancel());
      this.root.addEventListener('keydown',e=>this.key(e));
      this.input.addEventListener('input',()=>this.syncFromInput());
      this.input.addEventListener('change',()=>this.syncFromInput());
    }

    renderTape(){
      this.tape.innerHTML='';
      const pad=4;
      const all=[];
      for(let i=0;i<pad;i++)all.push(null);
      this.values.forEach(v=>all.push(v));
      for(let i=0;i<pad;i++)all.push(null);

      all.forEach((v,i)=>{
        const el=document.createElement('div');
        el.className='mechanical-tick'+(v!==null&&this.major(v)?' major':'');
        if(v!==null){
          el.dataset.value=String(v);
          el.innerHTML=`<i></i><span class="mono">${this.format(v)}</span>`;
          el.addEventListener('click',e=>{
            e.stopPropagation();
            this.setIndex(this.values.indexOf(v),true,true);
          });
        }else{
          el.classList.add('ghost');
          el.innerHTML='<i></i>';
        }
        this.tape.appendChild(el);
      });
    }

    start(e){
      this.dragging=true;
      this.startX=e.clientX;
      this.startOffset=this.offset;
      this.root.classList.add('dragging');
      this.root.setPointerCapture?.(e.pointerId);
      window.VoidSound?.unlock?.();
    }

    move(e){
      if(!this.dragging)return;
      const dx=e.clientX-this.startX;
      const raw=this.startOffset+dx;
      this.offset=raw;
      this.applyTransform(false);

      const idx=clamp(Math.round(this.index-raw/this.stepPx),0,this.values.length-1);
      if(idx!==this.lastSoundIndex){
        this.lastSoundIndex=idx;
        const v=this.values[idx];
        this.sound(v,this.major(v));
      }
    }

    end(e){
      if(!this.dragging)return;
      this.dragging=false;
      this.root.classList.remove('dragging');
      const dx=e.clientX-this.startX;
      const delta=-Math.round(dx/this.stepPx);
      this.setIndex(clamp(this.index+delta,0,this.values.length-1),true,false);
      this.offset=0;
      this.applyTransform(true);
      this.root.releasePointerCapture?.(e.pointerId);
    }

    cancel(){
      this.dragging=false;
      this.root.classList.remove('dragging');
      this.offset=0;
      this.applyTransform(true);
    }

    key(e){
      if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
      e.preventDefault();
      const next=clamp(this.index+(e.key==='ArrowRight'?1:-1),0,this.values.length-1);
      this.setIndex(next,true,true);
    }

    setIndex(idx,emit=true,playSound=true){
      idx=clamp(idx,0,this.values.length-1);
      if(idx===this.index && !emit){this.renderState();return;}
      this.index=idx;
      const value=this.values[idx];
      this.input.value=String(value);
      if(emit){
        this.input.dispatchEvent(new Event('input',{bubbles:true}));
        this.input.dispatchEvent(new Event('change',{bubbles:true}));
      }
      if(playSound)this.sound(value,this.major(value));
      this.renderState();
    }

    syncFromInput(){
      const val=Number(this.input.value);
      let best=0,dist=Infinity;
      this.values.forEach((v,i)=>{
        const d=Math.abs(Number(v)-val);
        if(d<dist){dist=d;best=i;}
      });
      this.index=best;
      this.lastSoundIndex=best;
      this.renderState();
    }

    renderState(){
      this.valueEl.textContent=this.format(this.values[this.index]);
      this.root.setAttribute('aria-valuenow',String(this.values[this.index]));
      const ticks=[...this.tape.children];
      ticks.forEach(el=>el.classList.remove('selected','near'));
      const actual=this.index+4;
      ticks[actual]?.classList.add('selected');
      ticks[actual-1]?.classList.add('near');
      ticks[actual+1]?.classList.add('near');
      this.offset=0;
      this.applyTransform(true);
    }

    applyTransform(animated){
      const base=-(this.index+4)*this.stepPx;
      const center=(this.root.clientWidth||320)/2-this.stepPx/2;
      this.tape.style.transition=animated?'transform .22s cubic-bezier(.18,.78,.25,1)':'none';
      this.tape.style.transform=`translate3d(${center+base+this.offset}px,0,0)`;
    }
  }

  window.VoidMechanicalDial=MechanicalDial;
})();