module.exports = {
  eleventyComputed: {
    id(data) {
      return data.page.fileSlug;
    },

    link(data) {
      const { id } = data;
      return `/articles/${id}/`;
    }
  }
}