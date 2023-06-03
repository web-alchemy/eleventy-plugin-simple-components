const fs = require('node:fs');
const path = require('node:path');
const Nunjucks = require('nunjucks');
const { parseHTML } = require('linkedom');

class FileContentCache extends Map {
  get(filePath) {
    let content = super.get(filePath);

    if (content) {
      return content;
    }

    content = (() => {
      try {
        return fs.readFileSync(filePath, 'utf-8');
      } catch {
        return '';
      }
    })();

    super.set(filePath, content);

    return content;
  }
}

module.exports = function(eleventyConfig, userOptions = {}) {
  const basePath = eleventyConfig.dir.input;
  const includesPath = path.join(basePath, eleventyConfig.dir.includes);
  const layoutsPaths = path.join(basePath, eleventyConfig.dir?.layouts ?? eleventyConfig.dir.includes);

  const pathToComponent = userOptions.pathToComponent
    ?? ((name, ext = '.njk') => path.join(includesPath, 'components', name, name + ext));

  /** @type {Map<string, Set<string>>} */
  const pageComponentsMap = new Map();
  const templateCache = new FileContentCache();
  const stylesCache = new FileContentCache();
  const scriptsCache = new FileContentCache();

  const nunjucksEnvironment = new Nunjucks.Environment(
    new Nunjucks.FileSystemLoader(includesPath),
    // new Nunjucks.FileSystemLoader(layoutsPaths)
  );

  eleventyConfig.on('eleventy.before', () => {
    for (const map of [pageComponentsMap, templateCache, stylesCache, scriptsCache]) {
      map.clear();
    }
  });

  eleventyConfig.setLibrary('njk', nunjucksEnvironment);

  // let currentSlots = {};

  // eleventyConfig.addPairedShortcode('slot', function (content, name) {
  //   currentSlots[name] = content;
  //   return '';
  // });

  eleventyConfig.addPairedShortcode('component', function (content, name, props = {}) {
    try {
      const context = this.page
        ? this
        : this.ctx?.$eleventyContext;

      const pageUrl = context.page?.url;
      if (pageUrl) {
        if (!pageComponentsMap.has(pageUrl)) {
          pageComponentsMap.set(pageUrl, new Set());
        }
        pageComponentsMap.get(pageUrl).add(name);
      }

      const templateData = {}
      templateData.$eleventyContext = context;
      templateData.content = content;
      templateData.$props = props;
      // props.$slots = Object.assign({ main: content }, currentSlots);

      const componentSource = templateCache.get(pathToComponent(name, '.njk'));

      const html = nunjucksEnvironment.renderString(componentSource, templateData);
      const result = new Nunjucks.runtime.SafeString(html);
      return result;
    } finally {
      // currentSlots = {};
    }
  });

  eleventyConfig.addTransform('__inject-assets__', function (content) {
    if (!content) {
      return content;
    }

    if (!this.page?.outputPath?.endsWith?.('.html')) {
      return content;
    }

    const components = pageComponentsMap.get(this.page.url);

    if (!components) {
      return content;
    }

    let stylesContent = '';
    let scriptsContent = '';
    for (const componentName of components) {
      stylesContent += stylesCache.get(pathToComponent(componentName, '.css'));
      scriptsContent += stylesCache.get(pathToComponent(componentName, '.js'));
    }

    const DOM = parseHTML(content);

    const styleElement = DOM.document.createElement('style');
    styleElement.textContent = stylesContent;
    DOM.document.head.appendChild(styleElement);

    const scriptElement = DOM.document.createElement('script');
    scriptElement.textContent = scriptsContent;
    DOM.document.body.appendChild(scriptElement);

    return DOM.document.toString();
  });
}