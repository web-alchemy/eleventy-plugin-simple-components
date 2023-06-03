module.exports = {
  permalink: '/articles/',

  eleventyComputed: {
    articlesList(data) {
      return data.collections.articles
        .map((article) => ({
          title: article.data.title,
          link: article.data.link
        }))
    },
  }
}