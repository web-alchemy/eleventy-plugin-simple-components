const fs = require('node:fs');
const path = require('node:path');
const Nunjucks = require('nunjucks');
const { parseHTML } = require('linkedom');
const lightningcss = require('lightningcss');
const swc = require('@swc/core');

const isProd = process.env.NODE_ENV === 'production';

function transformStyles(code) {
  const result = lightningcss.transform({
    minify: true,
    code: new TextEncoder().encode(code)
  })
  return result.code
}

function transformScripts(code) {
  const result = swc.transformSync(code, {
    minify: true
  });
  return result.code;
}

class Cache extends Map {
  getValueByKey(key) {
    return this.get(key);
  }

  get(key) {
    if (!super.has(key)) {
      const value = this.getValueByKey(key);
      super.set(key, value);
    }
    return super.get(key);
  }
}

class FileContentCache extends Cache {
  getValueByKey(key) {
    try {
      return fs.readFileSync(key, 'utf-8');
    } catch {
      return '';
    }
  }
}

class PageComponentsCache extends Cache {
  constructor(entries, { pageComponentsMap, stylesCache, scriptsCache, pathToComponent }) {
    super(entries);
    this.pageComponentsMap = pageComponentsMap;
    this.stylesCache = stylesCache;
    this.scriptsCache = scriptsCache;
    this.pathToComponent = pathToComponent;
  }

  getValueByKey(key) {
    const components = this.pageComponentsMap.get(key);
    let stylesContent = '';
    let scriptsContent = '';
    for (const componentName of components) {
      stylesContent += this.stylesCache.get(this.pathToComponent(componentName, '.css'));
      scriptsContent += this.scriptsCache.get(this.pathToComponent(componentName, '.js'));
    }
    stylesContent = isProd ? transformStyles(stylesContent) : stylesContent;
    scriptsContent = isProd ? transformScripts(scriptsContent) : scriptsContent;
    return {
      stylesContent,
      scriptsContent
    }
  }
}

module.exports = function(eleventyConfig, userOptions = {}) {
  const basePath = eleventyConfig.dir.input;
  const includesPath = path.join(basePath, eleventyConfig.dir.includes);
  const layoutsPaths = path.join(basePath, eleventyConfig.dir?.layouts ?? eleventyConfig.dir.includes);

  const pathToComponent = userOptions.pathToComponent
    ?? ((name, ext = '.njk') => path.join(includesPath, 'components', name, name + ext));

  const pageComponentsMap = new Map();
  const templateCache = new FileContentCache();
  const stylesCache = new FileContentCache();
  const scriptsCache = new FileContentCache();
  const pageComponentsCache = new PageComponentsCache(null, {
    pageComponentsMap,
    stylesCache,
    scriptsCache,
    pathToComponent
  })

  const nunjucksEnvironment = new Nunjucks.Environment(
    new Nunjucks.FileSystemLoader(includesPath),
    new Nunjucks.FileSystemLoader(layoutsPaths)
  );

  eleventyConfig.on('eleventy.before', () => {
    for (const map of [pageComponentsMap, templateCache, stylesCache, scriptsCache, pageComponentsCache]) {
      map.clear();
    }
  });

  eleventyConfig.setLibrary('njk', nunjucksEnvironment);

  eleventyConfig.addPairedShortcode('component', function (content, name, props = {}) {
    const context = this.page
      ? this
      : this.ctx?.$eleventyContext;

    const pageId = context.page?.inputPath;
    if (pageId) {
      if (!pageComponentsMap.has(pageId)) {
        pageComponentsMap.set(pageId, new Set());
      }
      pageComponentsMap.get(pageId).add(name);
    }

    const templateData = {
      $eleventyContext: context,
      content: content,
      $props: props,
    };

    const componentSource = templateCache.get(pathToComponent(name, '.njk'));

    const html = nunjucksEnvironment.renderString(componentSource, templateData);
    const result = new Nunjucks.runtime.SafeString(html);

    return result;
  });

  eleventyConfig.addTransform('inject-components-assets', function (content) {
    if (!content) {
      return content;
    }

    if (!this.page?.outputPath?.endsWith?.('.html')) {
      return content;
    }

    const pageId = this.page.inputPath;
    const { stylesContent, scriptsContent } = pageComponentsCache.get(pageId);

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