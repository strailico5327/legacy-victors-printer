hexo.extend.tag.register('ral', function(args, content) {
  return `<span style="float: right;">${content.trim()}</span>`;
}, { ends: true });