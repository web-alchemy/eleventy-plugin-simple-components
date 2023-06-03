module.exports = {
  pagination: {
    data: 'collections.articles',
    size: 1,
    alias: 'article'
  },

  eleventyComputed: {
    permalink(data) {
      const { article } = data;
      const { link } = article.data;
      return link;
    },

    title(data) {
      const { article } = data;
      return article.data.title
    },

    content(data) {
      const { article } = data;
      return () => article.content;
    }
  }
}