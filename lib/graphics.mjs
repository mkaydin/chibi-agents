export function graphicsConfiguration(args, environment = {}) {
  const index = args.indexOf('--graphics');
  const mode = args.find(arg => arg.startsWith('--graphics='))?.slice(11)
    || (index >= 0 ? args[index + 1] : null) || environment.COMPANION_GRAPHICS || 'auto';
  if (!['auto', 'nvidia', 'opengl', 'software'].includes(mode)) throw new Error('Graphics mode must be auto, nvidia, opengl, or software');
  const switches = mode === 'auto' ? [] : [
    ['use-gl', 'angle'],
    ['use-angle', mode === 'software' ? 'swiftshader' : 'gl'],
  ];
  return { mode, switches };
}

export function graphicsEnvironment(args, environment = {}) {
  if (graphicsConfiguration(args, environment).mode !== 'nvidia') return { ...environment };
  return { ...environment, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia', __VK_LAYER_NV_optimus: 'NVIDIA_only' };
}
