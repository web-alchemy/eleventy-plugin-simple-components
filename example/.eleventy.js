const componentsPlugin = require('../.eleventy.js');

module.exports = function(eleventyConfig) {
  eleventyConfig.addPlugin(componentsPlugin, {});

  eleventyConfig.addCollection('articles', (collectionAPI) => {
    return collectionAPI.getFilteredByGlob('./src/articles/**/*.md')
  })

  return {
    dir: {
      input: 'src'
    }
  }
}