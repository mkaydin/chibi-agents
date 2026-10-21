// Compatibility for pixi-live2d-display 0.4.0's pre-Cubism-4.2 WebGL renderer.
// Preserve the upstream mask/blend paths; add Core-authored drawable colors.
// Formula: https://docs.live2d.com/en/cubism-sdk-manual/multiply-color-screen-color-web/
export function withDrawableColors(source) {
  if(source.includes('companionTextureColor'))return source;
  let shaderCount=0,textureCount=0;
  const uniforms='uniform vec4 u_companionMultiply;uniform vec4 u_companionScreen;vec4 companionTextureColor(vec4 color){color.rgb*=u_companionMultiply.rgb;color.rgb=color.rgb+u_companionScreen.rgb*color.a-color.rgb*u_companionScreen.rgb;return color;}';
  source=source.replace(/(const fragmentShaderSrc(?:Mask(?:Inverted)?)?PremultipliedAlpha = "precision mediump float;)/g,match=>{shaderCount++;return match+uniforms;});
  source=source.replace(/texture2D\(s_texture0\s*,\s*v_texCoord\)\s*\*\s*u_baseColor/g,()=>{textureCount++;return 'companionTextureColor(texture2D(s_texture0, v_texCoord)) * u_baseColor';});
  const drawIndex='this.setIsCulling(this.getModel().getDrawableCulling(drawableIndex));';
  const baseUniform='this.gl.uniform4f(shaderSet.uniformBaseColorLocation, baseColor.R, baseColor.G, baseColor.B, baseColor.A);';
  if(shaderCount!==3 || textureCount!==3 || !source.includes(drawIndex) || !source.includes(baseUniform))throw new Error('Unsupported Cubism renderer: drawable-color compatibility needs review');
  source=source.replace(drawIndex,drawIndex+'this._companionDrawableIndex=drawableIndex;');
  source=source.replace(baseUniform,baseUniform+`
        const colors=renderer.getModel()._model.drawables;
        const companionColorOffset=renderer._companionDrawableIndex*4;
        shaderSet.companionMultiply ??= this.gl.getUniformLocation(shaderSet.shaderProgram,'u_companionMultiply');
        shaderSet.companionScreen ??= this.gl.getUniformLocation(shaderSet.shaderProgram,'u_companionScreen');
        const multiply=colors.multiplyColors,screen=colors.screenColors;
        this.gl.uniform4f(shaderSet.companionMultiply,multiply?.[companionColorOffset] ?? 1,multiply?.[companionColorOffset+1] ?? 1,multiply?.[companionColorOffset+2] ?? 1,1);
        this.gl.uniform4f(shaderSet.companionScreen,screen?.[companionColorOffset] ?? 0,screen?.[companionColorOffset+1] ?? 0,screen?.[companionColorOffset+2] ?? 0,1);
`);
  return source;
}
