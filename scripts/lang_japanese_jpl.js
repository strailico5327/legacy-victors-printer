hexo.extend.tag.register('ljp', function(args, content) {
  return `<span lang="ja">${content.trim()}</span>`;
}, { ends: true });