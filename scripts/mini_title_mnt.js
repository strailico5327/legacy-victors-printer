hexo.extend.tag.register('mnt', function(args, content) {
  return `<div class="mini-title">${content.trim()}</div>`;
}, { ends: true });