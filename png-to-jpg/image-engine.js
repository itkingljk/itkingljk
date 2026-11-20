'use strict';
// Images never leave this browser. Only the output blob survives each operation.
window.ImageTools = (() => {
  const MAX_BYTES = 20 * 1024 * 1024;
  function targetBytes(value, unit) {
    const amount = Number(value), factor = unit === 'MB' ? 1048576 : 1024;
    const bytes = Math.floor(amount * factor);
    if (!Number.isFinite(amount) || amount <= 0 || bytes < 1024 || bytes > MAX_BYTES) {
      throw new Error('目标大小需在 1 KB 到 20 MB 之间');
    }
    return bytes;
  }
  async function inspect(file, mode) {
    if (file.size > MAX_BYTES) throw new Error('超过每张 20 MB 的限制');
    const b = new Uint8Array(await file.slice(0, 24).arrayBuffer());
    const png = b.length >= 24 && [137,80,78,71,13,10,26,10].every((n,i) => b[i] === n);
    const jpg = b[0] === 255 && b[1] === 216 && b[2] === 255;
    const webp = String.fromCharCode(...b.slice(0,4)) === 'RIFF' && String.fromCharCode(...b.slice(8,12)) === 'WEBP';
    if (mode === 'convert' ? !png : !png && !jpg && !webp) throw new Error(mode === 'convert' ? '请选择有效的 PNG 图片' : '请选择有效的 PNG、JPG 或 WebP 图片');
    if (png) {
      const v = new DataView(b.buffer);
      checkSize(v.getUint32(16), v.getUint32(20));
    }
    return {type: png ? 'image/png' : jpg ? 'image/jpeg' : 'image/webp', ext: png ? 'png' : jpg ? 'jpg' : 'webp'};
  }
  function checkSize(w,h) {
    if (!w || !h || w*h > 40000000 || w > 16384 || h > 16384) throw new Error('图片尺寸过大，最多 4000 万像素且单边不超过 16384');
  }
  async function transform(file, options) {
    const format = await inspect(file, options.mode);
    let source, url, canvas;
    try {
      if (typeof createImageBitmap === 'function') source = await createImageBitmap(file);
      else {url = URL.createObjectURL(file); source = new Image(); source.src = url; await source.decode();}
      const originalWidth = source.width || source.naturalWidth, originalHeight = source.height || source.naturalHeight;
      checkSize(originalWidth, originalHeight);
      const base = {originalWidth, originalHeight};
      // Already-small files keep their format and pixels, avoiding accidental enlargement.
      if (options.mode === 'compress' && file.size <= options.target) {
        return {...base, blob:file.slice(0,file.size,format.type), width:originalWidth, height:originalHeight, ext:format.ext, note:'原图已满足目标，保留原格式与画质'};
      }
      canvas = document.createElement('canvas');
      let width = originalWidth, height = originalHeight;
      const draw = () => {
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('浏览器无法创建画布');
        ctx.fillStyle = '#fff'; ctx.fillRect(0,0,width,height);
        ctx.drawImage(source,0,0,width,height);
      };
      const encode = quality => new Promise((resolve,reject) => canvas.toBlob(blob => {
        if (!blob || blob.type !== 'image/jpeg') reject(new Error('浏览器无法生成 JPG 图片'));
        else resolve(blob);
      },'image/jpeg',quality));
      draw();
      if (options.mode === 'convert') return {...base,blob:await encode(options.quality),width,height,ext:'jpg'};
      for (let scale = 0; scale < 16; scale++) {
        let high = await encode(.95);
        if (high.size <= options.target) return {...base,blob:high,width,height,ext:'jpg',note:width===originalWidth&&height===originalHeight?'已达到目标大小':'已达到目标大小，尺寸已缩小'};
        let best = await encode(.08);
        if (best.size <= options.target) {
          let lo=.08, hi=.95;
          for (let step=0;step<9;step++) {
            const mid=(lo+hi)/2, blob=await encode(mid);
            if(blob.size<=options.target){best=blob;lo=mid;}else hi=mid;
          }
          return {...base,blob:best,width,height,ext:'jpg',note:width===originalWidth&&height===originalHeight?'已达到目标大小':'已达到目标大小，尺寸已缩小'};
        }
        if(width===1&&height===1)break;
        const factor=Math.max(.1,Math.min(.85,Math.sqrt(options.target/best.size)*.9));
        width=Math.max(1,Math.floor(width*factor)); height=Math.max(1,Math.floor(height*factor)); draw();
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      throw new Error('目标大小过小，无法生成符合限制的 JPG，请提高目标');
    } finally {
      source?.close?.();
      if (source instanceof HTMLImageElement) source.src='';
      if(url)URL.revokeObjectURL(url);
      if(canvas){canvas.width=0;canvas.height=0;}
    }
  }
  return {targetBytes, transform};
})();
